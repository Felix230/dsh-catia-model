# R21 + rutwikg 已知坑与规避

环境基线：CATIA V5-6R2021 (B21)，rutwikg/catia-mcp 1.0.1，Windows 11。
每条：症状 → 根因 → 规避。

## 坑 1：不能加约束（最高优先级）

- **症状**：`catia_assembly_constraint(kind="fix")` 报 `AddMonoEltCst 失败`；
  `kind="coincidence"` 报 `AddBiEltCst 失败`。
- **根因**：该 CATIA 会话**缺 SPA（测量）工作台**。`catia_measure` 明确返回
  `SPAWorkbench is not available`。约束创建要构造几何 Reference，依赖同一套接口。
- **连带不能用**：`face@x,y,z` 邻近点（报 "no face with a measurable position"）、
  `catia_measure`、`catia_measure_distance`、`catia_bounding_box`。
- **仍可用**：建模、装配插入、`move_component(absolute=true)`、`list_faces`（有 owner，无 metrics）、
  `mass_properties`（走 Product.Analyze，不依赖 SPA）、`screenshot`、保存。
- **规避**：装配只做"位置摆放"，约束留给人在 GUI 补。交付时在文档里写明这一点。

## 坑 2：Part.Name 只读

- **症状**：`catia_set_document_properties(part_number=...)` 正常，但任何改 `Part.Name` 的调用
  都报 `方法 Name 失败`。
- **规避**：编号一律走 `PartNumber`（+ `Revision`）；实例名走 `catia_rename_element`。

## 坑 3：几何图形集导致阵列被拒

- **症状**：`catia_circ_pattern` 报 `0x80020009`，提示 part 含几何图形集。
- **根因**：该 MCP 建 part 时会留一个空 `几何图形集.1`，CATIA 在该状态下拒绝阵列。
- **规避**：不要用阵列。把所有孔/缺口画在**同一张草图的多个圆**里，一次 Pocket 切穿。

## 坑 4：Pad 从同一基准面叠加 → 最小内径贯穿

- **症状**：按"Ø310/Ø220×15 + Ø250/Ø220×16 + Ø250/Ø211×7"直接三段 Pad 叠加，
  体积算出 945 cm³，正确值 835 cm³（+13%）。
- **根因**：每个 Pad 都从 z=0 起，最小内半径（Ø211）那段在 0–38 全长生效，
  内孔被"贯穿"成了 Ø211，而不是只在顶部 7mm 才收小。
- **规避（先筒后腔）**：先建最小内孔那段通长 → 再切出大内腔 → 最后加法兰。
  ```
  Pad  R125/R105.5 × 38      # 筒，内孔 Ø211 通长
  Pocket R110/R105.5 × 31    # 把下部内腔扩到 Ø220
  Pad  R155/R110 × 15        # 加法兰 Ø310/Ø220
  ```

## 坑 5：move_component 的相对/绝对语义

- **症状**：装配侧视图里零件错位；读出矩阵的旋转部分是**全 0**（退化矩阵）。
- **根因**：用相对移动（未加 `absolute=true`）反复微调，写入了非法矩阵。
- **规避**：一律 `absolute=true`，直接给最终位形；改完用
  `catia_list_components(include_position=true)` **读回矩阵确认是单位阵+平移**。

## 坑 6：Product 不能直接测惯量（daiemon12 限制）

- **症状**：`catia_get_inertia` 在装配上返回 "Active document is not a Part document"。
- **规避**：用 rutwikg 的 `catia_mass_properties()`，它走 `Product.Analyze`，装配也能量。

## 坑 7：中文特征名

- **症状**：R21 中文界面下特征名是 `凸台.1` / `草图.1` / `凹槽.1`，按英文名引用会找不到。
- **规避**：只用工具**返回的**名字（`Feature: '凸台.1'`），或先用 `catia_list_features` 查。

## 坑 8：关闭装配会连带关闭组件文档

- **症状**：`catia_activate_document("3-1.CATPart")` 返回成功，但 active 仍是产品；
  紧接着 `set_document_properties` 把编号改到了**产品根节点**上。
- **根因**：零件是作为产品组件加载的，关闭产品后组件文档也一起关；激活不生效。
- **规避**：改零件编号的顺序固定为
  **关产品 → 单独 `open_document` 零件 → 改号 → save → close → 重开产品**。

## 坑 9：新建 part 的 in-work 是几何图形集

- **症状**：`catia_pad` 报 `AddNewPad 失败`；`catia_create_sketch` 把草图建进了 `几何图形集.1`。
- **根因**：`catia_new_part` 之后 in-work 对象是几何图形集，不是实体 `零件几何体`。
- **规避**：先 `catia_set_active_body("零件几何体")`；之后**每次** `catia_create_sketch` 都显式传
  `body="零件几何体"`——建完一个 pad 后 in-work 会切到该特征，再建草图会报
  `'凸台.1' cannot hold sketches`。

## 坑 10：pocket 零切削（最隐蔽）

- **症状**：`catia_pocket` 返回 `ok`，`list_features` 显示 Pocket、`update_status: ok`，
  但**体积一点没变**（982,847 mm³ 与打孔前完全相同）。`reverse=true`、换草图、重开文档都无效。
- **判断方法**：建完孔后测体积，若与"未打孔"的理论值相等 → pocket 是空操作，不是缓存。
- **规避：不要用 pocket**。两条替代路径（都在本环境验证过）：
  1. **回转内腔 → 环形 Pad**：一个草图里画内外两个同心圆，`catia_pad` 直接出管。
     例：Ø220/Ø200 管 = 草图(R110, R100) → pad 16 → 体积 π(110²−100²)×16 = 105,557.5 ✓
  2. **通孔 / 周边缺口 → 多实体布尔减**：
     ```
     catia_new_body("Cutter")
     catia_create_sketch(body="Cutter", support="xy")
     catia_sketch_circle(...)          # 所有孔/缺口圆，一次画完
     catia_pad(length=板厚)
     catia_boolean(operation="remove", tool_body="Cutter")
     ```
     12 个圆一次 Pad + 一次布尔，实测切掉量与 daiemon12 的 pocket 完全一致。

## 坑 11：hole_from_sketch 在本版本不可用

- **症状**：`AddNewHoleFromSketch (无效的参数数目)`、`AddNewHoleFromSketchRef (类型不匹配)`。
- **规避**：同坑 10 的第 2 条，用 pad + boolean 做孔。

## 坑 12：截图不能存 png

- **症状**：`catia_screenshot(path="x.png")` → `This CATIA cannot capture png. Available: bmp, jpeg, tiff`。
- **规避**：路径给 `.jpg`。
