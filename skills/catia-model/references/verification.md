# 回测公式、阈值与基线数据

## 一、体积公式（建模后手算，与 CATIA 实测比对）

- 圆柱：`V = π r² h`
- 圆环（外径 Do、内径 Di、厚 t）：`V = π/4 (Do² − Di²) t`
- 叠环：分段求和，注意**内孔是否贯穿**
- 带孔平板：`V = 板体积 − Σ(π/4 d² t)`
- 台阶缺口（R r 的圆在半径 R0 处切边）：每处面积
  `A ≈ r²·arccos((R0²+r²−R0²)/(2·R0·r)) + R0²·arccos((R0²+R0²−r²)/(2R0²)) − 0.5·√(…三角边积)`
  （工程上更快的办法：先用 CATIA 实测，再反算，确认量级）

## 二、阈值

| 检查 | 阈值 | 不通过的含义 |
|---|---|---|
| 体积 vs 手算 | ≤ 0.1% | 构造错了（多/少特征、内孔贯穿、高度错） |
| 质量 vs 图纸标重 | ≤ 5% | 尺寸理解错了（直径/厚度） |
| 质心 z | 与结构直觉一致 | 某段位置错 |
| 装配整机体积 | **= Σ 分件体积（精确相等）** | 不相等 = 零件互相重叠或缺失 |
| 装配质心 | = 按体积加权的分件质心 | 不相等 = 位形错 |

## 三、密度

| 材料 | ρ (kg/m³) |
|---|---|
| 06Cr19Ni10 / 304 | **7930** |
| 碳钢 | 7850 |
| 超白钢化玻璃 | 2500（低于 2.0 说明可能是夹层/中空） |
| 石棉橡胶板 | ~1800 |

## 四、本案基线（可用于对照同类零件）

| 件 | 图重 | 实建体积 | 实建质量 | 偏差 | 备注 |
|---|---|---|---|---|---|
| 3-1 压盖 | 3.2 kg | 441.225 cm³ | 3.499 kg | +9.3% | 外径取 310（若 300 则 3.12kg/−2.5%，质量证据倾向 300） |
| 3-2 窗框 | 6.3 kg | 833.052 cm³ | 6.606 kg | **+4.9%** | 三段环 15/16/7，最后一段内孔 Ø211 |
| 3-3 玻璃 | 2 kg | 1081.239 cm³ | 2.703 kg | **+35%** | 疑夹层/中空；若只计 Ø216×21 段则 1.92kg（近 2kg） |
| 3-0 装配 | 11.8 kg | 2355.516 cm³ | — | — | = 三件之和（精确），质心 z=14.626 |

## 五、命令速查（rutwikg）

```
catia_new_part(name)
catia_create_sketch(support="xy")
catia_sketch_circle(center_x, center_y, radius)      # 一个草图可多次调用
catia_pad(length, sketch)
catia_pocket(depth, sketch)
catia_mass_properties(density=7930)
catia_list_faces()                                   # 有 owner，无 metrics
catia_new_product(part_number) / catia_add_component(paths=[...])
catia_move_component(instance_name, x,y,z,rx, absolute=True)
catia_set_document_properties(part_number="3-1", revision="A")
catia_rename_element(token="name:Part1.1", new_name="3-1.1")
catia_screenshot(path=..., orientation="isometric")
catia_save_document(path=...)
```
