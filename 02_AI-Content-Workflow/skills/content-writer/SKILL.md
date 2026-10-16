---
name: content-writer
description: 精简展示 Skill。说明如何从素材包经过人工确认、质量检查和版本关联交接唯一终稿；不包含完整写作模板或模型调用。
---

# 内容写作交接

这是新写的展示说明，配合仓库中的阶段检查脚本使用，不与完整生产 Skill 等价。
以下命令均在 `02_AI-Content-Workflow` 目录执行。

1. 输入一个具体读者问题、材料与证据范围。形成唯一 `*_素材包.md`，分别记录素材确认状态和关键素材读取状态；未确认时只交付素材包。
2. 实际人工确认后运行 `python -B scripts/check_stage_gate.py --article-dir <内容目录> --next ai-draft`。失败则解决对应缺口，不伪造确认。
3. 形成 `*_AI初稿.md`，核对核心判断、例子和使用条件。记录母稿质量状态与具体依据，通过 `--fingerprint-draft <初稿路径>` 取得当前指纹。展示正文，等待人工确认。
4. 运行 `--next final` 后整理唯一 `*_最终发布稿.md`，通过 `--record-final` 记录关联。该命令只写初稿内部关联字段，不代替用户确认。
5. 运行 `--next wording-review` 后，根据定稿准备标题、开头与指定渠道收尾，同批展示确认。选定文字落实后重核质量及终稿关联，再记录实际确认和 `--fingerprint-wording` 输出。
6. 仅在 `--next platform-package` 通过后交给 [wechat-package](../wechat-package/SKILL.md)。若正文变化，复核受影响内容与对应确认，不沿用过期指纹。

语义质量必须人工审阅；脚本不能证明事实正确。演示数据与预设测试状态不得用作真实审批依据。
