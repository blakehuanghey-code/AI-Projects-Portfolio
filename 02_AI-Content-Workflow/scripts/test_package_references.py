"""新增展示测试：只测试原检查器的纯引用解析函数。"""
import unittest
from package_references import local_image_references

class ReferenceTest(unittest.TestCase):
    def test_markdown_and_wiki_paths(self):
        text = '![图](<images/synthetic card.png>) ![[images/另一张.png|1080]]'
        self.assertEqual(local_image_references(text), ['images/另一张.png', 'images/synthetic card.png'])

    def test_remote_urls_excluded_and_local_duplicates_removed(self):
        text = '![一](images/a.png) ![二](images/a.png) ![远程](https://example.invalid/a.png)'
        self.assertEqual(local_image_references(text), ['images/a.png'])

    def test_encoded_path_and_empty_text(self):
        self.assertEqual(local_image_references('![图](images/a%20b.png)'), ['images/a b.png'])
        self.assertEqual(local_image_references('没有图片'), [])

if __name__ == '__main__':
    unittest.main()
