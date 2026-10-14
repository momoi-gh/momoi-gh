# 项目规则：俯视角 RPG（Godot 4.7.2）

本文件**始终加载**。以下为硬约束，违反即视为错误，必须先纠正再继续。

## 引擎版本红线

本工程固定 **Godot 4.7.2.stable**。禁止使用下列已弃用 / 已删除的 API：

- ❌ `TileMap` 节点（已 deprecated） → ✅ 用 `TileMapLayer`，单层一层，多层级 = 多个节点
- ❌ `YSort` 节点（已从引擎删除） → ✅ 用 `CanvasItem.y_sort_enabled` 属性
- ❌ 手工绘制 NavigationPolygon → ✅ 用 TileSet 的 Navigation Layer + `NavigationRegion2D` 一键 Bake
- ❌ 任何 Godot 3.x 的写法（`export` 关键字、`yield`、`connect("sig", self, "m")`）

遇到不确定的 API，先核对：
```bash
godot --headless --dump-extension-api   # 导出 4.7.2 类数据库到 /tmp/extension_api.json
```
不要凭记忆或旧教程下结论。

## 分层总纲（唯一真理）

> 官方原文：`CanvasItem.y_sort_enabled` — "Nodes sort relative to each other only if they are on the same `z_index`."

- `z_index` 负责**跨层**固定绘制顺序
- `y_sort_enabled` 只负责 **z=0 这一层内部**的遮挡关系
- 因此：地面层用负 `z_index` 且**不开** `y_sort_enabled`；立体物（树/墙/家具/角色）放 z=0 并**开** `y_sort_enabled`
- 不要试图用一个大 `TileMapLayer` 混合「地面 + 树 + 人」

## 关卡节点树必须匹配 README §3

新关卡一律从 `res://world/level_base.tscn` 复制。节点名不得随意改动，因为脚本按名字取节点。

## 目录约定

- 脚本按功能分目录（`player/`、`npc/`、`world/`、`ui/`、`autoload/`），不按类型堆在根目录
- 全局单例只放 `autoload/`，且在 Project Settings → Autoload 注册
- 素材一律放 `assets/`，禁止把 `.png` 散落在 `res://` 根目录
- 文档放 `docs/`，测试放 `tests/`

## 命名约定

| 对象 | 规范 | 示例 |
|---|---|---|
| 文件 / 目录 | `snake_case` | `scene_router.gd`、`level_base.tscn` |
| 类名（`class_name`） | `PascalCase` | `class_name Interactable` |
| 节点名 | `PascalCase` | `ObjectsLayer`、`SpawnPoints` |
| 变量 / 函数 | `snake_case` | `target_spawn`、`open_door()` |
| 常量 | `SCREAMING_SNAKE_CASE` | `TRANSITION_FADE` |
| 私有成员 | 前缀 `_` | `_armed`、`_pending_scene` |
| 信号 | 过去式 `snake_case` | `dialogue_finished`、`door_opened` |

## 单一数据源

任何需要跨场景存活的数据（旗标、背包、NPC 状态、当前时间、玩家属性）**必须**放 `autoload/game_state.gd`。
因为 `change_scene_*` 会销毁整个当前场景，写在场景脚本里的状态一定会丢。

## 提交前必做

每次改动后必须跑通无头冒烟，并确认输出中没有 `SCRIPT ERROR` / `Parse Error`：
```bash
godot --headless --path /home/momo/Projects/godot/2d --quit
```
