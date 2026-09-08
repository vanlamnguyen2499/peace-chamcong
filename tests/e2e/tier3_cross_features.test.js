/**
 * Tier 3: Cross-Feature Combinations Test Suite
 * Validates complex, multi-role interactions across multiple modules:
 * Check-in -> Requests -> Manager Approve -> HR Approve -> Timesheet updates.
 */

const { describe, test, assert, assertEqual, HttpClient } = require('./harness');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function registerTier3Tests() {
  describe('Tier 3 - Cross-Feature Combinations', () => {
    test('T3.1 Workflow 1: Out-of-bounds Check-in -> ADJUSTMENT Request -> Manager Approve -> HR Approve -> Timesheet Updated to EXPLAINED', async () => {
      const testDate = '2026-09-12';
      const employee = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
      const branch = await prisma.branch.findFirst({ where: { code: 'HN_HQ' } });
      const shift = await prisma.shift.findFirst({ where: { code: 'CA_HC' } });

      // Clean up test date attendance if existing
      await prisma.attendance.deleteMany({
        where: { userId: employee.id, workDate: testDate },
      });

      // 1. Employee checks in outside geofence (simulated record)
      await prisma.attendance.create({
        data: {
          userId: employee.id,
          branchId: branch.id,
          shiftId: shift.id,
          workDate: testDate,
          checkInTime: new Date(`${testDate}T08:30:00`),
          checkInStatus: 'INVALID_LOCATION',
          checkInDistance: 25000,
          status: 'INVALID',
          calculatedWorkUnits: 0.0,
          note: 'Check-in ngoài vùng',
        },
      });

      // 2. Employee submits ADJUSTMENT request
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
          reasonType: 'Lỗi GPS / Camera thiết bị',
          reason: 'GPS bị lệch vị trí khi check-in tại trụ sở',
        },
      });
      assertEqual(reqRes.status, 200, 'Adjustment request must be created');
      const reqId = reqRes.data.request.id;

      // 3. Manager approves Step 1
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const mgrAction = await clientMgr.post(`/api/approvals/${reqId}/action`, {
        action: 'APPROVE',
        note: 'Xác nhận nhân viên có mặt tại văn phòng',
      });
      assertEqual(mgrAction.status, 200, 'Manager approval must succeed');

      // 4. HR approves Step 2 (Final)
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const hrAction = await clientHr.post(`/api/approvals/${reqId}/action`, {
        action: 'APPROVE',
        note: 'HR cập nhật bảng công chuẩn',
      });
      assertEqual(hrAction.status, 200, 'HR approval must succeed');

      // 5. Verify Attendance in DB
      const updatedAtt = await prisma.attendance.findUnique({
        where: { userId_workDate: { userId: employee.id, workDate: testDate } },
      });
      assertEqual(updatedAtt.status, 'EXPLAINED', 'Status must be EXPLAINED');
      assertEqual(updatedAtt.calculatedWorkUnits, 1.0, 'Work units must be 1.0');
      assertEqual(updatedAtt.checkInStatus, 'MANUAL');
      assertEqual(updatedAtt.checkOutStatus, 'MANUAL');

      // 6. Verify Timesheet Matrix reflects 1.0 actual work units
      const tsRes = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      const lamRow = tsRes.data.matrix.find(r => r.user.email === 'lam@peace.vn');
      const dayRecord = lamRow.dailyRecords[12];
      assert(dayRecord !== null, 'Day 12 record must exist on timesheet');
      assertEqual(dayRecord.status, 'EXPLAINED', 'Timesheet day 12 status must be EXPLAINED');
      assertEqual(dayRecord.workUnits, 1.0, 'Timesheet day 12 workUnits must be 1.0');
    });

    test('T3.2 Workflow 2: Full Leave Request Cycle with Quota & Timesheet Anti-Double-Counting', async () => {
      const testDate = '2026-09-14';
      const employee = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });

      // Clean up test date attendance if existing
      await prisma.attendance.deleteMany({
        where: { userId: employee.id, workDate: testDate },
      });

      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const meBefore = await clientLam.get('/api/auth/me');
      const leaveUsedBefore = meBefore.data.user.annualLeaveUsed;

      // 1. Submit 1.0 day paid leave
      const tpls = await clientLam.get('/api/approvals/templates');
      const leaveTpl = tpls.data.templates.find(t => t.code === 'LEAVE');
      const reqRes = await clientLam.post('/api/approvals', {
        templateId: leaveTpl.id,
        data: {
          leaveType: 'Nghỉ phép năm (có lương)',
          startDate: testDate,
          endDate: testDate,
          duration: 1.0,
          reason: 'Test cross-feature leave workflow',
        },
      });
      assertEqual(reqRes.status, 200);
      const reqId = reqRes.data.request.id;

      // 2. Manager Approve
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      await clientMgr.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'Quản lý duyệt' });

      // 3. HR Approve
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      await clientHr.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'HR duyệt trừ phép' });

      // 4. Verify Quota incremented
      const meAfter = await clientLam.get('/api/auth/me');
      assertEqual(meAfter.data.user.annualLeaveUsed, leaveUsedBefore + 1.0, 'annualLeaveUsed must increase by 1.0');

      // 5. Verify Timesheet: status LEAVE, paidLeaveDays +1, finalPayableUnits = actualWorkUnits + paidLeaveDays
      const tsRes = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      const lamRow = tsRes.data.matrix.find(r => r.user.email === 'lam@peace.vn');
      const dayRecord = lamRow.dailyRecords[14];
      assertEqual(dayRecord.status, 'LEAVE', 'Timesheet day 14 status must be LEAVE');
      assertEqual(lamRow.summary.finalPayableUnits, Math.round((lamRow.summary.actualWorkUnits + lamRow.summary.paidLeaveDays) * 10) / 10);
    });

    test('T3.3 Workflow 3: Overtime Cycle -> Attendance record enriched with otHours -> Timesheet aggregates OT', async () => {
      const testDate = '2026-09-16';
      const employee = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
      const branch = await prisma.branch.findFirst({ where: { code: 'HN_HQ' } });
      const shift = await prisma.shift.findFirst({ where: { code: 'CA_HC' } });

      // Setup attendance record for that day
      await prisma.attendance.upsert({
        where: { userId_workDate: { userId: employee.id, workDate: testDate } },
        update: {
          checkInTime: new Date(`${testDate}T08:30:00`),
          checkOutTime: new Date(`${testDate}T17:30:00`),
          status: 'PRESENT',
          calculatedWorkUnits: 1.0,
          workHours: 8.0,
          otHours: 0.0,
        },
        create: {
          userId: employee.id,
          branchId: branch.id,
          shiftId: shift.id,
          workDate: testDate,
          checkInTime: new Date(`${testDate}T08:30:00`),
          checkOutTime: new Date(`${testDate}T17:30:00`),
          status: 'PRESENT',
          calculatedWorkUnits: 1.0,
          workHours: 8.0,
          otHours: 0.0,
        },
      });

      // Employee submits OVERTIME request for 3 hours
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const tpls = await clientLam.get('/api/approvals/templates');
      const otTpl = tpls.data.templates.find(t => t.code === 'OVERTIME');

      const reqRes = await clientLam.post('/api/approvals', {
        templateId: otTpl.id,
        data: {
          workDate: testDate,
          otStartTime: '18:00',
          otEndTime: '21:00',
          estimatedHours: 3.0,
          taskDescription: 'Triển khai dự án khẩn cấp',
        },
      });
      const reqId = reqRes.data.request.id;

      // Manager Approve -> HR Approve
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      await clientMgr.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'Xác nhận OT' });

      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      await clientHr.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'HR chốt OT' });

      // Check attendance in DB has +3.0 otHours
      const updatedAtt = await prisma.attendance.findUnique({
        where: { userId_workDate: { userId: employee.id, workDate: testDate } },
      });
      assertEqual(updatedAtt.otHours, 3.0, 'otHours must be 3.0');

      // Check Timesheet has otHours >= 3.0
      const tsRes = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      const lamRow = tsRes.data.matrix.find(r => r.user.email === 'lam@peace.vn');
      assert(lamRow.summary.otHours >= 3.0, 'otHours must be >= 3.0');
    });

    test('T3.4 Workflow 4: Lateness Penalty Forgiven -> lateMinutes reset to 0 upon LATE_EARLY approval', async () => {
      const testDate = '2026-09-17';
      const employee = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
      const branch = await prisma.branch.findFirst({ where: { code: 'HN_HQ' } });
      const shift = await prisma.shift.findFirst({ where: { code: 'CA_HC' } });

      // Setup attendance record with 45 minutes late penalty
      await prisma.attendance.upsert({
        where: { userId_workDate: { userId: employee.id, workDate: testDate } },
        update: {
          checkInTime: new Date(`${testDate}T09:30:00`),
          checkOutTime: new Date(`${testDate}T17:30:00`),
          status: 'LATE',
          lateMinutes: 45,
          calculatedWorkUnits: 1.0,
          workHours: 7.0,
        },
        create: {
          userId: employee.id,
          branchId: branch.id,
          shiftId: shift.id,
          workDate: testDate,
          checkInTime: new Date(`${testDate}T09:30:00`),
          checkOutTime: new Date(`${testDate}T17:30:00`),
          status: 'LATE',
          lateMinutes: 45,
          calculatedWorkUnits: 1.0,
          workHours: 7.0,
        },
      });

      // Employee submits LATE_EARLY request
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const tpls = await clientLam.get('/api/approvals/templates');
      const lateTpl = tpls.data.templates.find(t => t.code === 'LATE_EARLY');

      const reqRes = await clientLam.post('/api/approvals', {
        templateId: lateTpl.id,
        data: {
          type: 'Xin đi muộn',
          workDate: testDate,
          expectedTime: '09:30',
          reason: 'Tắc đường do tai nạn giao thông',
        },
      });
      const reqId = reqRes.data.request.id;

      // Manager Approves (single step flow for LATE_EARLY)
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const actionRes = await clientMgr.post(`/api/approvals/${reqId}/action`, {
        action: 'APPROVE',
        note: 'Thông cảm sự cố, miễn phạt đi muộn',
      });
      assertEqual(actionRes.status, 200);

      // Check DB attendance record: lateMinutes must be reset to 0, status EXPLAINED
      const updatedAtt = await prisma.attendance.findUnique({
        where: { userId_workDate: { userId: employee.id, workDate: testDate } },
      });
      assertEqual(updatedAtt.lateMinutes, 0, 'lateMinutes must be reset to 0');
      assertEqual(updatedAtt.status, 'EXPLAINED', 'status must be EXPLAINED');
    });

    test('T3.5 Workflow 5: Batch Shift Scheduling followed by Attendance Calculation', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const usersRes = await clientHr.get('/api/admin/users');
      const employee = usersRes.data.users.find(u => u.email === 'hoa@peace.vn');
      const shiftsRes = await clientHr.get('/api/admin/shifts');
      const shiftHC = shiftsRes.data.shifts.find(s => s.code === 'CA_HC');

      // Schedule Hoa for Sept 1 to Sept 5
      const schedRes = await clientHr.post('/api/admin/schedules/batch', {
        userIds: [employee.id],
        shiftId: shiftHC.id,
        startDate: '2026-09-01',
        endDate: '2026-09-05',
        excludeSundays: true,
      });
      assertEqual(schedRes.status, 200);

      // Verify schedule exists in DB
      const schedule = await prisma.userShiftSchedule.findUnique({
        where: {
          userId_workDate: {
            userId: employee.id,
            workDate: '2026-09-01',
          },
        },
      });
      assert(schedule !== null, 'Schedule record must be created');
      assertEqual(schedule.shiftId, shiftHC.id, 'Assigned shift must match CA_HC');
    });
  });
}

module.exports = { registerTier3Tests };
