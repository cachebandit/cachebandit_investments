import importlib
import os
import sys
import tempfile
import unittest
from pathlib import Path


class BuildStaticTests(unittest.TestCase):
    def setUp(self):
        self.repo_root = Path(__file__).resolve().parents[1]
        self.temp_dir = tempfile.TemporaryDirectory(dir=self.repo_root)
        self.addCleanup(self.temp_dir.cleanup)

        self.original_cwd = os.getcwd()
        self.addCleanup(os.chdir, self.original_cwd)
        os.chdir(self.temp_dir.name)

        sys.path.insert(0, str(self.repo_root))
        self.addCleanup(sys.path.remove, str(self.repo_root))

        (Path("html") / "css").mkdir(parents=True, exist_ok=True)
        (Path("html") / "js").mkdir(parents=True, exist_ok=True)
        (Path("cache")).mkdir(parents=True, exist_ok=True)

        (Path("html") / "watchlist.html").write_text(
            '<link rel="stylesheet" href="css/styles.css">\n'
            '<script type="module" src="./js/main.js"></script>\n'
            '<img src="cachebandit_logo.png" alt="logo">',
            encoding="utf-8",
        )
        (Path("html") / "css" / "styles.css").write_text("body{color:black;}", encoding="utf-8")
        (Path("html") / "js" / "main.js").write_text("console.log('main');", encoding="utf-8")
        (Path("cache") / "stock_data.json").write_text(
            '{"last_updated": "01/01 12:00 AM", "data": {"stocks:saved_stock_info:Information Technology": []}}',
            encoding="utf-8",
        )

        self.build_static = importlib.import_module("build_static")
        self.build_static = importlib.reload(self.build_static)

    def test_main_versions_local_assets_in_generated_html(self):
        self.build_static.main()

        built_html = (Path("site") / "html" / "watchlist.html").read_text(encoding="utf-8")

        self.assertIn('css/styles.css?v=', built_html)
        self.assertIn('./js/main.js?v=', built_html)
        self.assertIn('cachebandit_logo.png?v=', built_html)


if __name__ == "__main__":
    unittest.main()
