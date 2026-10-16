from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("check_stage_gate.py")
SPEC = importlib.util.spec_from_file_location("check_stage_gate", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class StageGateTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.article_dir = Path(self.temp_dir.name)
        self.material = self.article_dir / "001_测试_素材包.md"
        self.draft = self.article_dir / "001_测试_AI初稿.md"
        self.final = self.article_dir / "001_测试_最终发布稿.md"
        self.material.write_text("- 素材确认状态：已确认（测试夹具）\n- 关键素材读取状态：已核对（仅测试）\n", encoding="utf-8")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def reviewed_draft(self) -> None:
        self.draft.write_text("# 测试稿\n\n- 母稿确认状态：已确认（测试夹具）\n\n## 正文\n\n按原表区分订单与明细行，再计算客单价。\n\n- 母稿质量状态：已通过\n- 母稿质量依据：正文以订单号去重说明分母，保留人工复算；本例不代表真实业务已验证。\n", encoding="utf-8")
        digest = MODULE.draft_fingerprint(self.draft)
        with self.draft.open("a", encoding="utf-8") as stream:
            stream.write(f"- 母稿质量指纹：{digest}\n")

    def test_material_readiness_allows_draft(self) -> None:
        self.assertEqual(len(MODULE.check_gate(self.article_dir, "ai-draft")), 1)

    def test_confirmation_cannot_replace_unread_key_images(self) -> None:
        self.material.write_text("- 素材确认状态：已确认\n- 关键素材读取状态：待补（关键图未读）\n", encoding="utf-8")
        for stage in ("ai-draft", "final", "platform-package"):
            with self.subTest(stage=stage), self.assertRaisesRegex(ValueError, "关键素材读取状态"):
                MODULE.check_gate(self.article_dir, stage)

    def test_legacy_missing_readiness_does_not_bypass_downstream(self) -> None:
        self.material.write_text("- 素材确认状态：已确认\n", encoding="utf-8")
        for stage in ("ai-draft", "final", "platform-package"):
            with self.subTest(stage=stage), self.assertRaisesRegex(ValueError, "关键素材读取状态"):
                MODULE.check_gate(self.article_dir, stage)

    def test_unused_attachment_can_be_excluded(self) -> None:
        self.material.write_text("- 素材确认状态：已确认\n- 关键素材读取状态：已核对（正文支撑采用范围，未读附件明确排除）\n", encoding="utf-8")
        MODULE.check_gate(self.article_dir, "ai-draft")

    def test_reading_does_not_replace_user_confirmation(self) -> None:
        self.material.write_text("- 素材确认状态：待确认\n- 关键素材读取状态：已核对\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "素材确认状态"):
            MODULE.check_gate(self.article_dir, "ai-draft")

    def test_conflicting_confirmations_block(self) -> None:
        with self.material.open("a", encoding="utf-8") as stream:
            stream.write("- 素材确认状态：待确认\n")
        with self.assertRaisesRegex(ValueError, "唯一"):
            MODULE.check_gate(self.article_dir, "ai-draft")

    def test_blank_field_does_not_read_next_line_as_value(self) -> None:
        self.material.write_text("- 素材确认状态：\n已确认\n- 关键素材读取状态：已核对\n", encoding="utf-8")
        with self.assertRaises(ValueError):
            MODULE.check_gate(self.article_dir, "ai-draft")

    def test_pending_draft_blocks_final(self) -> None:
        self.draft.write_text("- 母稿确认状态：待确认\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "母稿确认状态"):
            MODULE.check_gate(self.article_dir, "final")

    def test_confirmation_without_editing_review_blocks_final(self) -> None:
        self.draft.write_text("- 母稿确认状态：已确认\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "母稿质量状态"):
            MODULE.check_gate(self.article_dir, "final")

    def test_current_review_allows_final(self) -> None:
        self.reviewed_draft()
        MODULE.check_gate(self.article_dir, "final")

    def test_review_needs_concrete_record(self) -> None:
        self.reviewed_draft()
        text = self.draft.read_text(encoding="utf-8")
        self.draft.write_text("\n".join(line for line in text.splitlines() if not line.startswith("- 母稿质量依据")), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "母稿质量依据"):
            MODULE.check_gate(self.article_dir, "final")

    def test_content_change_invalidates_review(self) -> None:
        self.reviewed_draft()
        with self.draft.open("a", encoding="utf-8") as stream:
            stream.write("\n新增一个尚未审读的结论。\n")
        with self.assertRaisesRegex(ValueError, "过期"):
            MODULE.check_gate(self.article_dir, "final")

    def test_confirmation_date_does_not_invalidate_content_review(self) -> None:
        self.reviewed_draft()
        text = self.draft.read_text(encoding="utf-8").replace("已确认（测试夹具）", "已确认（仅修改记录日期）")
        self.draft.write_text(text, encoding="utf-8")
        MODULE.check_gate(self.article_dir, "final")

    def test_existing_unlinked_final_cannot_start_package(self) -> None:
        self.reviewed_draft()
        self.final.write_text("# 旧终稿\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "终稿来源指纹"):
            MODULE.check_gate(self.article_dir, "platform-package")

    def test_record_final_preserves_body_and_allows_package(self) -> None:
        self.reviewed_draft()
        self.final.write_text("# 测试终稿\n按订单号去重。\n", encoding="utf-8")
        original = MODULE.draft_fingerprint(self.draft)
        MODULE.record_final(self.article_dir)
        MODULE.record_final(self.article_dir)
        self.assertEqual(original, MODULE.draft_fingerprint(self.draft))
        self.assertEqual(len(MODULE.check_gate(self.article_dir, "wording-review")), 3)
        self.confirm_wording()
        self.assertEqual(len(MODULE.check_gate(self.article_dir, "platform-package")), 4)

    def confirm_wording(self) -> None:
        with self.draft.open("a", encoding="utf-8") as stream:
            stream.write("- 文字组合确认状态：已确认（仅测试夹具）\n")
            stream.write(f"- 文字组合确认指纹：{MODULE.wording_fingerprint(self.article_dir)}\n")

    def test_finalized_body_allows_wording_review_but_not_design(self) -> None:
        self.reviewed_draft()
        self.final.write_text("# 正文已定稿\n按订单号去重。\n", encoding="utf-8")
        MODULE.record_final(self.article_dir)
        MODULE.check_gate(self.article_dir, "wording-review")
        with self.assertRaisesRegex(ValueError, "文字组合确认状态"):
            MODULE.check_gate(self.article_dir, "platform-package")

    def test_unfinalized_body_cannot_enter_wording_review(self) -> None:
        self.draft.write_text("- 母稿确认状态：待确认\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "母稿确认状态"):
            MODULE.check_gate(self.article_dir, "wording-review")

    def test_revised_final_invalidates_wording_even_after_relink(self) -> None:
        self.reviewed_draft()
        self.final.write_text("# 原标题\n按订单号去重。\n", encoding="utf-8")
        MODULE.record_final(self.article_dir)
        self.confirm_wording()
        self.final.write_text("# 修改后的标题\n按订单号去重。\n", encoding="utf-8")
        MODULE.record_final(self.article_dir)
        with self.assertRaisesRegex(ValueError, "文字组合确认对应旧版本"):
            MODULE.check_gate(self.article_dir, "platform-package")

    def test_changed_poll_invalidates_wording_even_if_final_is_unchanged(self) -> None:
        self.reviewed_draft()
        self.final.write_text("# 测试终稿\n按订单号去重。\n", encoding="utf-8")
        MODULE.record_final(self.article_dir)
        self.confirm_wording()
        text = self.draft.read_text(encoding="utf-8")
        self.draft.write_text(text + "\n已选投票：改为另一个问题\n", encoding="utf-8")
        old = MODULE.field_value(self.draft, "母稿质量指纹")
        text = self.draft.read_text(encoding="utf-8")
        self.draft.write_text(text.replace(old, MODULE.draft_fingerprint(self.draft)), encoding="utf-8")
        MODULE.record_final(self.article_dir)
        with self.assertRaisesRegex(ValueError, "文字组合确认对应旧版本"):
            MODULE.check_gate(self.article_dir, "platform-package")

    def test_changed_final_requires_recheck(self) -> None:
        self.reviewed_draft()
        self.final.write_text("# 原终稿\n", encoding="utf-8")
        MODULE.record_final(self.article_dir)
        self.final.write_text("# 另一个终稿\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "终稿文件已变"):
            MODULE.check_gate(self.article_dir, "platform-package")

    def test_changed_reviewed_draft_does_not_reuse_old_final(self) -> None:
        self.reviewed_draft()
        self.final.write_text("# 原终稿\n", encoding="utf-8")
        MODULE.record_final(self.article_dir)
        text = self.draft.read_text(encoding="utf-8").replace("再计算客单价", "明确退款口径后计算客单价")
        self.draft.write_text(text, encoding="utf-8")
        old = MODULE.field_value(self.draft, "母稿质量指纹")
        new = MODULE.draft_fingerprint(self.draft)
        self.draft.write_text(text.replace(f"母稿质量指纹：{old}", f"母稿质量指纹：{new}"), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "对应的母稿已变"):
            MODULE.check_gate(self.article_dir, "platform-package")


if __name__ == "__main__":
    unittest.main()
