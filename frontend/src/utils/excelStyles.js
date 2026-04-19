const HEADER_BG = 'FF4472C4';
const TOTAL_BG = 'FFDCE6F1';
const HEADER_FONT_COLOR = 'FFFFFFFF';
const BASE_FONT = { name: 'Arial', size: 10 };

const isNumeric = (v) => v !== null && v !== '' && typeof v === 'number';

export const applyWorkbookStyle = (workbook, { headerRows = [1], totalRow = null } = {}) => {
  workbook.eachSheet((ws) => {
    // Auto column width
    ws.columns.forEach((col) => {
      let maxLen = 8;
      col.eachCell({ includeEmpty: false }, (cell) => {
        const len = String(cell.value ?? '').length;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 2, 30);
    });

    ws.eachRow((row, rowNum) => {
      const isHeader = headerRows.includes(rowNum);
      const isTotal = totalRow !== null && rowNum === totalRow;

      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = isHeader
          ? { ...BASE_FONT, bold: true, color: { argb: HEADER_FONT_COLOR } }
          : isTotal
          ? { ...BASE_FONT, bold: true }
          : { ...BASE_FONT };

        if (isHeader) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (isTotal) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
        }

        if (!isHeader && isNumeric(cell.value)) {
          cell.alignment = { horizontal: 'right' };
        }
      });
    });

    // Freeze header rows
    ws.views = [{ state: 'frozen', ySplit: Math.max(...headerRows) }];
  });
};

export const saveWorkbook = async (workbook, filename) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
