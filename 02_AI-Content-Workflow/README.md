# V3｜AI 内容工作流

这个项目把素材准备、AI 辅助写作、人工审阅和公众号发布前准备按步骤组织起来。每次进入下一步前，先确认必要的内容已经审阅，而且使用的是当前版本。

本包展示其中的阶段检查和稿件版本核对，配有精简工作说明及电商 AI 测试案例。运行停在“是否可以开始准备发布材料”的检查处，不生成或发布真实公众号文章。

## 业务步骤与对应文件

| 需要处理的事情 | 文件 | 本包提供什么 |
| --- | --- | --- |
| 检查是否可以进入下一步，稿件是否改过 | [check_stage_gate.py](scripts/check_stage_gate.py) | 原项目脚本，核对四个阶段的进入条件和稿件版本 |
| 确认缺少审阅、修改稿件等情况能被识别 | [test_stage_gate.py](scripts/test_stage_gate.py) | 原有 21 项测试 |
| 明确各阶段由谁处理、交付什么 | [WORKFLOW.md](docs/WORKFLOW.md) | 按现有代码整理的工作顺序和交接规则 |
| 从素材写到定稿，再交接发布准备 | [content-writer](skills/content-writer/SKILL.md)、[wechat-package](skills/wechat-package/SKILL.md) | 两份精简 Skill 工作说明，未包含完整生产模板 |
| 对照素材、初稿与终稿的关系 | [素材包](examples/synthetic-case/001_订单分析_素材包.md)、[初稿](examples/synthetic-case/001_订单分析_AI初稿.md)、[终稿](examples/synthetic-case/001_订单分析_最终发布稿.md) | 自行构造的数据和提前设定的确认状态 |
| 找出正文使用的本地图片路径 | [package_references.py](scripts/package_references.py)、[对应测试](scripts/test_package_references.py) | 图片路径提取函数及 3 项测试 |

## 在本地查看检查结果

使用 Python 3.10 及以上，在本目录执行，仅需标准库：

```powershell
python -B -m unittest discover -s scripts -p "test_*.py" -v
python -B scripts/check_stage_gate.py --article-dir examples/synthetic-case --next platform-package
```

第一条运行 24 项测试。第二条核对样例的确认记录和稿件版本；输出“门禁通过”表示进入下一步的测试条件齐全，不是实际审批或发布授权。样例中的“已确认”“已通过”均提前设定。

## 人工与脚本分别负责什么

- Skill 工作说明安排各步骤；人工判断材料、事实、表达和是否同意继续；脚本检查记录和文件版本。
- 脚本能发现缺少确认、重复文件或稿件版本不一致，不能认证审批人的身份，也不能判断文章质量。
- 稿件版本通过内容指纹核对，即根据内容计算出的标识。素材包尚未与初稿建立这种自动关联，素材修改后仍需人工复核。
- 图片函数只提取 Markdown／Obsidian 中的本地路径，不检查图片是否存在、尺寸是否正确或是否清晰。
- 阶段检查脚本和 21 项原有测试保留原实现；两份 Skill 是本次新写的精简说明。本包没有独立模型调用接口，也未包含视觉生成、完整图片检查、实际发布材料和发布功能。
