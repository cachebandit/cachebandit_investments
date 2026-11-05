import unittest

from services.stock_service import _clean_value


class CleanValueTests(unittest.TestCase):
    def test_non_finite_values_become_none(self):
        for value in (float("nan"), float("inf"), float("-inf")):
            with self.subTest(value=value):
                self.assertIsNone(_clean_value(value))

    def test_finite_values_are_preserved(self):
        self.assertEqual(_clean_value(12.5), 12.5)
        self.assertEqual(_clean_value("N/A"), "N/A")


if __name__ == "__main__":
    unittest.main()
