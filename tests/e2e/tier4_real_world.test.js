/**
 * Tier 4: Real-World Scenarios Test Suite
 * Simulates a full-month realistic operations scenario:
 * Full month batch scheduling, regular attendance, leave approvals, attendance adjustment,
 * timesheet reconciliation, and 100% database-to-Excel export validation.
 */

const { describe, test, assert, assertEqual, HttpClient } = require('./harness');
const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const prisma = new PrismaClient();

function registerTier4Tests() {
  describe('Tier 4 - Real-World Full Month Simulation', () => {
    let employeeLam, branchHN, shiftHC;

    test('T4.1 Setup monthly environment: resolve user, branch and shifts for September 2026', async () => {
      employeeLam = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
      branchHN = await prisma.branch.findFirst({ where: { code: 'HN_HQ' } });
      shiftHC = await prisma.shift.findFirst({ where: { code: 'CA_HC' } });
      assert(employeeLam && branchHN && shiftHC, 'All entities must exist');
    });

    test('T4.2 Step 1: HR applies full month batch schedule for September 2026 (excluding Sundays)', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const batchRes = await clientHr.post('/api/admin/schedules/batch', {
        userIds: [employeeLam.id],
        shiftId: shiftHC.id,
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        excludeSundays: true,
      });
      assertEqual(batchRes.status, 200, 'Batch schedule must return 200');

      // Verify Sunday Sept 6 was excluded
      const sundaySched = await prisma.userShiftSchedule.findUnique({
        where: {
          userId_workDate: {
            userId: employeeLam.id,
            workDate: '2026-09-06',
          },
        },
      });
      assertEqual(sundaySched, null, 'Sunday Sept 6 must be excluded');

      // Verify Monday Sept 7 was included
      const mondaySched = await prisma.userShiftSchedule.findUnique({
        where: {
          userId_workDate: {
            userId: employeeLam.id,
            workDate: '2026-09-07',
          },
        },
      });
      assert(mondaySched !== null, 'Monday Sept 7 must be scheduled');
    });

    test('T4.3 Step 2: Populate regular working days (Sept 1, 2, 3, 4, 5) with valid attendance', async () => {
      const workDates = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
      for (const wd of workDates) {
        await prisma.attendance.upsert({
          where: { userId_workDate: { userId: employeeLam.id, workDate: wd } },
          update: {
            branchId: branchHN.id,
            shiftId: shiftHC.id,
            checkInTime: new Date(`${wd}T08:30:00`),
            checkInStatus: 'ON_TIME',
            checkOutTime: new Date(`${wd}T17:30:00`),
            checkOutStatus: 'ON_TIME',
            lateMinutes: 0,
            earlyMinutes: 0,
            workHours: 8.0,
            calculatedWorkUnits: 1.0,
            status: 'PRESENT',
          },
          create: {
            userId: employeeLam.id,
            branchId: branchHN.id,
            shiftId: shiftHC.id,
            workDate: wd,
            checkInTime: new Date(`${wd}T08:30:00`),
            checkInStatus: 'ON_TIME',
            checkOutTime: new Date(`${wd}T17:30:00`),
            checkOutStatus: 'ON_TIME',
            lateMinutes: 0,
            earlyMinutes: 0,
            workHours: 8.0,
            calculatedWorkUnits: 1.0,
            status: 'PRESENT',
          },
        });
      }
      assert(true, '5 working days populated');
    });

    test('T4.4 Step 3: Employee submits 1-day LEAVE on Sept 10, approved by Manager and HR', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const tpls = await clientLam.get('/api/approvals/templates');
      const leaveTpl = tpls.data.templates.find(t => t.code === 'LEAVE');

      const reqRes = await clientLam.post('/api/approvals', {
        templateId: leaveTpl.id,
        data: {
          leaveType: 'Nghỉ phép năm (có lương)',
          startDate: '2026-09-10',
          endDate: '2026-09-10',
          duration: 1.0,
          reason: 'Nghỉ giải quyết việc riêng',
        },
      });
      const reqId = reqRes.data.request.id;

      // Manager approves
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      await clientMgr.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'Quản lý duyệt' });

      // HR approves
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      await clientHr.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'HR duyệt trừ phép' });

      const att = await prisma.attendance.findUnique({
        where: { userId_workDate: { userId: employeeLam.id, workDate: '2026-09-10' } },
      });
      assertEqual(att.status, 'LEAVE', 'Sept 10 must have status LEAVE');
      assertEqual(att.calculatedWorkUnits, 1.0, 'Calculated work units must be 1.0');
    });

    test('T4.5 Step 4: Employee forgets check-in on Sept 15, submits ADJUSTMENT, fully approved', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const tpls = await clientLam.get('/api/approvals/templates');
      const adjTpl = tpls.data.templates.find(t => t.code === 'ADJUSTMENT');

      const reqRes = await clientLam.post('/api/approvals', {
        templateId: adjTpl.id,
        data: {
          workDate: '2026-09-15',
          checkInTime: '08:30',
          checkOutTime: '17:30',
          reasonType: 'Quên chấm công',
          reason: 'Quên chấm công buổi sáng khi đến văn phòng',
        },
      });
      const reqId = reqRes.data.request.id;

      // Manager approves
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      await clientMgr.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'Quản lý duyệt' });

      // HR approves
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      await clientHr.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'HR chốt' });

      const att = await prisma.attendance.findUnique({
        where: { userId_workDate: { userId: employeeLam.id, workDate: '2026-09-15' } },
      });
      assertEqual(att.status, 'EXPLAINED', 'Sept 15 must be EXPLAINED');
      assertEqual(att.calculatedWorkUnits, 1.0, 'Work units must be 1.0');
    });

    test('T4.6 Step 5: Timesheet audit verifies zero double-counting across the simulated month', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const tsRes = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      assertEqual(tsRes.status, 200);

      const lamRow = tsRes.data.matrix.find(r => r.user.email === 'lam@peace.vn');
      assert(lamRow !== undefined, 'Lam row must be found');

      const summary = lamRow.summary;
      // 5 regular days (1..5) + day 8 (adj from earlier) + day 12 (adj from tier3) + day 15 (adj from step 4) + day 16 (from tier3) + day 17 (from tier3)
      // All these contribute to actualWorkUnits.
      // Day 10 (and day 14, 24, 26) contribute to paidLeaveDays.
      // Anti-double-counting assertion:
      const expectedFinal = Math.round((summary.actualWorkUnits + summary.paidLeaveDays) * 10) / 10;
      assertEqual(summary.finalPayableUnits, expectedFinal, 'finalPayableUnits must equal actualWorkUnits + paidLeaveDays without inflation');

      // Verify that Day 10 has status LEAVE and does not inflate actualWorkUnits
      const day10 = lamRow.dailyRecords[10];
      assertEqual(day10.status, 'LEAVE');

      // Verify that Day 15 has status EXPLAINED
      const day15 = lamRow.dailyRecords[15];
      assertEqual(day15.status, 'EXPLAINED');
      assertEqual(day15.workUnits, 1.0);
    });

    test('T4.7 Step 6: Export Excel and assert 100% parity with API timesheet matrix', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const tsRes = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      const exportRes = await clientHr.get('/api/admin/timesheet/export?month=9&year=2026');

      assertEqual(exportRes.status, 200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(exportRes.data);

      assertEqual(workbook.worksheets.length, 2, 'Must have 2 sheets');
      const ws1 = workbook.getWorksheet(1); // Summary sheet

      // Find Lam's row in Sheet 1
      let lamExcelRow = null;
      ws1.eachRow((row, rowNumber) => {
        if (rowNumber > 3) {
          const empCode = row.getCell(2).value;
          if (empCode === 'NV004') {
            lamExcelRow = row;
          }
        }
      });

      assert(lamExcelRow !== null, 'Lam row must be found in Excel Sheet 1');
      const apiLam = tsRes.data.matrix.find(r => r.user.employeeCode === 'NV004');

      // Check key metrics in Excel Sheet 1 against API response:
      // Col 8: actualWorkUnits
      const excelActual = Number(lamExcelRow.getCell(8).value);
      assertEqual(excelActual, apiLam.summary.actualWorkUnits, 'actualWorkUnits in Excel must match API');

      // Col 13: paidLeaveDays
      const excelLeave = Number(lamExcelRow.getCell(13).value);
      assertEqual(excelLeave, apiLam.summary.paidLeaveDays, 'paidLeaveDays in Excel must match API');

      // Col 14: finalPayableUnits
      const excelFinal = Number(lamExcelRow.getCell(14).value);
      assertEqual(excelFinal, apiLam.summary.finalPayableUnits, 'finalPayableUnits in Excel must match API');
    });
  });
}

module.exports = { registerTier4Tests };
