/**
 * godot-guard — Cline plugin skeleton for the top-down RPG (Godot 4.7.2).
 *
 * WARNING: SKELETON ONLY.
 *   This file has NOT been executed or verified against a running Cline runtime.
 *   The exact signatures of `api.registerTool`, `createTool` and the hook context
 *   objects must be confirmed against the official docs before use:
 *     - https://docs.cline.bot/sdk/tools        (createTool / registerTool)
 *     - https://docs.cline.bot/sdk/plugins      (hooks table + return values)
 *     - https://docs.cline.bot/sdk/guides/writing-plugins
 *
 * LIMITATION: Cline plugins currently only load in Cline SDK, CLI and Kanban.
 *   The VS Code and JetBrains extensions do NOT load plugins yet. If you are on
 *   the VS Code extension, use .git/hooks/pre-commit instead (see README.md).
 *
 * Install (from the project root):
 *   cline plugin install ./tools/godot-guard
 */

import { type AgentPlugin } from "@cline/sdk"

/** Absolute path to the Godot binary; override with GODOT_PATH. */
const GODOT_BIN = process.env.GODOT_PATH ?? "/usr/bin/godot"

/** Absolute path to this Godot project. */
const PROJECT_PATH = process.env.GODOT_PROJECT_PATH ?? "/home/momo/Projects/godot/2d"

/** Commands that must never run unattended in this project. */
const BLOCKED_RUN_COMMAND_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/,
  /\bgit\s+commit\b/,
  /\bgit\s+push\b/,
  />\s*\S*project\.godot/,
  /--headless\b.*\b--editor\b/,
]

/** Files whose edits should trigger a headless re-check. */
const CHECKED_FILE_PATTERN = /\.(gd|tscn|tres|godot)$/

const plugin: AgentPlugin = {
  name: "godot-guard",

  manifest: {
    capabilities: ["tools", "hooks"],
  },

  setup(api, _ctx) {
    // --- Tool: godot_headless_check -------------------------------------
    // Runs `godot --headless --path <project> --quit` and returns a compact
    // structured report instead of raw console noise.
    api.registerTool({
      name: "godot_headless_check",
      description:
        "Run a Godot headless smoke check on the project and report SCRIPT ERROR / Parse Error lines. " +
        "Use after editing any .gd / .tscn / project.godot file.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: {
            type: "string",
            description: "Absolute path to the Godot project. Defaults to GODOT_PROJECT_PATH.",
          },
          script: {
            type: "string",
            description:
              "Optional res:// script path. When set, runs --check-only on that single script instead of a full project check.",
          },
        },
        required: [],
      },
      async execute(input, context) {
        const projectPath = input.project_path ?? context.cwd ?? PROJECT_PATH
        const args = input.script
          ? ["--headless", "--path", projectPath, "--check-only", "--script", input.script]
          : ["--headless", "--path", projectPath, "--quit"]

        const proc = Bun.spawn([GODOT_BIN, ...args], {
          stdout: "pipe",
          stderr: "pipe",
        })
        const stdout = await new Response(proc.stdout).text()
        const stderr = await new Response(proc.stderr).text()
        const exitCode = await proc.exited

        const combined = `${stdout}\n${stderr}`
        const errorLines = combined
          .split("\n")
          .filter((line) => /SCRIPT ERROR|Parse Error|Failed to load|ERROR:/.test(line))
        // "no main scene defined" is expected until M1 wires up a main scene.
        const fatal = errorLines.filter((line) => !/no main scene defined/.test(line))

        return {
          success: fatal.length === 0,
          exit_code: exitCode,
          fatal_errors: fatal,
          expected_notices: errorLines.filter((line) => /no main scene defined/.test(line)),
          raw_tail: combined.split("\n").slice(-15).join("\n"),
        }
      },
    })
  },

  hooks: {
    // --- beforeTool: policy guard ----------------------------------------
    beforeTool(context) {
      const { tool, input } = context

      if (tool === "run_commands") {
        const command: string = input?.command ?? ""
        const hit = BLOCKED_RUN_COMMAND_PATTERNS.find((re) => re.test(command))
        if (hit) {
          return {
            skip: true,
            reason:
              `godot-guard blocked this shell command (matched ${hit}). ` +
              "Destructive or repo-state-changing commands must be run by the user manually.",
          }
        }
        // Godot invocations are safe but slow: always ask.
        if (/\bgodot\b/.test(command)) {
          return { policy: { autoApprove: false } }
        }
      }

      if (tool === "editor" || tool === "apply_patch") {
        const path: string = input?.path ?? ""
        if (path.endsWith("project.godot")) {
          return { policy: { autoApprove: false } }
        }
      }

      return undefined
    },

    // --- afterTool: auto re-check after file edits ------------------------
    async afterTool(context) {
      const { tool, input } = context
      if (tool !== "editor" && tool !== "apply_patch") return undefined

      const path: string = input?.path ?? ""
      if (!CHECKED_FILE_PATTERN.test(path)) return undefined

      return {
        appendContext:
          `godot-guard: ${path} changed. Run the godot_headless_check tool now and fix any ` +
          "SCRIPT ERROR / Parse Error before reporting the task as done.",
      }
    },

    // --- afterRun: final acceptance evidence ------------------------------
    async afterRun(context) {
      console.log(
        `[godot-guard] run finished (${context?.snapshot?.iteration ?? "?"} iterations). ` +
          "Acceptance evidence belongs in docs/里程碑.md.",
      )
    },
  },
}

export default plugin
