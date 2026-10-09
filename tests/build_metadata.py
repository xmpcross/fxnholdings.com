import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '_src'))
import build
import insights

class MetadataTests(unittest.TestCase):
    def test_dates_preserve_publication_and_feed(self):
        with tempfile.TemporaryDirectory() as temp:
            src = Path(temp)
            (src / 'posts').mkdir()
            post = src / 'posts' / 'example.md'
            base = '---\ntitle: Example\ndate: 2020-01-01\ncategory: start-a-business\nsummary: Example summary\n'
            post.write_text(base + 'updated: 2020-02-01\n---\nBody\n')
            posts = insights.load_posts(src, False)
            meta, body = list(insights.pages(posts, build.SITE))[-1]
            article = meta['jsonld_extra'][0]
            self.assertEqual(article['datePublished'], '2020-01-01')
            self.assertEqual(article['dateModified'], '2020-02-01')
            self.assertIn('Updated <time datetime="2020-02-01">', body)
            self.assertIn('01 Jan 2020', insights.feed(posts, build.SITE))
            for invalid in ['2019-12-31', (dt.date.today() + dt.timedelta(days=1)).isoformat()]:
                post.write_text(base + f'updated: {invalid}\n---\nBody\n')
                with self.assertRaises(SystemExit):
                    insights.load_posts(src, False)
            post.write_text(base + '---\nBody\n')
            posts = insights.load_posts(src, False)
            self.assertEqual(posts[0]['updated'], posts[0]['date'])
            self.assertNotIn('Updated <time', list(insights.pages(posts, build.SITE))[-1][1])

    def test_sitemap_does_not_invent_dates(self):
        original_root = build.ROOT
        try:
            with tempfile.TemporaryDirectory() as temp:
                build.ROOT = Path(temp)
                page, shared = build.ROOT / 'page.html', build.ROOT / 'template.html'
                page.write_text('page')
                shared.write_text('template')
                def git(*args):
                    return subprocess.run(['git', *args], cwd=temp, check=True, capture_output=True,
                        env={**os.environ, 'GIT_AUTHOR_DATE':'2020-01-02T12:00:00Z', 'GIT_COMMITTER_DATE':'2020-01-02T12:00:00Z'})
                self.assertIsNone(build.last_changed(page))
                git('init')
                git('add', '.')
                git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture')
                self.assertEqual(build.last_changed(page, shared), '2020-01-02')
                shared.write_text('changed template')
                self.assertIsNone(build.last_changed(page, shared))
                self.assertNotIn('<lastmod>', build.sitemap([('/', build.last_changed(page, shared))]))
                self.assertIn('<lastmod>2020-01-02</lastmod>', build.sitemap([('/', '2020-01-02')]))
        finally:
            build.ROOT = original_root

if __name__ == '__main__':
    unittest.main()
