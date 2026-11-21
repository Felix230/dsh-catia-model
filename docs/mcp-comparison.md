# 两个 CATIA MCP 的实测对比

本 skill 的所有命令以 [rutwikg/catia-mcp](https://github.com/rutwikg/catia-mcp) 为准。
同类服务器还有一个 [daiemon12/catia-v5-mcp-server](https://github.com/daiemon12/catia-v5-mcp-server)，
两者都用 COM 自动化驱动 CATIA V5，但实现取向不同。下表是在 **同一台机器、同一个 CATIA 会话、
同一套零件**（3-1 / 3-2 / 3-3 + 3-0 装配）上逐项实测的结果，不是读文档得出的。

| | daiemon12/catia-v5-mcp-server | rutwikg/catia-mcp |
|---|---|---|
| 工具数 | 101 | 161 |
| 传输 | stdio | stdio + HTTP |
| Pad / 环形 Pad | ✅ | ✅ |
| **Pocket（内腔 / 打孔）** | ✅ 正常（回报切除量 502,654.8 mm³） | ❌ **静默空操作**：返回 ok、`update_status: ok`，体积不变 |
| `cir_pattern` 阵列 | ❌ `0x80020009`（part 含几何图形集） | 同环境下大概率同样被拒 |
| `hole_from_sketch` | — | ❌ `AddNewHoleFromSketch (无效的参数数目)` |
| 面枚举 `list_faces` | ❌ `CATIASelection::Search 失败` | ✅ 48 个面，带 owner 归属 |
| 包围盒 | ❌ 同一 API 失败 | ❌（依赖 SPA） |
| 零件质量 / 体积 | ✅ | ✅ |
| **装配质量 / 体积 / 质心** | ❌ `Active document is not a Part document` | ✅ 走 `Product.Analyze` |
| **读装配位置矩阵** | ❌ 恒返回 (0,0,0) | ✅ 真实 12 值矩阵 |
| **移动组件** | ⚠️ 写出**退化矩阵（旋转全 0）** | ✅ 正确，且可回读验证 |
| 改零件编号 | 只能 PartNumber，且会**误改到产品根节点** | ✅ `set_document_properties` + `rename_element` |
| 另存为指定路径 | ✅ | ✅（返回 path/size） |
| 截图 | 存文件 | ✅ **直接返回图片** |
| 能力探测 / 诊断 | `catia_diagnose` | ✅ `capabilities` / `check_environment` / `--doctor` |
| VBScript 逃生舱 | — | ✅ `run_script` |

## 关键差别：失败时谁"骗人"

**daiemon12 的失败是静默篡改。** `move_component` 把旋转矩阵写成全 0，零件位置错了但截图看起来
仍然"像那么回事"，直到用 rutwikg 回读矩阵才发现；`activate_document` 报成功但没真正切换文档，
导致 `set_document_properties` 把编号改到了产品根节点上。

**rutwikg 的失败多数是可检测的拒绝。** pocket 空操作虽然也静默，但一条 `mass_properties` 就能抓住
（体积对不上）；其余失败基本都抛明确错误并给出 remediation。


结论：**daiemon12 会让你带着错误往下走，rutwikg 的错误当场能发现。**

## 结论与建议

| 场景 | 建议 |
|---|---|
| 只做零件建模、大量内腔 / 孔位 | daiemon12（pocket 直接可用，少绕路） |
| 要做装配、要验收、要交付命名 | **rutwikg**（这些能力它独有，且可回读验证） |
| 走完整流程（读图 → 建模 → 验收 → 装配 → 交付） | **rutwikg 为主**，用"环形 Pad + 多实体布尔"绕开 pocket |
| 追求可靠性 | **rutwikg**，因为它的错误可检测 |

本 skill 采用后者：pocket 的两条替代路径见
[references/r21-pitfalls.md](../skills/catia-model/references/r21-pitfalls.md) 的坑 10。

## 复现方式

两者都可以在同一台机器上并存（不同的 DSH MCP 行）。切换时注意：**装配那一步不要用 daiemon12 的
`move_component`**，退化矩阵的坑很隐蔽；需要它的 pocket 时，只让它做切削，摆位和验收交给 rutwikg。
