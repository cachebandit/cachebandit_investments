import tempfile
import unittest
from pathlib import Path

from models.stock_cache import StockCache


class StockCacheTests(unittest.TestCase):
    def test_save_rejects_non_finite_values_without_truncating_cache(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_path = Path(temp_dir) / "stock_data.json"
            cache_path.write_text("existing cache", encoding="utf-8")

            cache = object.__new__(StockCache)
            cache.cache_file = str(cache_path)
            cache.data = {"invalid": float("nan")}

            with self.assertRaises(ValueError):
                cache.save()

            self.assertEqual(cache_path.read_text(encoding="utf-8"), "existing cache")


if __name__ == "__main__":
    unittest.main()
