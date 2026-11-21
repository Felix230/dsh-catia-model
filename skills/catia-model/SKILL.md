---
name: catia-model
description: 用 CATIA V5 (R21) + rutwikg/catia-mcp 从二维工程图的标注尺寸建模并定量验证。适用于：读图后建 CATPart、按装配图摆 CATProduct、用体积/质心/质量回测尺寸理解是否正确。内置 R21 已知坑（SPA 缺失导致无约束/无邻近点引用、Part.Name 只读、几何图形集导致阵列失败、Pad 叠加导致内孔贯穿）与规避手法。
metadata:
  category: engineering
  maturity: working
  validated_on: CATIA V5-6R2021 (B21) + rutwikg/catia-mcp 1.0.1
---

# CATIA V5 图纸建模 Skill

## 何时用

- 有一张二维工程图（PDF / 照片 / CATDrawing），要建出对应的 CATPart
- 有一张装配图 + 若干零件图，要摆成 CATProduct
- 需要验证"建出来的东西是否真是图纸要的"，而不是"看起来像"

不适用于：需要真实螺纹几何、需要参数化设计意图（Knowledge/公式）、需要曲面造型为主的零件。

## 铁律（违反必错）

1. **尺寸只来自标注，不从图上量。** PDF 的"比例"标注可能与实际绘制比例不符（本案 1:2.5 标称、1:2.43 实测，差 2.9%）。任何"量图反推"都会把误差带进整个模型。
2. **文字转曲线是常态。** 很多 CATIA 导出的 PDF `words=0`，文字已被描成路径。取数只能靠视觉读图；不要指望文本层。
3. **公差只记录，不进几何。** 基本尺寸建模，±0.02 之类写进偏差文档，不参与实体。
4. **不猜，只登记。** 冲突/歧义写进 `deviations.md` 的 open question，不要取平均、不要"选一个看起来对的"。

## 工作流

### 第 1 步：取数（视觉通道）
- 400 DPI 渲染整页 + 关键区域裁剪（标题栏 / 明细表 / 各视图 / 技术要求）
- 逐区读：图号、名称、比例、材料、数量、重量、明细表每行、每个视图的标注
- 建立**覆盖账本**：读了哪些区域、哪些没读/读不清，必须显式登记

### 第 2 步：建立 IR（JSON）
最小字段：`drawing{units,scale,projection,doc_no,title,weight}`、`bom[]`、`parts[]`（每件 features + dims）、
`views[]`、`notes[]`、`open_questions[]`。
每条特征带 `source`（哪个区域）与 `confidence`。

### 第 3 步：校验闸门（建模前）
- **守恒**：球标数 = 明细表行数；孔数 = 标注数 × 实例数；链式尺寸求和 = 总长
- **闭合**：草图闭合、无自交、体积量级合理（与图纸重量反算的体积比对）
- 任一不成立 → 停下来问，不要往下建

### 第 4 步：建模（构造规则，见 references/r21-pitfalls.md）
- **回转内腔用"环形 Pad"**：一个草图里画内外两个同心圆，Pad 直接出管。
  不要用 Pocket 掏内腔（该组合下 Pocket 是空操作，见 pitfalls 坑 10）。
  叠环时还要避开另一个陷阱：三段 Pad 都从 z=0 起会让最小内径贯穿全长 → 体积错 13%（本案实测）。
- **孔/周边缺口用"多实体布尔减"**：新建 body → 一张草图画出所有孔圆 → Pad 到板厚 →
  `catia_boolean(operation="remove", tool_body=...)`。不要指望 Pocket，也不要用 hole_from_sketch（不可用）。
- **每个 `catia_create_sketch` 都显式传 `body="零件几何体"`**，否则草图会落到几何图形集里或报
  `'凸台.1' cannot hold sketches`。
- **螺纹用底孔简化**：M6 → Ø5 通孔，注明"简化画法"。
- 所有 Pad/Pocket 从同一基准面（通常是 xy）起，靠高度/深度控制轴向位置，不要依赖偏移草图。

### 第 5 步：定量回测（必须做）
每建完一件，立刻跑 `catia_mass_properties(density=…)`：
- 体积应与手算公式吻合到 **0.1%**（不符 → 构造错）
- 质量与图纸标重偏差 **≤5%**（超出 → 尺寸理解错或多/少特征）
- 质心位置应符合结构直觉（偏了 → 某段位置错）

### 第 6 步：装配（位置摆放，不追约束）
- `catia_new_product` → `catia_add_component(paths=[...])`
- 用 `catia_move_component(..., absolute=true)` 设置绝对位形（**必须 absolute=true**，否则相对移动叠加出错）
- 组件之间错开时要显式给旋转（如玻璃 180° 翻面）
- 验收用 `catia_mass_properties()`（Product.Analyze）：
  - **整机体积 = 分件体积累加（精确相等）** → 说明无重叠无干涉
  - 整机质心 = 按分件体积加权重算的质心 → 说明位形正确
- 注：该环境的 CATIA 缺 SPA 工作台，**约束无法自动化**（详见 pitfalls）。按"位置正确"交付即可，约束留给人在 GUI 里加。

### 第 7 步：命名与交付
- `catia_set_document_properties(part_number="3-1", revision="A")` —— `Part.Name` 只读，只能改 PartNumber
- 实例名用 `catia_rename_element(token="name:Part1.1", new_name="3-1.1")`
- 顺序很重要：**先关闭父装配 → 单独打开零件 → 改号 → 保存 → 关闭 → 重开装配**
  （在装配打开状态下"激活零件"往往不生效，会把编号改到产品根节点上）
- 保存后**重新打开验证**：`catia_list_components` 里 root/part_number/instance_name 都要对

## 交付物

```
<输出目录>/
  3-0.CATProduct
  3-1.CATPart  3-2.CATPart  3-3.CATPart
  deviations.md         ← 偏差与决策记录（必交）
```

`deviations.md` 每条：编号 · 位置 · 图面 · 实际采用 · 依据 · 影响 · 状态。
状态只有三种：`采用` / `已解决` / `未解决（需人确认）`。

## 参考

- `references/r21-pitfalls.md` —— R21 + rutwikg 的 12 个已知坑与规避法（建模前必读）
- `references/verification.md` —— 回测公式、阈值、以及本案四个件的实测数据（可作基线对照）
