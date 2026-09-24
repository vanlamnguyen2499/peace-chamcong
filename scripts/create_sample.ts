import * as ExcelJS from 'exceljs';
import * as path from 'path';

async function createSample() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('CHẤM VÂN TAY');

  // Headers
  sheet.addRow([
    'MÃ NV', 
    'HỌ TÊN', 
    'Phong ban', 
    'NGÀY', 
    'GIỜ BẤM TAY', 
    'GIỜ VÀO', 
    'GIỜ RA', 
    'ĐI TRỄ', 
    'VỀ SỚM', 
    'CHẤM CÔNG', 
    'TĂNG CA'
  ]);

  // Sample row 1
  sheet.addRow([
    'NV001',
    'Nguyễn Văn A',
    'IT',
    '2026-09-14',
    '07:52 12:00 13:30 17:35', // Multiple logs, will min/max
    '', '', '', '', '', ''
  ]);

  // Sample row 2
  sheet.addRow([
    'NV002',
    'Trần Thị B',
    'KẾ TOÁN',
    '2026-09-14',
    '08:15 19:26', // Only 2 logs
    '', '', '', '', '', ''
  ]);

  // Style header
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach(col => col.width = 15);
  
  const publicDir = path.resolve(process.cwd(), "public");
  await workbook.xlsx.writeFile(path.join(publicDir, 'Mau_Import_Van_Tay.xlsx'));
  console.log('Sample file generated');
}

createSample();
