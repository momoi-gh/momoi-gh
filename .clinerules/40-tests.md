---
paths:
  - "tests/**"
  - "**/*_test.gd"
---

# 测试规范（仅作用于 tests/ 与 *_test.gd）

## 每个里程碑必须有验收证据

每个 M 里程碑收尾时，必须在 `tests/` 提供可复跑的检查，并把结果记进 `docs/里程碑.md`。

## 冒烟测试（最低要求，每个里程碑都要）

```bash
godot --headless --path /home/momo/Projects/godot/2d --quit
```

判定标准：输出中**没有** `SCRIPT ERROR`、`Parse Error`、`Failed to load`。
注意：未设置主场景时会报 `Can't run project: no main scene defined`，这条在 M0 之前属正常。

## 单脚本语法检查

```bash
godot --headless --path /home/momo/Projects/godot/2d --check-only --script res://path/to/file.gd
```

## 无头场景测试

用 `godot --headless --script res://tests/foo_test.gd` 写 `SceneTree` 派生脚本做断言，
成功输出的最后一行必须是明确的 `PASS` / `FAIL` 字样，方便直接看日志判断。

## 测试命名

- 文件：`tests/<被测模块>_test.gd`，如 `tests/scene_router_test.gd`
- 函数：`test_<被测量>_<条件>()`，如 `test_spawn_point_matches_target_spawn()`

## 必须覆盖的回归点（对应 README §9 坑清单）

1. 角色原点在脚底（Y 排序前提）
2. 门的落点不会立刻重复触发（`armed` 标志位）
3. 切场景后 `Camera2D.limit` 被重置
4. 对话期间玩家输入被锁
5. 跨场景状态在 `GameState` 里确实存活

## 禁止事项

- ❌ 用「跑起来了看着没问题」代替测试证据
- ❌ 测试脚本里写死绝对路径以外的环境假设（跨机器要能跑）
- ❌ 测试里 `change_scene` 后不 `await` 就断言
