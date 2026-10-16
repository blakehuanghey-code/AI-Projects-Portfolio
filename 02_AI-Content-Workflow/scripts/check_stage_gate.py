from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path


DRAFT_METADATA = (
    "母稿确认状态", "母稿质量状态", "母稿质量依据", "母稿质量指纹",
    "终稿来源指纹", "终稿文件指纹", "文字组合确认状态", "文字组合确认指纹",
)


def find_one(article_dir: Path, pattern: str, label: str) -> Path:
    matches = sorted(article_dir.glob(pattern))
    if len(matches) != 1:
        names = ", ".join(path.name for path in matches) or "无"
        raise ValueError(f"{label}必须恰好有1份；当前：{names}")
    return matches[0]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def field_pattern(field: str) -> str:
    return rf"^[ \t]*[-*]?[ \t]*{re.escape(field)}[ \t]*[：:][ \t]*([^\r\n]*)$"


def field_value(path: Path, field: str) -> str:
    values = re.findall(field_pattern(field), read_text(path), flags=re.MULTILINE)
    if len(values) != 1 or not values[0].strip():
        raise ValueError(f"{path.name} 缺少唯一且非空的“{field}”记录")
    return values[0].strip()


def require_state(path: Path, field: str, state: str) -> None:
    if not re.match(rf"{re.escape(state)}(?:\s|（|\(|$)", field_value(path, field)):
        raise ValueError(f"{path.name} 的“{field}”必须为“{state}”；先完成对应检查或确认")


def draft_fingerprint(path: Path) -> str:
    patterns = [re.compile(field_pattern(field)) for field in DRAFT_METADATA]
    lines = [line for line in read_text(path).splitlines()
             if not any(pattern.match(line) for pattern in patterns)]
    return hashlib.sha256(("\n".join(lines).strip() + "\n").encode("utf-8")).hexdigest()


def wording_fingerprint(article_dir: Path) -> str:
    draft = find_one(article_dir, "*_AI初稿.md", "AI初稿")
    final = find_one(article_dir, "*_最终发布稿.md", "最终发布稿")
    content = draft_fingerprint(draft) + ":" + hashlib.sha256(final.read_bytes()).hexdigest()
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def check_gate(article_dir: Path, next_stage: str) -> list[str]:
    material = find_one(article_dir, "*_素材包.md", "素材包")
    require_state(material, "素材确认状态", "已确认")
    require_state(material, "关键素材读取状态", "已核对")
    checked = ["素材确认与关键素材读取记录：通过"]
    if next_stage == "ai-draft":
        return checked

    draft = find_one(article_dir, "*_AI初稿.md", "AI初稿")
    require_state(draft, "母稿确认状态", "已确认")
    require_state(draft, "母稿质量状态", "已通过")
    field_value(draft, "母稿质量依据")
    fingerprint = draft_fingerprint(draft)
    if field_value(draft, "母稿质量指纹") != fingerprint:
        raise ValueError("母稿质量检查已过期：内容已变，须复核并更新质量依据与指纹")
    checked.append("母稿确认与当前版本编辑检查记录：通过（语义依据须实际审读）")

    if next_stage in ("wording-review", "platform-package"):
        final = find_one(article_dir, "*_最终发布稿.md", "最终发布稿")
        if field_value(draft, "终稿来源指纹") != fingerprint:
            raise ValueError("终稿对应的母稿已变；先核对当前终稿，再记录关联")
        if field_value(draft, "终稿文件指纹") != hashlib.sha256(final.read_bytes()).hexdigest():
            raise ValueError("终稿文件已变；先核对当前终稿，再记录关联")
        checked.append("母稿与终稿当前版本关联：通过")
    if next_stage == "platform-package":
        require_state(draft, "文字组合确认状态", "已确认")
        if field_value(draft, "文字组合确认指纹") != wording_fingerprint(article_dir):
            raise ValueError("文字组合确认对应旧版本；按最终内容复核受影响的标题、开头、收尾与投票，确认后再设计图片")
        checked.append("定稿后的文字组合确认：通过，可以设计图片")
    return checked


def record_final(article_dir: Path) -> list[str]:
    checked = check_gate(article_dir, "final")
    draft = find_one(article_dir, "*_AI初稿.md", "AI初稿")
    final = find_one(article_dir, "*_最终发布稿.md", "最终发布稿")
    text = read_text(draft)
    for field in ("终稿来源指纹", "终稿文件指纹"):
        text = re.sub(field_pattern(field) + r"\n?", "", text, flags=re.MULTILINE)
    text = text.rstrip() + "\n"
    text += f"- 终稿来源指纹：{draft_fingerprint(draft)}\n"
    text += f"- 终稿文件指纹：{hashlib.sha256(final.read_bytes()).hexdigest()}\n"
    draft.write_text(text, encoding="utf-8")
    return checked + ["已记录当前终稿关联；仅写初稿内部元数据，未改变正文或用户确认"]


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="核对V3确认、内部质量记录及当前稿件版本。")
    parser.add_argument("--article-dir", type=Path)
    actions = parser.add_mutually_exclusive_group(required=True)
    actions.add_argument("--next", choices=("ai-draft", "final", "wording-review", "platform-package"), dest="next_stage")
    actions.add_argument("--fingerprint-draft", type=Path)
    actions.add_argument("--record-final", action="store_true")
    actions.add_argument("--fingerprint-wording", action="store_true")
    args = parser.parse_args()
    try:
        if args.fingerprint_draft:
            print(draft_fingerprint(args.fingerprint_draft))
            return 0
        if not args.article_dir:
            parser.error("当前动作需要 --article-dir")
        article_dir = args.article_dir.resolve()
        if not article_dir.is_dir():
            raise ValueError(f"内容目录不存在：{article_dir}")
        if args.fingerprint_wording:
            check_gate(article_dir, "wording-review")
            print(wording_fingerprint(article_dir))
            return 0
        checked = record_final(article_dir) if args.record_final else check_gate(article_dir, args.next_stage)
    except (OSError, UnicodeError, ValueError) as error:
        print(f"门禁未通过：{error}", file=sys.stderr)
        return 2
    print("关联记录完成" if args.record_final else f"门禁通过：可以进入 {args.next_stage}")
    for item in checked:
        print(f"- {item}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
