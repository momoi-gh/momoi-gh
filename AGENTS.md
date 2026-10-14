# AGENTS.md — 俯视角 RPG（Godot 4.7.2）

跨工具通用指令。与 `.clinerules/` 内容重合并保持同步；冲突时以 `.clinerules/00-project.md` 为准。
完整背景见 `README.md`，逐项方案见 `docs/设计大纲.md`，进度见 `docs/里程碑.md`。

## 项目是什么

Godot 4.7.2 的 2D 俯视角 RPG 垂直切片，用 3 个场景跑通五个系统：
人物对话、开门与场景转换、地形分层、NPC 运动轨迹、树木正确遮挡。

## 硬约束

1. **引擎固定 4.7.2**。禁用 `TileMap`（已 deprecated）→ 用 `TileMapLayer`；
   禁用 `YSort` 节点（已删除）→ 用 `CanvasItem.y_sort_enabled`。
2. **分层总纲**：`z_index` 管跨层顺序，`y_sort_enabled` 只管 z=0 内部的遮挡。
   官方原文："Nodes sort relative to each other only if they are on the same `z_index`."
3. **角色节点原点必须在脚底**，否则 Y 排序永远错。
4. 关卡一律从 `res://world/level_base.tscn` 复制，节点树匹配 `README.md` §3。
5. 跨场景数据**必须**放 `autoload/game_state.gd`（`change_scene_*` 会销毁当前场景）。
6. 瓦片 `16×16` 基座，树 `32×64` 多格，且树 tile 必须设 **Y Sort Origin**。

## 常用命令

```bash
# 无头冒烟（每次改动后都跑）
godot --headless --path /home/momo/Projects/godot/2d --quit

# 单文件语法检查
godot --headless --path /home/momo/Projects/godot/2d --check-only --script res://path/to/file.gd

# 运行游戏
godot --path /home/momo/Projects/godot/2d

# 核对 4.7.2 真实 API（不确定时用它，别凭记忆）
godot --headless --dump-extension-api
```

## 命名与结构

- 文件/目录 `snake_case`，节点/类名 `PascalCase`，变量/函数 `snake_case`，常量 `SCREAMING_SNAKE_CASE`，私有前缀 `_`
- 信号用过去式：`dialogue_finished`、`door_opened`
- GDScript 全量静态类型注解
- 禁止在 `_process` 里 `get_node()` / `find_child()`
- 禁止链式 `get_parent().get_parent()`，跨层通信用 group / autoload 事件总线

## 工作方式

- GDScript 用静态类型；改物理属性用 `set_deferred()`；异步用 `await`（不是 `yield`）
- 不确定 API 先跑 `--dump-extension-api` 或读 `README.md`，不要照搬旧教程
- 每次改完必须给出无头冒烟结果作为证据
- 发现规则与实际不符时，先改规则文件再改代码，保持文档与实现一致
