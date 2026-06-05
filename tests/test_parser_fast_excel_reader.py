import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from openpyxl import Workbook

from backend import parser


class ParserFastExcelReaderTests(unittest.TestCase):
    def test_fast_reader_loads_xlsx_without_pandas_read_excel(self):
        with TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "sample.xlsx"
            wb = Workbook()
            ws = wb.active
            ws.title = "Timesheet"
            ws.append(["员工", "开始日期", "合计", "合计"])
            ws.append(["Alice", "2026-01-02", 8, ""])
            wb.create_sheet("Audit").append(["key", "value"])
            wb.save(path)

            with patch("backend.parser.pd.read_excel", side_effect=AssertionError("slow path used")):
                workbook = parser._read_excel_workbook(str(path))

        self.assertEqual(set(workbook), {"Timesheet", "Audit"})
        timesheet = workbook["Timesheet"]
        self.assertEqual(timesheet.shape, (1, 4))
        self.assertEqual(list(timesheet.columns), ["员工", "开始日期", "合计", "合计"])
        self.assertEqual(timesheet.iloc[0, 0], "Alice")
        self.assertEqual(str(timesheet.iloc[0, 1]), "2026-01-02")


if __name__ == "__main__":
    unittest.main()
