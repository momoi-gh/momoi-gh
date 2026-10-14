---
paths:
  - "**/*.gd"
---

# GDScript 规范（仅作用于 .gd 文件）

## 静态类型

所有变量、参数、返回值必须写类型注解。禁止裸 `var x =`、`var` 推断不清的场景。

```gdscript
# ✅
var speed: float = 120.0
var npcs: Array[NPCBase] = []

func move(direction: Vector2) -> void:
    velocity = direction * speed
    move_and_slide()

func get_flag(key: StringName) -> bool:
    return false

# ❌
var speed = 120.0
func move(direction):
    velocity = direction * speed
```

## 节点引用

- 优先用 `@onready var _label: RichTextLabel = $Panel/Name`，**不要**在 `_process` 里每次 `get_node()`
- 禁止跨场景硬编码绝对路径（`get_node("/root/World/Player")`）→ 用 `@export`、`group`、或 autoload
- 用 `%UniqueName` 时必须在编辑器里勾选 Scene Unique Name

## 信号

- 信号名用过去式：`dialogue_finished`、`door_opened`、`scene_changed`
- 连接优先用代码 `sig.connect(callable)`，禁止 Godot 3.x 的 `connect("sig", self, "method")`
- 需要跨场景广播时走 autoload 事件总线，不要链式向上 `get_parent().get_parent()`

## 时序与安全

- 改物理/碰撞属性用 `set_deferred()`（例如切场景后关掉门的 `monitoring`）
- 切场景用 `SceneRouter`，不要在业务脚本里直接 `get_tree().change_scene_to_file()`
- 异步切换用 `await`，不要用 `yield`

## 组织

- 一个文件一个 `class_name`，类名与文件名一致
- 顺序：`class_name` → `extends` → 常量 → `@export` → 成员变量 → `@onready` → 生命周期 → 公开方法 → 私有方法 → 信号回调
- 魔法数字提取为常量或 `@export`（例如交互半径、打字机速度）

## 禁止事项

- ❌ 在 `_process` 里做 `get_node()` / `find_child()` / 字符串拼接查找
- ❌ 用 `get_tree().get_nodes_in_group()[0]` 后不判空
- ❌ 把跨场景状态存在场景脚本里（必须放 `GameState`）
- ❌ 对话播放期间不锁玩家输入
