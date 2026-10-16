"""真实平台检查器中的纯引用解析函数选摘；不做图像、尺寸或整包验收。"""
from __future__ import annotations
import re
from urllib.parse import unquote

def local_image_references(text: str) -> list[str]:
    references = [ref.split("|", 1)[0] for ref in re.findall(r"!\[\[([^\]]+)\]\]", text)]
    references.extend(
        match.group(1) or match.group(2)
        for match in re.finditer(r'!\[[^\]\n]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+"[^"\n]*")?\s*\)', text)
    )
    return list(dict.fromkeys(unquote(ref) for ref in references
                            if not ref.startswith(("data:", "http://", "https://"))))
