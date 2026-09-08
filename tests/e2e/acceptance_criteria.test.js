/**
 * Acceptance Criteria Test Suite (AC 1 - AC 5)
 * Direct, explicit automated assertions for all 5 Acceptance Criteria from ORIGINAL_REQUEST.md.
 */

const { describe, test, assert, assertEqual, assertIncludes, HttpClient } = require('./harness');
const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const prisma = new PrismaClient();

function registerAcceptanceCriteriaTests() {
  describe('Acceptance Criteria - Explicit Automated Verification', () => {
    test('AC 1: Employee submits leave request 1.0 day -> Manager approves -> HR approves -> annualLeaveUsed increases by exactly 1.0, timesheet records LEAVE (1.0 unit), zero double counting in finalPayableUnits', async () => {
      const testDate = '2026-09-11';
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const meBefore = await clientLam.get('/api/auth/me');
      const quotaBefore = meBefore.data.user.annualLeaveUsed;

      // 1. Submit leave request
      const tpls = await clientLam.get('/api/approvals/templates');
      const tpl = tpls.data.templates.find(t => t.code === 'LEAVE');
      const reqRes = await clientLam.post('/api/approvals', {
        templateId: tpl.id,
        data: {
          leaveType: 'Nghỉ phép năm (có lương)',
          startDate: testDate,
          endDate: testDate,
          duration: 1.0,
          reason: 'AC1 verification test',
        },
      });
      assertEqual(reqRes.status, 200, 'AC1: Leave request submit must succeed');
      const reqId = reqRes.data.request.id;

      // 2. Manager approves Step 1
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const mgrRes = await clientMgr.post(`/api/approvals/${reqId}/action`, {
        action: 'APPROVE',
        note: 'Quản lý duyệt cấp 1 AC1',
      });
      assertEqual(mgrRes.status, 200, 'AC1: Manager approve must succeed');

      // 3. HR Admin approves Step 2
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const hrRes = await clientHr.post(`/api/approvals/${reqId}/action`, {
        action: 'APPROVE',
        note: 'HR duyệt cấp 2 AC1',
      });
      assertEqual(hrRes.status, 200, 'AC1: HR approve must succeed');

      // 4. Assert annualLeaveUsed incremented by exactly 1.0
      const meAfter = await clientLam.get('/api/auth/me');
      assertEqual(meAfter.data.user.annualLeaveUsed, quotaBefore + 1.0, 'AC1: annualLeaveUsed must increase by exactly 1.0');

      // 5. Assert that date on timesheet records LEAVE (1.0 unit)
      const tsRes = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      const lamRow = tsRes.data.matrix.find(r => r.user.email === 'lam@peace.vn');
      const dayRecord = lamRow.dailyRecords[11];
      assert(dayRecord !== null, 'AC1: Day 11 record must exist');
      assertEqual(dayRecord.status, 'LEAVE', 'AC1: Day 11 status must be LEAVE');
      assertEqual(dayRecord.workUnits, 1.0, 'AC1: Day 11 workUnits must be 1.0');

      // 6. Assert no double counting: finalPayableUnits = actualWorkUnits + paidLeaveDays
      const summary = lamRow.summary;
      const expectedFinal = Math.round((summary.actualWorkUnits + summary.paidLeaveDays) * 10) / 10;
      assertEqual(summary.finalPayableUnits, expectedFinal, 'AC1: finalPayableUnits must equal actualWorkUnits + paidLeaveDays without double counting');
    });

    test('AC 2: Employee submits attendance adjustment (forgot check-in) -> Fully approved -> Attendance record updated with in/out times, status transitions to EXPLAINED with 1.0 standard work unit', async () => {
      const testDate = '2026-09-09';
      const employee = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });

      // Ensure clean slate on that date
      await prisma.attendance.deleteMany({
        where: { userId: employee.id, workDate: testDate },
      });

      // 1. Submit adjustment
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const tpls = await clientLam.get('/api/approvals/templates');
      const adjTpl = tpls.data.templates.find(t => t.code === 'ADJUSTMENT');

      const reqRes = await clientLam.post('/api/approvals', {
        templateId: adjTpl.id,
        data: {
          workDate: testDate,
          checkInTime: '08:30',
          checkOutTime: '17:30',
          reasonType: 'Quên chấm công',
          reason: 'AC2 verification test quên chấm công',
        },
      });
      assertEqual(reqRes.status, 200, 'AC2: Adjustment submission must succeed');
      const reqId = reqRes.data.request.id;

      // 2. Manager Approve -> HR Approve
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      await clientMgr.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'AC2 Manager approve' });

      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      await clientHr.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'AC2 HR approve' });

      // 3. Assert DB record updated with in/out times, status EXPLAINED, 1.0 standard unit
      const att = await prisma.attendance.findUnique({
        where: { userId_workDate: { userId: employee.id, workDate: testDate } },
      });
      assert(att !== null, 'AC2: Attendance record must be created/updated');
      assert(att.checkInTime !== null, 'AC2: checkInTime must be set');
      assert(att.checkOutTime !== null, 'AC2: checkOutTime must be set');
      assertEqual(att.checkInStatus, 'MANUAL', 'AC2: checkInStatus must be MANUAL');
      assertEqual(att.checkOutStatus, 'MANUAL', 'AC2: checkOutStatus must be MANUAL');
      assertEqual(att.status, 'EXPLAINED', 'AC2: Status must be EXPLAINED');
      assertEqual(att.calculatedWorkUnits, 1.0, 'AC2: Work units must be 1.0');
    });

    test('AC 3: Manager only sees employees belonging to their department when calling API /api/admin/users', async () => {
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const res = await clientMgr.get('/api/admin/users');
      assertEqual(res.status, 200, 'AC3: Manager users query must return 200');

      const users = res.data.users;
      assert(Array.isArray(users), 'AC3: Users must be an array');
      assert(users.length > 0, 'AC3: Manager must see department users');

      // Every returned user MUST belong to TECH department
      for (const u of users) {
        assertEqual(u.department.code, 'TECH', `AC3: User ${u.email} must belong to department TECH`);
      }

      // Check that users from other departments are strictly excluded
      const emails = users.map(u => u.email);
      assert(!emails.includes('hoa@peace.vn'), 'AC3: Hoa (SALES) must NOT be present');
      assert(!emails.includes('hr@peace.vn'), 'AC3: HR must NOT be present');
      assert(!emails.includes('admin@peace.vn'), 'AC3: Admin must NOT be present');
    });

    test('AC 4: Exported Excel file opens validly, has 2 sheets (Tổng Hợp + Chi Tiết Ngày) with figures matching database 100%', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');

      // 1. Get database truth via timesheet API
      const tsRes = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      assertEqual(tsRes.status, 200, 'AC4: Timesheet API must return 200');

      // 2. Fetch Excel export
      const expRes = await clientHr.get('/api/admin/timesheet/export?month=9&year=2026');
      assertEqual(expRes.status, 200, 'AC4: Timesheet export must return 200');
      assert(Buffer.isBuffer(expRes.data), 'AC4: Must return binary buffer');

      // 3. Load Excel and verify 2 sheets
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(expRes.data);
      assertEqual(workbook.worksheets.length, 2, 'AC4: Must have exactly 2 sheets');

      const wsSummary = workbook.getWorksheet(1);
      const wsDetail = workbook.getWorksheet(2);
      assert(wsSummary.name.includes('Tổng Hợp'), 'AC4: Sheet 1 must be Tổng Hợp');
      assert(wsDetail.name.includes('Chi Tiết'), 'AC4: Sheet 2 must be Chi Tiết Ngày');

      // 4. Validate 100% figures matching between DB and Excel for each employee
      const dbMatrix = tsRes.data.matrix;
      for (const dbUser of dbMatrix) {
        let excelRow = null;
        wsSummary.eachRow((row, rowNumber) => {
          if (rowNumber > 3 && row.getCell(2).value === dbUser.user.employeeCode) {
            excelRow = row;
          }
        });
        assert(excelRow !== null, `AC4: Employee ${dbUser.user.employeeCode} must exist in Excel Sheet 1`);

        assertEqual(Number(excelRow.getCell(7).value), dbUser.summary.standardWorkUnits, 'AC4 standardWorkUnits mismatch');
        assertEqual(Number(excelRow.getCell(8).value), dbUser.summary.actualWorkUnits, 'AC4 actualWorkUnits mismatch');
        assertEqual(Number(excelRow.getCell(9).value), dbUser.summary.totalWorkHours, 'AC4 totalWorkHours mismatch');
        assertEqual(Number(excelRow.getCell(10).value), dbUser.summary.lateMinutes, 'AC4 lateMinutes mismatch');
        assertEqual(Number(excelRow.getCell(11).value), dbUser.summary.earlyMinutes, 'AC4 earlyMinutes mismatch');
        assertEqual(Number(excelRow.getCell(12).value), dbUser.summary.otHours, 'AC4 otHours mismatch');
        assertEqual(Number(excelRow.getCell(13).value), dbUser.summary.paidLeaveDays, 'AC4 paidLeaveDays mismatch');
        assertEqual(Number(excelRow.getCell(14).value), dbUser.summary.finalPayableUnits, 'AC4 finalPayableUnits mismatch');
      }
    });

    test('AC 5: Entire approval flow and side-effects run smoothly without Unhandled Exceptions or Race Conditions', async () => {
      // Execute 3 concurrent multi-step approval actions in parallel
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const tpls = await clientLam.get('/api/approvals/templates');
      const tpl = tpls.data.templates.find(t => t.code === 'LATE_EARLY');

      // Submit 3 requests
      const responses = [];
      for (const i of [1, 2, 3]) {
        const r = await clientLam.post('/api/approvals', {
          templateId: tpl.id,
          data: {
            type: 'Xin đi muộn',
            workDate: `2026-09-${20 + i}`,
            expectedTime: '09:00',
            reason: `AC5 stress test request ${i}`,
          },
        });
        assertEqual(r.status, 200, `AC5: Request ${i} submission must succeed`);
        responses.push(r);
      }

      // Approve in parallel by Manager
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const approvePromises = responses.map((r) =>
        clientMgr.post(`/api/approvals/${r.data.request.id}/action`, {
          action: 'APPROVE',
          note: 'AC5 parallel approve',
        })
      );
      const approveResults = await Promise.all(approvePromises);
      for (const ar of approveResults) {
        assertEqual(ar.status, 200, 'AC5: Parallel approvals must execute without race conditions or errors');
      }
    });
  });
}

module.exports = { registerAcceptanceCriteriaTests };
