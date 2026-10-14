# godot-guard（Cline 插件骨架）

为这个 Godot 项目提供「无头校验工具 + 安全护栏 hooks」。

## ⚠️ 两个必须先读的限制

1. **未经验证**：本骨架**没有在运行中的 Cline runtime 里执行过**。`api.registerTool` / `createTool` 的确切签名与 hook context 对象结构，必须对照官方文档核对后才能使用：
   - <https://docs.cline.bot/sdk/tools>
   - <https://docs.cline.bot/sdk/plugins>
   - <https://docs.cline.bot/sdk/guides/writing-plugins>
2. **平台限制**：Cline 插件目前**只在 Cline SDK / CLI / Kanban 加载**，**VS Code 与 JetBrains 扩展不支持**。
   如果你用的是 VS Code 扩展，请看本文末尾的 **`.git/hooks/pre-commit` 替代方案**（任何环境都能用，推荐同时做）。
   ✅ **本机实测**：已安装 **Cline CLI 3.0.65**，所以插件与 hooks 在**当前环境可用**。

## 提供的能力

| 类型 | 名称 | 作用 |
|---|---|---|
| Tool | `godot_headless_check` | 跑 `godot --headless --path <项目> --quit`（或对单脚本 `--check-only`），只回传 `SCRIPT ERROR` / `Parse Error` / `Failed to load` 等关键行，避免整屏噪声占用上下文 |
| Hook | `beforeTool` | 拦截 `rm -rf`、`git commit`、`git push`、重定向写 `project.godot`；对任何 `godot ...` 命令要求手动批准 |
| Hook | `afterTool` | 编辑过 `*.gd` / `*.tscn` / `*.tres` 后，提示立刻跑一次 `godot_headless_check` |
| Hook | `afterRun` | 任务收尾提示把验收证据写进 `docs/里程碑.md` |

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `GODOT_PATH` | `/usr/bin/godot` | Godot 可执行文件 |
| `GODOT_PROJECT_PATH` | `/home/momo/Projects/godot/2d` | 项目根目录 |

## 安装

```bash
cd /home/momo/Projects/godot/2d
cline plugin install ./tools/godot-guard     # 项目级，落在 .cline/plugins/
cline config                                  # 检查 plugin 标签页确认已加载
```

其他来源（官方支持的四种）：

```bash
cline plugin install https://github.com/owner/repo.git
cline plugin install npm:@scope/my-plugin
cline plugin install ./tools/godot-guard --force   # 覆盖同名安装
```

## 已知行为（官方文档）

- 每个 hook 调用 **3 秒超时**；失败默认 `hookErrorMode = "ignore"`（记录后继续），连续失败 5 次插件转 `failed`
- 插件状态：`loading` / `ready` / `degraded` / `failed` / `disabled`
- `cline config tools` 会列出失败的插件

## 替代方案：原生 git hook（推荐同时做）

不依赖 Cline 插件，任何环境都能跑。**先 `git init` 再执行：**

```bash
mkdir -p .git/hooks
cat > .git/hooks/pre-commit <<'HOOK'
#!/usr/bin/env sh
# 提交前跑无头冒烟；发现脚本错误就阻止提交。
echo "[godot-guard] running headless smoke check..."
out=$(godot --headless --path "$(git rev-parse --show-toplevel)" --quit 2>&1)
exit_code=$?
# M1 之前「no main scene defined」属正常，先放行。
fatal=$(printf '%s\n' "$out" | grep -E 'SCRIPT ERROR|Parse Error|Failed to load' | grep -v 'no main scene defined')
if [ -n "$fatal" ]; then
  echo "[godot-guard] BLOCKED — script errors found:"
  printf '%s\n' "$fatal"
  exit 1
fi
echo "[godot-guard] OK (exit=$exit_code)"
exit 0
HOOK
chmod +x .git/hooks/pre-commit
```

## 注意

`.git/hooks/` **不会**被 git 跟踪，团队成员各自安装。若要让全队共享，把脚本放到 `tools/godot-guard/pre-commit.sh` 并在 README 里说明，或用 `core.hooksPath` 指向仓库内目录。
