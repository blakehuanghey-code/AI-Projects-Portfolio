"""固定模拟样例回放；不生成稿件，不进行真实审批或发布。"""
from pathlib import Path
import sys
import json
import re
import shutil
import tempfile
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import check_stage_gate as gate
from package_references import local_image_references


def main():
    records = []
    source = Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory(prefix='portfolio-mock-') as temporary:
        case = Path(temporary)
        for path in source.glob('001_*.md'):
            shutil.copyfile(path, case / path.name)
        material = case / '001_订单分析_素材包.md'
        draft = case / '001_订单分析_AI初稿.md'
        original_material = material.read_text(encoding='utf-8')
        original_draft = draft.read_text(encoding='utf-8')

        def blocked(stage, expected):
            try:
                gate.check_gate(case, stage)
            except ValueError as error:
                assert expected in str(error), str(error)
                records.append({'stage': stage, 'result': '按预期阻断', 'reason': str(error)})
            else:
                raise AssertionError('缺少条件却通过了阶段检查')

        def passed(stage):
            checks = gate.check_gate(case, stage)
            records.append({'stage': stage, 'result': '模拟条件通过', 'checks': checks})

        material.write_text(original_material.replace('素材确认状态：已确认', '素材确认状态：待确认'), encoding='utf-8')
        blocked('ai-draft', '素材确认状态')
        material.write_text(original_material, encoding='utf-8')
        passed('ai-draft')
        draft.write_text(original_draft.replace('母稿确认状态：已确认', '母稿确认状态：待确认'), encoding='utf-8')
        blocked('final', '母稿确认状态')
        draft.write_text(original_draft, encoding='utf-8')
        passed('final')
        gate.record_final(case)
        passed('wording-review')
        draft.write_text(draft.read_text(encoding='utf-8').replace('文字组合确认状态：已确认', '文字组合确认状态：待确认'), encoding='utf-8')
        blocked('platform-package', '文字组合确认状态')
        draft.write_text(original_draft, encoding='utf-8')
        passed('platform-package')
        draft.write_text(original_draft + '\n模拟改稿，验证旧检查不能沿用。\n', encoding='utf-8')
        blocked('final', '已过期')
        references = local_image_references((source / '公众号发布材料.md').read_text(encoding='utf-8'))
        assert references == ['images/cover.png', 'images/order-chart.png']
        for reference in references:
            target = (source / reference).resolve()
            assert source in target.parents and target.is_file()
            assert target.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
        records.append({'stage': '图片交接', 'result': '2 个本地引用对应的 PNG 文件存在', 'references': references})
    return {'synthetic': True, 'confirmationRecords': '模拟预设，不是真实用户审批', 'originalModelCalled': False,
            'published': False, 'userStyleApproval': '本版展示样式已确认；真实发布未授权', 'checksExecuted': True, 'records': records}


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(main(), ensure_ascii=False, indent=2))
