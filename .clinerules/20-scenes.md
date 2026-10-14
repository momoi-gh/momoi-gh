---
paths:
  - "**/*.tscn"
---

# 场景规范（仅作用于 .tscn 文件）

## 节点树

新关卡必须从 `res://world/level_base.tscn` 复制，节点名严格匹配 README §3：

```text
Level (Node2D)
├── BackgroundLayer    (Node2D)        z=-20
├── GroundLayer        (TileMapLayer)  z=-10
├── GroundDecorLayer   (TileMapLayer)  z=-9
├── GroundShadowLayer  (TileMapLayer)  z=-8
├── YSortRoot (Node2D) z=0  y_sort_enabled=ON
│   ├── ObjectsLayer (TileMapLayer) y_sort_enabled=ON
│   └── Entities (Node2D)           y_sort_enabled=ON
├── OverhangLayer      (TileMapLayer)  z=10
├── NavigationRegion2D
├── Triggers (Node2D)
├── SpawnPoints (Node2D)
├── CanvasModulate / PointLight2D
└── Camera2D
```

## Y 排序四条铁律（违反必然导致遮挡错误）

1. **角色节点原点必须在脚底** —— 用 `Sprite2D.offset.y` 补偿，或把 `CollisionShape2D` 相对 Sprite 摆好。原点不在脚底时，Y 排序怎么调都是错的。
2. **Y 排序只在同一个 `z_index` 内生效** —— 树和地面绝不能在同一 `z_index`。
3. **两级都要开** —— 参与排序的 `TileMapLayer` 和它的父节点都必须 `y_sort_enabled = true`。
4. 同 Y 相邻树左右顺序不对 → 调 `TileMapLayer.x_draw_order_reversed`，不要靠挪位置绕。

## 场景文件约定

- 场景根节点类型要与用途一致：可交互物用 `Area2D`，实体用 `CharacterBody2D`，纯装饰用 `Node2D`
- 可交互物统一挂 `res://common/interactable.gd` 继承链，不要各自实现一遍交互检测
- 落点统一用 `Marker2D` 且放进 `SpawnPoints` 分组，`name` 即 `target_spawn`
- 相机 `Camera2D` 必须设置 `limit_*` 为当前房间边界，切场景后由 `SceneRouter` 重置
- 不要给同一个场景塞两个 `Camera2D` 且都启用

## 命名

- 场景文件 `snake_case.tscn`：`level_base.tscn`、`house_a.tscn`、`door.tscn`
- 节点 `PascalCase`：`ObjectsLayer`、`SpawnPoints`、`DialogueBalloon`
- 实例在同一场景内重名时加数字后缀：`NPC_01`、`Door_North`
