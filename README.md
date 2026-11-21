# dsh-catia-model

让 AI agent 按**二维工程图的标注尺寸**在 CATIA V5 里建模，并用体积/质心/质量做**定量回测**的
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。

> A DSH bundle shipping the `catia-model` agent skill: build CATIA V5 parts from 2D drawing
> annotations (never from measured pixels), verify them against the drawing weight, and avoid
> the 12 documented V5R21 pitfalls.

---

## 为什么需要它

用 LLM 建模 CAD 的难点不是"画不出来"，而是**画出来的东西看着对、数值错**。这套 skill 来自一次
真实的完整交付（1 张装配图 + 3 张零件图 → 3 个 CATPart + 1 个 CATProduct），把过程中踩的坑固化成规则：

| 坑 | 症状 | 后果 |
|---|---|---|
| 用图上量的比例反推尺寸 | 标称 1:2.5、实测 1:2.43 | 整个模型偏 2.9% |
| `pocket` 空操作 | 返回 `ok`、`update_status: ok` | 体积一点没变，孔没切出来 |
| 三段 Pad 从同一基准面叠加 | 最小内径贯穿全长 | 体积错 13% |
| `create_sketch` 不传 `body` | 草图落进几何图形集 | `AddNewPad 失败` |
| `move_component` 不用 `absolute` | 写入退化矩阵（旋转全 0） | 装配位形错乱 |
| 改 `Part.Name` | R21 里只读 | 报 `方法 Name 失败` |

## 安装

```bash
# 从本地目录
dsh plugin --profile <profile> add /path/to/dsh-catia-model

# 或从 git
dsh plugin --profile <profile> add https://github.com/Felix230/dsh-catia-model
```

安装后 `catia-model` 会出现在会话的 skill 目录里，说一句"用 catia-model 建这个零件"即可加载，
agent 也可以按任务自动匹配。

不想做成插件也可以：把 `skills/catia-model/` 整个复制到 `~/.agents/skills/catia-model/`，
DSH 的 `skill-filesystem` provider 会自动加载（与本插件等效，且零配置）。

## 使用

```
把这张图纸（PDF）里的零件建出来，按标注尺寸，建完用质量回测
```

skill 会引导 agent 走 7 步：取数（视觉，只读标注）→ 建 IR → 校验闸门（守恒/闭合）→
建模（环形 Pad + 多实体布尔）→ 定量回测（体积 0.1% / 质量 5%）→ 装配（绝对定位 + Product.Analyze 验收）
→ 命名与交付（PartNumber、`deviations.md`）。

## 环境要求

- **Windows** + **CATIA V5**（在 V5-6R2021 / B21 上验证；R14–V5-6Rxxxx 理论兼容）
- 一个 MCP server：[rutwikg/catia-mcp](https://github.com/rutwikg/catia-mcp)（161 工具）。
  本 skill 的所有命令名、参数都以它为准。
- 已在*缺 SPA（测量）工作台*的 CATIA 会话上验证——这恰恰是最苛刻的情况：约束、邻近点引用、
  `measure` 都不可用，skill 给出了绕过路径。

## 目录

```
dsh-catia-model/
├── package.json          # dsh.bundle.patch 指向 cordis.patch.yml
├── cordis.patch.yml      # 挂载本包（本身无运行时代码）
├── index.js              # no-op ESM 插件，只为让 loader 能 import
└── skills/catia-model/
    ├── SKILL.md              # 7 步工作流 + 4 条铁律
    └── references/
        ├── r21-pitfalls.md   # 12 个坑：症状 / 根因 / 规避
        └── verification.md   # 回测公式、阈值、密度表、基线数据
```

## 回测基线（可用于回归测试）

| 件 | 体积 | 质量 | 图纸标重 | 偏差 |
|---|---|---|---|---|
| 压盖 | 441,225.33 mm³ | 3.4989 kg | 3.2 kg | +9.3%（外径假设 310） |
| 窗框 | 832,432.34 mm³ | 6.6012 kg | 6.3 kg | +4.8% |
| 玻璃 | 1,081,238.80 mm³ | 2.7031 kg | 2 kg | +35%（疑夹层/中空） |
| 装配 | 2,354,896.46 mm³ | — | 11.8 kg | — |

换 CATIA 版本后，先用"压盖"跑一遍：体积应回到 **441,225.33 mm³**，否则说明构造规则需要重新核对。

## 许可

MIT，见 [LICENSE](LICENSE)。

CATIA 是 Dassault Systèmes 的注册商标。本仓库只提供建模流程与规则，不包含也不替代 CATIA，
使用者需要自己的 CATIA 安装与许可。
