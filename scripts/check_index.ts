import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
const filePath = path.resolve(process.cwd(), 'T9.2026_QUAN_1_Cham_Cong_Theo_Mau.xlsx');
const buffer = fs.readFileSync(filePath);
const workbook = xlsx.read(buffer, { type: 'buffer' });
const sheetName = workbook.SheetNames.find(s => s === 'CHẤM VÂN TAY') || workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
console.log(data[0]); // Header
console.log(data[1]); // First row
console.log(data[2]); // Second row
