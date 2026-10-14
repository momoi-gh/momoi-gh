---
paths:
  - "**/*.tres"
  - "**/*.res"
---

# 瓦片与资源规范（仅作用于 .tres / .res）

## 瓦片规格

- `TileSet` 的 **Tile Size = 16×16**
- 大物件用多格瓦片：树 `32×64`(2×4 格)、房子 `96×80`、水井 `32×48`
- 像素风资源导入过滤必须为 `Nearest`，禁止 `Linear`（会糊）

## TileSet 分层登记表

新建 `TileSet` 时必须按此登记，顺序不要变：

| 层 | 名称 | 用途 |
|---|---|---|
| Physics Layer 0 | `terrain` | 墙/水的实心碰撞 |
| Physics Layer 1 | `trigger` | 水域、遭遇区等触发区（不阻挡） |
| Terrain Set 0 | `Grass` | 草地自动接边 |
| Navigation Layer 0 | `walkable` | 供 `NavigationRegion2D` Bake |
| Occlusion Layer 0 | `light` | 供 `PointLight2D` 投影 |
| Custom Data `is_water` | `bool` | 运行时查 `get_custom_data("is_water")` |
| Custom Data `is_grass` | `bool` | 脚步声等 |

## 树的 Y Sort Origin（核心配置）

树的瓦片必须在 TileSet 编辑器里设置 **Rendering → Y Sort Origin**，值为**树干底部到瓦片顶部的像素偏移**：

- 树贴图高 64px → 起始值填 `62`，**实机 F5 对着 ±2 微调**
- 没有树干贴图的灌木 → 填贴图高度的一半左右
- 数值不确定时不要瞎猜，用单格小树先验证，再上多格大树

## 高台伪高度

需要「二层/高台」时，用 `TileMapLayer.y_sort_origin`（层级级，会加到每片瓦片的 origin 上）整体偏移，
不要在同一个 `TileMapLayer` 里混放不同高度的物件。

## 资源文件约定

- 一个 `TileSet` 资源（`world/tilesets/overworld.tres`）被多个 `TileMapLayer` 复用，不要每层建一个新 TileSet
- 剧本资源放 `dialogue/data/*.tres`，一个对话一个文件，文件名即 `dialogue_id`
- 禁止在 `.tres` 里留对已删除素材的引用（会导致导入报错）
