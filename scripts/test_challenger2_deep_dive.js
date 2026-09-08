#!/usr/bin/env node

/**
 * Challenger 2 Deep Dive Verification Script (Iteration 2)
 * Tests:
 * 1. Out-of-bounds check-out 0.0 work units & timesheet non-contamination
 * 2. Fractional leave (0.5 day) submission, full approval, timesheet accumulation & Excel export
 * 3. Independent Excel binary parsing via ExcelJS with 100% DB parity
 */

const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const { HttpClient } = require('../tests/e2e/harness');

const prisma = new PrismaClient();
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

const results = {
  check1_outOfBounds: null,
  check2_fractionalLeave: null,
  check3_excelParity: null,
};

async function main() {
  console.log('======================================================================');
  console.log('🔬 CHALLENGER 2 DEEP DIVE EMPIRICAL HARNESS');
  console.log('   Target Server:', BASE_URL);
  console.log('======================================================================\n');

  const lamClient = new HttpClient(BASE_URL);
  const managerClient = new HttpClient(BASE_URL);
  const hrClient = new HttpClient(BASE_URL);

  await lamClient.login('lam@peace.vn', 'user123');
  await managerClient.login('manager@peace.vn', 'admin123');
  await hrClient.login('hr@peace.vn', 'admin123');

  const lam = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
  const branchHN = await prisma.branch.findFirst({ where: { code: 'HN_HQ' } });
  const shiftHC = await prisma.shift.findFirst({ where: { code: 'CA_HC' } });

  // -----------------------------------------------------------------------------
  // TEST 1: Out-of-bounds Check-out 0.0 Work Units & Timesheet Non-Contamination
  // -----------------------------------------------------------------------------
  console.log('--- TEST 1: Out-of-bounds Check-out Verification ---');
  const testDateOOB = '2026-11-25';

  // Clean prior record
  await prisma.attendance.deleteMany({
    where: { userId: lam.id, workDate: testDateOOB },
  });

  // Step 1: Valid check-in at HQ (21.028511, 105.854444)
  const dummyPhoto = 'data:image/jpeg;base64,' + Buffer.from('fake-photo-data-valid-checkin').toString('base64');
  const inRes = await lamClient.post('/api/attendance/check-in', {
    latitude: branchHN.latitude,
    longitude: branchHN.longitude,
    photo: dummyPhoto,
    workDate: testDateOOB,
    time: `${testDateOOB}T08:30:00.000Z`,
  });
  console.log('1.1 Check-in response status:', inRes.status, 'status:', inRes.data?.attendance?.status);

  // Step 2: Check-out OUT OF BOUNDS (Ho Chi Minh City coordinates ~1100km away: 10.7769, 106.7009)
  const dummyPhotoOut = 'data:image/jpeg;base64,' + Buffer.from('fake-photo-data-oob-checkout').toString('base64');
  const outRes = await lamClient.post('/api/attendance/check-out', {
    latitude: 10.7769,
    longitude: 106.7009,
    photo: dummyPhotoOut,
    workDate: testDateOOB,
    time: `${testDateOOB}T17:30:00.000Z`,
  });

  console.log('1.2 Check-out response status:', outRes.status);
  console.log('    isInside:', outRes.data?.isInside);
  console.log('    distance:', outRes.data?.distance, 'meters');
  console.log('    attendance.status:', outRes.data?.attendance?.status);
  console.log('    attendance.checkOutStatus:', outRes.data?.attendance?.checkOutStatus);
  console.log('    attendance.calculatedWorkUnits:', outRes.data?.attendance?.calculatedWorkUnits);

  // Step 3: Check DB record
  const dbAttOOB = await prisma.attendance.findUnique({
    where: { userId_workDate: { userId: lam.id, workDate: testDateOOB } },
  });
  console.log('1.3 DB record status:', dbAttOOB.status, 'calculatedWorkUnits:', dbAttOOB.calculatedWorkUnits);

  // Step 4: Check Timesheet API
  const tsResBefore = await hrClient.get('/api/admin/timesheet?month=11&year=2026');
  const lamTsBefore = tsResBefore.data.matrix.find((r) => r.user.email === 'lam@peace.vn');
  const day25Record = lamTsBefore.dailyRecords[25];
  console.log('1.4 Timesheet day 25 record:', {
    status: day25Record.status,
    workUnits: day25Record.workUnits,
  });
  console.log('    Timesheet actualWorkUnits for Lam:', lamTsBefore.summary.actualWorkUnits);

  const test1Passed =
    outRes.data?.isInside === false &&
    dbAttOOB.status === 'INVALID' &&
    dbAttOOB.calculatedWorkUnits === 0.0 &&
    day25Record.status === 'INVALID' &&
    day25Record.workUnits === 0.0;

  results.check1_outOfBounds = {
    passed: test1Passed,
    isInside: outRes.data?.isInside,
    dbStatus: dbAttOOB.status,
    dbWorkUnits: dbAttOOB.calculatedWorkUnits,
    tsStatus: day25Record.status,
    tsWorkUnits: day25Record.workUnits,
  };
  console.log('>>> TEST 1 RESULT:', test1Passed ? 'PASSED ✅' : 'FAILED ❌');

  // -----------------------------------------------------------------------------
  // TEST 2: Fractional Leave (0.5 Day) Accumulation in Timesheet and Excel Export
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 2: Fractional Leave (0.5 Day) Accumulation Verification ---');
  const testDateLeave = '2026-11-26';

  // Clean prior record
  await prisma.attendance.deleteMany({
    where: { userId: lam.id, workDate: testDateLeave },
  });

  const lamUserBefore = await prisma.user.findUnique({ where: { id: lam.id } });
  const quotaUsedBefore = lamUserBefore.annualLeaveUsed;
  console.log('2.1 Lam annualLeaveUsed before request:', quotaUsedBefore);

  // Submit LEAVE request for 0.5 day
  const tplLeave = await prisma.approvalTemplate.findUnique({ where: { code: 'LEAVE' } });
  const leaveReqRes = await lamClient.post('/api/approvals', {
    templateId: tplLeave.id,
    data: {
      leaveType: 'Nghỉ phép năm (có lương)',
      startDate: testDateLeave,
      endDate: testDateLeave,
      duration: 0.5,
      reason: 'Empirical test for fractional leave 0.5 day',
    },
  });

  console.log('2.2 Leave request created status:', leaveReqRes.status, 'code:', leaveReqRes.data?.request?.code);
  const requestId = leaveReqRes.data?.request?.id;

  // Step 1: Manager approves
  const mgrApproveRes = await managerClient.post(`/api/approvals/${requestId}/action`, {
    action: 'APPROVE',
    note: 'Manager approves 0.5 day leave',
  });
  console.log('2.3 Manager approval status:', mgrApproveRes.status);

  // Step 2: HR approves (final step)
  const hrApproveRes = await hrClient.post(`/api/approvals/${requestId}/action`, {
    action: 'APPROVE',
    note: 'HR final approves 0.5 day leave',
  });
  console.log('2.4 HR final approval status:', hrApproveRes.status);

  // Inspect User quota
  const lamUserAfter = await prisma.user.findUnique({ where: { id: lam.id } });
  const quotaUsedAfter = lamUserAfter.annualLeaveUsed;
  const quotaIncrement = quotaUsedAfter - quotaUsedBefore;
  console.log('2.5 Lam annualLeaveUsed after approval:', quotaUsedAfter, 'increment:', quotaIncrement);

  // Inspect DB Attendance record
  const dbAttLeave = await prisma.attendance.findUnique({
    where: { userId_workDate: { userId: lam.id, workDate: testDateLeave } },
  });
  console.log('2.6 DB Attendance record:', {
    status: dbAttLeave.status,
    calculatedWorkUnits: dbAttLeave.calculatedWorkUnits,
    note: dbAttLeave.note,
  });

  // Inspect Timesheet API
  const tsResAfter = await hrClient.get('/api/admin/timesheet?month=11&year=2026');
  const lamTsAfter = tsResAfter.data.matrix.find((r) => r.user.email === 'lam@peace.vn');
  const day26Record = lamTsAfter.dailyRecords[26];
  console.log('2.7 Timesheet day 26 record:', {
    status: day26Record.status,
    workUnits: day26Record.workUnits,
  });
  console.log('    Timesheet Summary for Lam:', {
    actualWorkUnits: lamTsAfter.summary.actualWorkUnits,
    paidLeaveDays: lamTsAfter.summary.paidLeaveDays,
    unpaidLeaveDays: lamTsAfter.summary.unpaidLeaveDays,
    finalPayableUnits: lamTsAfter.summary.finalPayableUnits,
  });

  // Inspect Excel Export
  const exportRes = await hrClient.get('/api/admin/timesheet/export?month=11&year=2026');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(exportRes.data);
  const ws1 = workbook.getWorksheet('Tổng Hợp T11-2026');
  const ws2 = workbook.getWorksheet('Chi Tiết T11-2026');

  // Find Lam in Sheet 1
  let lamWs1Row = null;
  ws1.eachRow((row, rNum) => {
    if (rNum >= 4 && row.getCell(2).value === lam.employeeCode) {
      lamWs1Row = row;
    }
  });

  const excelActual = Number(lamWs1Row.getCell(8).value);
  const excelPaidLeave = Number(lamWs1Row.getCell(13).value);
  const excelFinal = Number(lamWs1Row.getCell(14).value);

  console.log('2.8 Excel Sheet 1 values for Lam:', {
    actualWorkUnits: excelActual,
    paidLeaveDays: excelPaidLeave,
    finalPayableUnits: excelFinal,
  });

  // Check Sheet 2 day 26 cell
  let lamWs2Row = null;
  ws2.eachRow((row, rNum) => {
    if (rNum >= 2 && row.getCell(2).value === lam.employeeCode) {
      lamWs2Row = row;
    }
  });
  const day26Cell = lamWs2Row.getCell(4 + 26).value;
  console.log('2.9 Excel Sheet 2 day 26 cell value:', day26Cell);

  results.check2_fractionalLeave = {
    quotaIncrement,
    dbCalculatedWorkUnits: dbAttLeave.calculatedWorkUnits,
    tsPaidLeaveDays: lamTsAfter.summary.paidLeaveDays,
    tsFinalPayableUnits: lamTsAfter.summary.finalPayableUnits,
    excelPaidLeaveDays: excelPaidLeave,
    excelFinalPayableUnits: excelFinal,
    excelParityWithApi:
      excelActual === lamTsAfter.summary.actualWorkUnits &&
      excelPaidLeave === lamTsAfter.summary.paidLeaveDays &&
      excelFinal === lamTsAfter.summary.finalPayableUnits,
  };

  // -----------------------------------------------------------------------------
  // TEST 3: Independent Excel Binary Parsing via ExcelJS with 100% DB Parity
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 3: Comprehensive Excel Binary Parsing via ExcelJS vs DB Parity ---');
  const usersInDb = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { employeeCode: 'asc' },
    include: { department: true, branch: true },
  });

  const attendancesMonth11 = await prisma.attendance.findMany({
    where: { workDate: { startsWith: '2026-11' } },
  });
  const attMap11 = {};
  attendancesMonth11.forEach((att) => {
    if (!attMap11[att.userId]) attMap11[att.userId] = {};
    attMap11[att.userId][att.workDate] = att;
  });

  let allCellsMatch = true;
  let mismatchedCells = [];

  // Sheet 1 parity check
  usersInDb.forEach((u) => {
    let row = null;
    ws1.eachRow((r, rNum) => {
      if (rNum >= 4 && r.getCell(2).value === u.employeeCode) row = r;
    });

    if (!row) {
      allCellsMatch = false;
      mismatchedCells.push(`User ${u.employeeCode} not found in Sheet 1`);
      return;
    }

    const apiUser = tsResAfter.data.matrix.find((m) => m.user.employeeCode === u.employeeCode);
    if (!apiUser) {
      allCellsMatch = false;
      mismatchedCells.push(`User ${u.employeeCode} not found in API`);
      return;
    }

    const checks = [
      { col: 2, expected: u.employeeCode, name: 'Mã NV' },
      { col: 3, expected: u.name, name: 'Họ và Tên' },
      { col: 4, expected: u.department?.name || 'Chưa xếp', name: 'Phòng Ban' },
      { col: 7, expected: apiUser.summary.standardWorkUnits, name: 'Công Chuẩn' },
      { col: 8, expected: apiUser.summary.actualWorkUnits, name: 'Công Thực Tế' },
      { col: 9, expected: apiUser.summary.totalWorkHours, name: 'Tổng Giờ Làm' },
      { col: 10, expected: apiUser.summary.lateMinutes, name: 'Đi Muộn' },
      { col: 11, expected: apiUser.summary.earlyMinutes, name: 'Về Sớm' },
      { col: 12, expected: apiUser.summary.otHours, name: 'Làm Thêm OT' },
      { col: 13, expected: apiUser.summary.paidLeaveDays, name: 'Nghỉ Phép' },
      { col: 14, expected: apiUser.summary.finalPayableUnits, name: 'TỔNG CÔNG' },
    ];

    for (const c of checks) {
      const val = row.getCell(c.col).value;
      if (val !== c.expected) {
        allCellsMatch = false;
        mismatchedCells.push(`${u.employeeCode} Col ${c.col} (${c.name}): Excel=${val}, Expected=${c.expected}`);
      }
    }
  });

  // Sheet 2 daily cell parity check
  usersInDb.forEach((u) => {
    let row = null;
    ws2.eachRow((r, rNum) => {
      if (rNum >= 2 && r.getCell(2).value === u.employeeCode) row = r;
    });

    const userAtts = attMap11[u.id] || {};
    for (let d = 1; d <= 30; d++) {
      const dayStr = `2026-11-${String(d).padStart(2, '0')}`;
      const att = userAtts[dayStr];
      const cellVal = row.getCell(4 + d).value;

      let expectedVal = '-';
      if (att) {
        if (att.status === 'LEAVE') expectedVal = 'P';
        else if (att.status === 'ABSENT') expectedVal = 'V';
        else if (att.calculatedWorkUnits > 0) expectedVal = att.calculatedWorkUnits;
        else if (att.checkInTime) {
          expectedVal = new Date(att.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        }
      }

      if (cellVal !== expectedVal) {
        allCellsMatch = false;
        mismatchedCells.push(`${u.employeeCode} Day ${d}: Excel=${cellVal}, Expected=${expectedVal}`);
      }
    }
  });

  results.check3_excelParity = {
    allCellsMatch,
    mismatchedCount: mismatchedCells.length,
    mismatches: mismatchedCells.slice(0, 10),
  };
  console.log('3.1 Excel vs DB 100% parity result:', allCellsMatch ? 'PERFECT PARITY (0 mismatches) ✅' : `MISMATCHES (${mismatchedCells.length}) ❌`);

  console.log('\n======================================================================');
  console.log('📊 FINAL SUMMARY RESULTS');
  console.log('======================================================================');
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((err) => {
    console.error('Fatal error in deep dive harness:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
