import ExcelJS from 'exceljs';

export interface TimesheetSummaryRow {
  employeeCode: string;
  name: string;
  department: string;
  branch: string;
  position: string;
  standardWorkUnits: number; // Công chuẩn tháng
  actualWorkUnits: number;   // Công thực tế
  totalWorkHours: number;    // Giờ làm việc
  lateMinutes: number;       // Phút đi muộn
  earlyMinutes: number;      // Phút về sớm
  otHours: number;           // Giờ làm thêm
  paidLeaveDays: number;     // Nghỉ phép hưởng lương
  unpaidLeaveDays: number;   // Nghỉ không lương
  finalPayableUnits: number; // Tổng công tính lương
}

export interface TimesheetDailyDetail {
  employeeCode: string;
  name: string;
  department: string;
  dailyData: {
    [dayNumber: number]: {
      inTime?: string;
      outTime?: string;
      workUnits?: number;
      status?: string;
    };
  };
}

export async function generateTimesheetExcelBuffer(
  month: number,
  year: number,
  summaryList: TimesheetSummaryRow[],
  dailyDetails: TimesheetDailyDetail[],
  daysInMonth: number
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PEACE GapoWork Attendance System';
  workbook.lastModifiedBy = 'PEACE HR';
  workbook.created = new Date();

  // ==================== SHEET 1: TỔNG HỢP CÔNG ====================
  const wsSummary = workbook.addWorksheet(`Tổng Hợp T${month}-${year}`);

  // Header Title
  wsSummary.mergeCells('A1:N1');
  const titleCell = wsSummary.getCell('A1');
  titleCell.value = `BẢNG TỔNG HỢP CÔNG VÀ GIỜ LÀM VIỆC - THÁNG ${month}/${year}`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00BA74' } };
  wsSummary.getRow(1).height = 35;

  // Subtitle
  wsSummary.mergeCells('A2:N2');
  const subCell = wsSummary.getCell('A2');
  subCell.value = `Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')} | Hệ thống Chấm công & Phê duyệt`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSummary.getRow(2).height = 20;

  // Table Columns
  const headers = [
    'STT',
    'Mã NV',
    'Họ và Tên',
    'Phòng Ban',
    'Chi Nhánh',
    'Chức Danh',
    'Công Chuẩn',
    'Công Thực Tế',
    'Tổng Giờ Làm (h)',
    'Đi Muộn (phút)',
    'Về Sớm (phút)',
    'Giờ Tăng Ca OT (x2)',
    'Nghỉ Phép (ngày)',
    'TỔNG CÔNG TÍNH LƯƠNG',
  ];

  const headerRow = wsSummary.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  });

  // Populate data
  summaryList.forEach((row, idx) => {
    const dataRow = wsSummary.addRow([
      idx + 1,
      row.employeeCode,
      row.name,
      row.department,
      row.branch,
      row.position,
      row.standardWorkUnits,
      row.actualWorkUnits,
      row.totalWorkHours,
      row.lateMinutes,
      row.earlyMinutes,
      row.otHours,
      row.paidLeaveDays,
      row.finalPayableUnits,
    ]);
    dataRow.height = 22;

    dataRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (colNumber === 1 || colNumber === 2) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colNumber === 3 || colNumber === 4 || colNumber === 5 || colNumber === 6) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (colNumber === 14) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { bold: true, color: { argb: 'FF00BA74' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F8F1' } };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });
  });

  // Auto-fit column widths for Sheet 1
  wsSummary.columns = [
    { width: 6 },
    { width: 12 },
    { width: 24 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 13 },
    { width: 13 },
    { width: 16 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 22 },
  ];

  // ==================== SHEET 2: CHI TIẾT THEO NGÀY ====================
  const wsDetail = workbook.addWorksheet(`Chi Tiết T${month}-${year}`);

  const detailHeaders: string[] = ['STT', 'Mã NV', 'Họ Tên', 'Phòng Ban'];
  for (let d = 1; d <= daysInMonth; d++) {
    detailHeaders.push(`N${d}`);
  }

  const detailHeaderRow = wsDetail.addRow(detailHeaders);
  detailHeaderRow.height = 24;
  detailHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  });

  dailyDetails.forEach((row, idx) => {
    const rowValues: any[] = [idx + 1, row.employeeCode, row.name, row.department];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayData = row.dailyData[d];
      if (dayData) {
        if (dayData.status === 'LEAVE') {
          rowValues.push('P');
        } else if (dayData.status === 'ABSENT') {
          rowValues.push('V');
        } else if (dayData.workUnits !== undefined && dayData.workUnits > 0) {
          rowValues.push(dayData.workUnits);
        } else {
          rowValues.push(dayData.inTime ? `${dayData.inTime}` : '-');
        }
      } else {
        rowValues.push('-');
      }
    }
    const dRow = wsDetail.addRow(rowValues);
    dRow.height = 20;
    dRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (colNum === 3) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
