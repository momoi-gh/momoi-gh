# 俯视角 RPG（Godot 4.7.2）

> 2D top-down RPG · Godot 4.7.2 · GDScript · 像素风 TileMapLayer
> 状态：**空工程，待开发**（仅 `icon.svg` + `project.godot`）

一个俯视角 RPG 垂直切片，目标是用 3 个场景（村口 / 村长家 / 森林小径）跑通五个核心系统：
**人物对话、开门与场景转换、地形分层、NPC 运动轨迹、树木正确遮挡**。

---

## 1. 技术栈（实测锁定）

| 项 | 值 | 备注 |
|---|---|---|
| 引擎 | **Godot 4.7.2.stable**（`/usr/bin/godot`） | `ed1daf0bf`，2026-08-17 构建 |
| 语言 | GDScript（静态类型） | 不用 C# |
| 渲染 | Forward+ | 2D 游戏可后续切 `gl_compatibility` |
| 分辨率 | viewport `640×360` / window `1280×720` | ×2 整数缩放 |
| 瓦片 | `16×16` 基座 + 多格大件（树 `32×64`） | 见 §4 |
| 地图 | **`TileMapLayer` + `TileSet`** | 不是 `TileMap` |
| 美术 | 像素风，全局 `Nearest` | 占位图用 ImageMagick 生成 |
| 版本控制 | git | `.godot/` 已忽略 |

### 版本红线（照 3.x 教程写必报错）

| 老做法 | 4.7.2 正确做法 |
|---|---|
| `TileMap`（多层） | **`TileMapLayer`**（单层，多层级 = 多节点）。`TileMap` 已 deprecated |
| `YSort` 节点 | **`CanvasItem.y_sort_enabled`**。`YSort` 已从引擎删除 |
| 手画导航多边形 | `TileMapLayer.navigation_enabled` + TileSet Navigation Layer → Bake |

> 官方原文：`CanvasItem.y_sort_enabled` — "**Nodes sort relative to each other only if they are on the same `z_index`.**"
> 官方原文：`TileMapLayer.rendering_quadrant_size` — "The quadrant size does not apply on a Y-sorted TileMapLayer, as tiles are grouped by Y position instead."

---

## 2. 目录结构

```text
res://
├── project.godot
├── autoload/                  # 全局单例
│   ├── game_state.gd          # 旗标/背包/NPC状态/存档
│   ├── scene_router.gd        # 场景切换 + 淡入淡出 + 落点
│   └── dialogue_runner.gd     # 对话播放器
├── common/                    # interactable.gd/.tscn, spawn_point.gd
├── player/                    # player.tscn/.gd, camera.tscn
├── npc/                       # npc_base.gd/.tscn, patrol_route.gd, behaviors/
├── dialogue/                  # dialogue_runner.tscn, dialogue_trigger.gd, data/*.tres
├── world/
│   ├── level_base.tscn        # ★ 关卡模板
│   ├── levels/                # village / forest / house_a
│   ├── doors/door.tscn + .gd
│   └── tilesets/overworld.tres
├── ui/                        # hud.tscn, fade_overlay.tscn
├── assets/{tiles,sprites,fonts,sfx}/
├── docs/                      # 设计大纲 / 里程碑 / 验收记录
├── tests/                     # 无头冒烟与单元测试
├── .clinerules/               # AI 规则（见 §6.4）
├── .cline/skills/             # AI 技能（见 §6.3，可提交）
└── tools/godot-guard/         # Cline 插件骨架（见 §6.5）
```

---

## 3. 关卡节点树规范 ★

> 五大系统全部挂在这棵树上。**新关卡一律从 `level_base.tscn` 复制**，挂点位置永不改动。

```text
Level (Node2D)
├── BackgroundLayer    (Node2D)        z=-20
├── GroundLayer        (TileMapLayer)  z=-10   # 不参与 Y 排序
├── GroundDecorLayer   (TileMapLayer)  z=-9    # 草/石子/地毯
├── GroundShadowLayer  (TileMapLayer)  z=-8    # 贴地影子
├── YSortRoot (Node2D) z=0  y_sort_enabled = ON   ★★★
│   ├── ObjectsLayer (TileMapLayer) y_sort_enabled = ON   # 树/墙/家具
│   └── Entities (Node2D)           y_sort_enabled = ON   # Player / NPC
├── OverhangLayer      (TileMapLayer)  z=10     # 树冠/屋檐
├── NavigationRegion2D
├── Triggers (Node2D)                            # Door / 触发器
├── SpawnPoints (Node2D)                         # Marker2D，name = target_spawn
├── CanvasModulate / PointLight2D
└── Camera2D                                     # limit = 房间边界
```

**分层原则**：按「绘制深度」分层，不按「内容」分层。`z_index` 管跨层顺序，`y_sort_enabled` 只管 z=0 内部遮挡。

---

## 4. 五大系统（速查）

### 4.1 地形分层

`TileSet` 内注册：`Physics Layer 0`=地形碰撞 / `Physics Layer 1`=水与触发区；`Terrain Sets`=自动接边；`Navigation Layer`=供烘焙；`Occlusion Layer`=光照遮挡；`Custom Data Layers`=`is_water: bool`、`is_grass: bool`。
高台/二层用 `TileMapLayer.y_sort_origin`（层级值，加到每片瓦片上）伪造高度，不再开层。

### 4.2 树木正确遮挡（三种含义，分开处理）

| 类型 | 现象 | 方案 |
|---|---|---|
| **A 深度遮挡**（先做） | 玩家在树干后 → 树盖住玩家；在前 → 玩家盖住树 | ① TileSet 选中树 tile → **Rendering → Y Sort Origin** = 树干底部（64px 高的树先填 `62`，实机 ±2 微调）② `ObjectsLayer.y_sort_enabled = ON` ③ 父 `YSortRoot.y_sort_enabled = ON` ④ **玩家/NPC 原点必须在脚底** |
| **B 树冠遮挡** | 走进树荫看不见人 | 树冠拆到 `OverhangLayer`(z=10)；`Area2D` + `Tween` 把该树 `modulate.a → 0.4` |
| **C 光照遮挡** | 夜里/洞穴树影 | TileSet **Occlusion Layer** 画遮挡多边形 + `PointLight2D` + `CanvasModulate` |

**四条铁律**：① 角色原点必须在脚底；② Y 排序只在同一 `z_index` 内生效；③ 瓦片层与其父节点**两级都要开** `y_sort_enabled`；④ 同 Y 相邻树顺序怪 → 调 `x_draw_order_reversed`。

### 4.3 人物对话

默认**自研最小版**（无依赖、留 `dialogue_provider` 接口，将来可换 [Dialogue Manager 4](https://github.com/nathanhoad/godot_dialogue_manager)，要求 4.6+ 满足）。
`*.tres` 剧本 + `DialogueRunner` + `RichTextLabel.visible_ratio` 打字机 + 分支选项；对话期间 `player.input_locked = true`、NPC 切 `TALK` 并转身；`game_state.set_flag()` 防重复。

### 4.4 开门与场景转换

`Door(Area2D)` 导出 `target_scene / target_spawn / trigger_mode(WALK|INTERACT) / locked / transition`。
`SceneRouter`：锁输入 → 淡出 → `load_threaded_request` 预加载 → `change_scene_to_packed` → 找 `SpawnPoints` 组匹配 `Marker2D` → 摆玩家 → **重置 `Camera2D.limit`** → 淡入。
⚠️ 防重复触发：SpawnPoint 放门外 ≥1 格 + Door `armed=false`，`body_exited` 后才 arm。
⚠️ `change_scene_*` 销毁整个场景 → 跨场景数据必须在 `GameState`。

### 4.5 NPC 运动轨迹

| 档 | 节点 | 用途 |
|---|---|---|
| ① 固定轨迹 | `Path2D + PathFollow2D`（`loop=true`） | 巡逻、行商。零寻路开销，最稳 |
| ② 路点列表 | `Array[Marker2D]` | 少量拐角 + 停顿 |
| ③ 自动寻路 | `NavigationRegion2D + NavigationAgent2D` | 绕障追玩家 |

NPC 基类 `CharacterBody2D + enum{IDLE,PATROL,PATHFIND,TALK,WAIT}`；原点同样在脚底；**不要给每个 NPC 单独烘 `NavigationPolygon`**；改了地形必须重烘。

---

## 5. 里程碑

| # | 内容 | 验收标准 |
|---|---|---|
| M0 | 基础配置 + 目录 + git + 输入映射 + 占位素材 | F5 跑起来无报错 |
| M1 | 玩家 `CharacterBody2D` 八向移动 + 四向动画 + `Camera2D` 跟随 | 能自由走动 |
| M2 | `TileSet` 各层建好 + `level_base.tscn` 分层骨架 | 被墙挡住、能分辨水/草地 |
| **M3** | **Y 排序遮挡** | 绕树走一圈遮挡永远正确 |
| M4 | `Interactable` 基类 + 交互提示 UI | 门前显示「E 开门」 |
| M5 | 对话系统 + 打字机 + 分支 + 旗标 | 完成一段分支对话 |
| M6 | `Door` + `SceneRouter` + 淡入淡出 + 防重复 | 进出门 5 次位置/镜头/旗标都正确 |
| M7 | NPC `Path2D` 巡逻 + 状态机 + 对话联动 | 被打断后能恢复巡逻 |
| M7.5 | 导航烘焙 + `NavigationAgent2D` | NPC 能绕障追玩家 |
| M8 | 音效 / 存档 / 日夜光照遮挡 | — |

**每步验证**：`godot --headless --path . --quit`（脚本报错）→ F5 手动验收。
详细任务拆分与进度见 [`docs/里程碑.md`](docs/里程碑.md)。

---

## 6. AI 工程化配置（MCP / Tools / Skills / Rules / Plugins / Agents / Hooks）

> 全部基于官方文档与 [skills.sh](https://www.skills.sh/) 目录实查，每条标注来源与已知限制。

### 6.1 MCP

**主选：[`tugcantopaloglu/godot-mcp`](https://github.com/tugcantopaloglu/godot-mcp)**（484★，157 tools，README 明确 **Tested with Godot 4.7**）—— 与本项目 4.7.2 版本吻合，且是 `Coding-Solo/godot-mcp` 的增强 fork，保留 headless GDScript 架构。

选它的两个关键理由，正好命中本项目痛点：

- `validate_script` 通过 `SceneTree` 在 `_initialize()` 编译（而非 `--check-only`），**引用 autoload 不再误报 `Identifier not found`** ← 我们有 3 个 autoload
- `manage_input_map` 会把第二个按键**合并**进 action 的 `events` 数组，不会写出重复的 `actionname=` 行把 `project.godot` 写坏 ← M0 要配输入映射

备选 / 降级：`Coding-Solo/godot-mcp`（6061★，20 tools，最小最稳）、`hi-godot/godot-ai`（2971★，Snap 安装）。

```bash
# 安装（需要 Node.js）
git clone https://github.com/tugcantopaloglu/godot-mcp ~/tools/godot-mcp
cd ~/tools/godot-mcp && npm install && npm run build
```

```jsonc
// Cline → MCP Servers 面板 → Configure → Configure MCP Servers
// CLI 版写入 ~/.cline/data/settings/cline_mcp_settings.json
{
  "mcpServers": {
    "godot": {
      "command": "node",
      "args": ["/home/momo/tools/godot-mcp/build/index.js"],
      "env": { "GODOT_PATH": "/usr/bin/godot" },
      "disabled": false,
      "autoApprove": ["get_godot_version", "list_projects", "get_project_info",
                      "list_scenes", "read_scene", "validate_script", "get_project_settings"]
    }
  }
}
```

```bash
# CLI 等价写法
cline mcp add godot --yes -- node /home/momo/tools/godot-mcp/build/index.js
```

> ⚠️ **运行时工具（`game_*`）需要额外一步**：把仓库里的 `build/scripts/mcp_interaction_server.gd` 复制进本项目并注册为 autoload（Project Settings → Autoload），否则只能做 headless 操作。
> ⚠️ 版本风险：4.7.2 比绝大多数 MCP server 的测试版本新，接入后**必须先逐个试跑工具**再纳入工作流。

### 6.2 Tools

**Cline 内置工具**（官方 Tools 页确认）：`read_files`、`search_codebase`、`run_commands`、`fetch_web_content`、`editor` / `apply_patch`（二选一）、`skills`、`ask_question`、`submit_and_exit`。

**本项目要用的 Godot MCP 工具分组**：

| 用途 | 工具 | 批准策略 |
|---|---|---|
| 环境/项目信息 | `get_godot_version`、`list_projects`、`get_project_info`、`get_project_settings` | ✅ 自动 |
| 读场景/结构 | `list_scenes`、`read_scene`、headless 场景操作 | ✅ 自动 |
| 脚本校验 | `validate_script` | ✅ 自动（主验证手段） |
| 输入映射 | `manage_input_map` | ⚠️ 手动 |
| 写场景/改设置 | `create_scene`、`set_project_setting`、`create_project` | ⚠️ 手动 |
| 运行/调试 | `run_project`、运行时 `game_*`、日志捕获 | ⚠️ 手动 |

**策略**：只读自动批准，写操作与运行一律手动。

### 6.3 Skills

来源 [skills.sh](https://www.skills.sh/)（Agent Skills 开放规范：`SKILL.md` + 可选 `references/` `scripts/` `assets/`）。

```bash
# ① GDScript 规范（godot 搜索第一名，16.8k 安装）
npx skills add wshobson/agents --skill godot-gdscript-patterns

# ② Godot 引擎 + 门类（含 router 路由技能）
npx skills add gamedev-skills/awesome-gamedev-agent-skills \
  --skill router --skill godot-gdscript --skill godot-nodes-scenes \
  --skill godot-tilemap --skill godot-2d-movement \
  --skill godot-signals-groups --skill godot-gdscript-headless-testing

# ③ 垂直系统（每个技能自带 scripts/*.gd 参考实现）
npx skills add thedivergentai/game-design-agentic-skills \
  --skill godot-project-foundations --skill godot-autoload-architecture \
  --skill godot-scene-management --skill godot-tilemap-mastery \
  --skill godot-dialogue-system --skill godot-navigation-pathfinding \
  --skill godot-characterbody-2d

# ④ 最佳实践
npx skills add jwynia/agent-skills --skill godot-best-practices
```

**里程碑映射**

| 里程碑 | 依赖技能 |
|---|---|
| M0 | `godot-project-foundations` |
| M1 | `godot-2d-movement`、`godot-characterbody-2d` |
| M2 / M3 | `godot-tilemap`、`godot-tilemap-mastery` |
| M4 | `godot-signals-groups` |
| M5 | `godot-dialogue-system` |
| M6 | `godot-scene-management`、`godot-autoload-architecture` |
| M7 | `godot-navigation-pathfinding` |
| 全局 | `godot-gdscript-patterns`、`godot-best-practices`、`router` |
| 验证 | `godot-gdscript-headless-testing` |

**可选补充**：`zate/cc-godot` → `godot-debugging`、`godot-optimization`；`thedivergentai` → `godot-save-load-systems`、`godot-camera-systems`、`godot-animation-tree-mastery`、`godot-quest-system`、`godot-inventory-system`、`godot-rpg-stats`。

安装位置：项目级 `.cline/skills/`（推荐，可提交 git）／`.clinerules/skills/`／`.claude/skills/`；全局 `~/.cline/skills/`。**同名时全局优先**。

> ⚠️ **Skills 在 Cline 是实验特性**：需在 **Settings → Features → Enable Skills** 打开后才出现。渐进加载：元数据 ~100 tokens/技能常驻，指令触发时 <5k tokens。
> 管理：`npx skills list` / `update` / `remove`；禁遥测 `DISABLE_TELEMETRY=1`。

### 6.4 Rules

写入项目根 **`.clinerules/`**（官方：`.clinerules/` 与 `.cline/rules/` 均支持，两者都会被搜索；工作区规则优先于全局规则）。

| 文件 | 作用域（`paths`） | 内容 |
|---|---|---|
| `.clinerules/00-project.md` | 全局（无条件，始终加载） | 引擎版本红线、分层总纲、节点树、命名约定、单一数据源 |
| `.clinerules/10-gdscript.md` | `**/*.gd` | 静态类型、`@onready`、信号命名、禁止 `_process` 里查节点 |
| `.clinerules/20-scenes.md` | `**/*.tscn` | 节点树必须匹配 §3；Y 排序四条铁律；相机 limit |
| `.clinerules/30-tilesets.md` | `**/*.tres`、`**/*.res` | 瓦片 16×16；TileSet 分层登记表；树必须设 Y Sort Origin |
| `.clinerules/40-tests.md` | `tests/**`、`**/*_test.gd` | 无头冒烟要求；必须覆盖的 5 个回归点 |

条件规则用 YAML frontmatter 的 `paths`（glob 支持 `*`、`**`、`?`、`[abc]`、`{a,b}`）：

```yaml
---
paths:
  - "**/*.gd"
---
```

同时提供 `AGENTS.md`（跨工具通用格式；Cline 会读根目录 `AGENTS.md` 与 `~/.agents/AGENTS.md`）。

### 6.5 Plugins

**A) Cline 插件**（⚠️ 官方明示：**仅 Cline SDK / CLI / Kanban 可用，VS Code 与 JetBrains 扩展暂不支持**）

> ✅ **本机实测**：已安装 **Cline CLI 3.0.65**（`command -v cline` 通过），因此**插件、hooks、subagents 全部可用** —— 上面这条平台限制不适用于当前环境。

本仓库提供骨架 `tools/godot-guard/`，`capabilities: ["tools", "hooks"]`：

- 自定义工具 `godot_headless_check` → 封装无头检查并结构化返回报错
- `beforeTool` hook → 拦截对 `project.godot` 的裸写与危险 `run_commands`
- 安装：`cline plugin install ./tools/godot-guard`（项目级落在 `.cline/plugins/`）
- 参考实现：[`cline/typescript-lsp-plugin`](https://github.com/cline/typescript-lsp-plugin)

**B) Godot 编辑器插件（游戏本体，重点）**

| 插件 | 状态 | 用途 |
|---|---|---|
| `dialogue_manager`（Nathan Hoad，MIT） | 备用 | 若 M5 改走插件路线；要求 4.6+，满足 |
| `GdUnit4` | 建议 | 单元测试（配 §6.7 hooks） |
| `Phantom Camera` | 可选 | 相机逻辑，替代手写 `Camera2D` 跟随/切换 |
| `mcp_interaction_server.gd`（autoload） | 条件必需 | 只用 Godot MCP 运行时 `game_*` 工具时才需要 |
| Tiled importer | **不装** | 已选内置 `TileMapLayer` 路线 |

### 6.6 Agents

**Subagents**（⚠️ 官方：**仅 Cline CLI 与 Desktop 可用，VS Code / JetBrains 扩展不使用**；子代理**拿不到 MCP 工具**；批准 `spawn_agent` = 批准它后续所有操作）

| 角色 | 职责 | 调用时机 |
|---|---|---|
| `gdscript-implementer` | 按 §4 与 `.clinerules` 实现 `.gd` / `.tscn` | 每实现一个里程碑 |
| `godot-verifier` | 跑无头冒烟、读报错、核对节点树是否匹配 §3、检查 Y 排序四条铁律 | 每次改动后 |
| `art-pipeline` | ImageMagick 生成/切分占位素材、校验 TileSet 尺寸一致性 | M0 / 美术替换时 |
| `doc-writer` | 维护 `docs/里程碑.md`、验收记录 | 里程碑收尾 |

推荐用法（并行探索，省主上下文）：

```text
Use subagents to (1) map the scene tree of level_base.tscn,
(2) trace the autoload wiring in scene_router.gd,
(3) verify every TileMapLayer's y_sort_enabled value.
```

**Agent Teams**：M2 之后地图/对话/NPC 三条线可并行，各自独立 worktree，避免互相污染。

### 6.7 Hooks

Hooks 是**插件的能力**（`hooks` 对象），非独立配置文件。⚠️ 同样**仅 Cline SDK / CLI / Kanban 可用**。

可用生命周期钩子（官方全部 7 个）：`beforeRun`、`afterRun`、`beforeModel`、`afterModel`、`beforeTool`、`afterTool`、`onEvent`。

| Hook | 本项目用途 | 返回值 |
|---|---|---|
| `beforeTool` | 拦截 `rm -rf`、`git commit`、直接写 `project.godot`；对 `run_commands` 里的 `godot` 调用要求手动批准 | `{ skip: true, reason }` 或 `{ policy: { autoApprove: false } }` |
| `afterTool` | 对 `**/*.gd`、`**/*.tscn` 编辑之后，自动跑 `godot --headless --path . --quit`，把报错回灌给模型 | `appendContext` |
| `afterRun` | 任务收尾跑完整冒烟 + 生成验收摘要 | 无 |
| `onEvent` | 预留：与 git post-commit 配合 | 无 |

> 限制：每个 hook 调用 **3 秒超时**；失败默认 `hookErrorMode = "ignore"`（记录后继续），连续失败 5 次插件转 `failed`。
>
> **兜底方案（不依赖 Cline 插件）**：写原生 `.git/hooks/pre-commit` 跑同样的无头检查 —— 任何环境都能用，**推荐同时做**。

---

## 7. 常用命令

```bash
# 无头冒烟（脚本报错检查）★ 每次改动后都跑
godot --headless --path /home/momo/Projects/godot/2d --quit

# 单文件语法检查
godot --headless --path /home/momo/Projects/godot/2d --check-only --script res://player/player.gd

# 运行游戏
godot --path /home/momo/Projects/godot/2d

# 生成占位素材（本机无 PIL，用 ImageMagick）
magick -size 16x16 xc:'#4a7c3f' assets/tiles/placeholder_16.png

# 导出 4.7.2 类数据库，核对 API 是否随版本变化
godot --headless --dump-extension-api
```

---

## 8. 待确认事项

| # | 事项 | 当前默认 | 影响 |
|---|---|---|---|
| 1 | 瓦片尺寸 16×16 / 32×32 | `16×16` + 多格大件 | M2（画了素材就改不了） |
| 2 | 对话自研 / Dialogue Manager 4 | 自研 + 预留接口 | M5 |
| 3 | NPC 只需巡逻 / 必须绕障 | 先①后③ | M7 |
| 4 | 整场景切换 / 大地图房间切换 | 整场景 + 淡入淡出 | M6 |
| 5 | 垂直切片 / 完整游戏 | 垂直切片 + 存档 | 全局 |

---

## 9. 坑清单

1. 角色原点不在脚底 → Y 排序**永远**错（最高频死因）
2. `y_sort_enabled` 只开子节点没开父节点 → 无效
3. 树和地面放同一 `z_index` → 遮挡失效
4. 用 `TileMap` / `YSort` → 4.7 已弃用 / 删除
5. 切场景后不重置 `Camera2D.limit` → 镜头从旧地图滑过来
6. Door 在落点瞬间重复触发 → `armed` 标志位
7. 跨场景数据放场景脚本里 → 切场景就丢
8. 改地形不重烘导航 → NPC 撞空气墙
9. 每个 NPC 单独烘 `NavigationPolygon` → 性能崩
10. 在 Y 排序层上调 `rendering_quadrant_size` → 无效，别浪费时间
11. 对话不锁输入 → 玩家边说边跑
12. `stretch/aspect = expand` + 像素风 → 变形，改 `keep`

---

## 10. 参考来源

- Godot 官方类参考：`TileMapLayer` / `TileData` / `CanvasItem`（`y_sort_enabled`、`y_sort_origin` 原文）
- [skills.sh — The Open Agent Skills Directory](https://www.skills.sh/)
- [Cline 文档 — Skills / Rules / Plugins / MCP / Hooks](https://docs.cline.bot/)
- [Dialogue Manager（备用对话方案）](https://github.com/nathanhoad/godot_dialogue_manager)
