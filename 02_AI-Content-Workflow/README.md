# V3｜AI 内容工作流代码选摘

原项目组织素材、写作、人工确认与公众号制包。本包选取阶段检查和版本关联代码，配合精简展示 Skill 与电商 AI 演示案例，运行截止于制包前的门禁检查。

## 文件索引

| 内容 | 文件 | 本包形式 |
| --- | --- | --- |
| 阶段与版本检查 | [check_stage_gate.py](scripts/check_stage_gate.py) | 原项目脚本，包含四个进入条件及版本关联 |
| 门禁回归测试 | [test_stage_gate.py](scripts/test_stage_gate.py) | 原有 21 项测试 |
| 阶段与职责说明 | [WORKFLOW.md](docs/WORKFLOW.md) | 按现有代码整理的交接规则 |
| 写作与制包交接 | [content-writer](skills/content-writer/SKILL.md)、[wechat-package](skills/wechat-package/SKILL.md) | 新写的精简展示 Skill，未包含完整生产模板 |
| 演示案例 | [素材包](examples/synthetic-case/001_订单分析_素材包.md)、[初稿](examples/synthetic-case/001_订单分析_AI初稿.md)、[终稿](examples/synthetic-case/001_订单分析_最终发布稿.md) | 合成数据与预设状态，用于检查阶段和版本 |
| 图片引用解析 | [package_references.py](scripts/package_references.py)、[对应测试](scripts/test_package_references.py) | 从原检查器选取的解析函数及 3 项测试 |

## 离线运行

使用 Python 3.10 及以上，在本目录执行，仅需标准库：

```powershell
python -B -m unittest discover -s scripts -p "test_*.py" -v
python -B scripts/check_stage_gate.py --article-dir examples/synthetic-case --next platform-package
```

第一条运行 24 项测试。第二条检查示例的确认记录与文件版本；输出“门禁通过”表示测试条件匹配，不是实际审批或发布授权。示例中的“已确认”“已通过”均为预设测试状态。

## 选摘与限制

- 门禁脚本和 21 项原有测试保留原实现；两个 Skill 为精简展示说明，不与完整生产 Skill 等价。
- 这是由 Skill 组织、人工参与的内容工作流。所收录脚本执行确定性检查，没有独立模型推理接口。
- 门禁核对字段、文件唯一性、内容指纹及母稿／终稿关联，不能认证审批人或判断内容质量。素材包未通过内容哈希绑定母稿，素材后改仍需人工复核。
- 图片引用解析只提取 Markdown／Obsidian 中的本地图片路径，不检查文件存在、尺寸或可读性。视觉生成、完整资产检查、实际平台包和发布均未包含。
