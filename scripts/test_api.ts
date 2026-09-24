import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const filePath = path.resolve(process.cwd(), 'T9.2026_QUAN_1_Cham_Cong_Theo_Mau.xlsx');
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames.find(s => s === 'CHẤM VÂN TAY') || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  
  for (let i = 1; i < 5; i++) {
    const row = rows[i];
    const excelLate = parseInt(String(row[7] || 0)) || 0;
    const excelEarly = parseInt(String(row[8] || 0)) || 0;
    const excelUnits = parseFloat(String(row[9] || 0)) || 0.0;
    const excelOt = parseFloat(String(row[10] || 0)) || 0.0;
    console.log(`Row ${i}: excelUnits = ${excelUnits}, late = ${excelLate}, early = ${excelEarly}, ot = ${excelOt}`);
  }
}
main();
