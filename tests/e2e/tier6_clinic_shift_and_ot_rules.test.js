/**
 * Tier 6: Specialized Clinic / Enterprise Shift Schedules, Late > 30m Penalty,
 * Manual Override for Study Days, OT x2, and 8 Standard Templates.
 */

const { describe, test, assert, assertEqual, HttpClient } = require('./harness');

function timeStringToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function dateToMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function calculateAttendanceMetrics(checkIn, checkOut, shift) {
  let lateMinutes = 0;
  let earlyMinutes = 0;
  let workHours = 0;
  let otHours = 0;
  let calculatedWorkUnits = 0;
  let checkInStatus = 'ON_TIME';
  let checkOutStatus = 'ON_TIME';
  let isLateOver30Mins = false;

  const shiftStartMin = timeStringToMinutes(shift.startTime);
  const shiftEndMin = timeStringToMinutes(shift.endTime);
  const breakStartMin = shift.breakStartTime ? timeStringToMinutes(shift.breakStartTime) : 0;
  const breakEndMin = shift.breakEndTime ? timeStringToMinutes(shift.breakEndTime) : 0;
  const breakDurationMin =
    breakStartMin && breakEndMin && breakEndMin > breakStartMin ? breakEndMin - breakStartMin : 0;

  if (checkIn) {
    const checkInMin = dateToMinutes(checkIn);
    if (checkInMin > shiftStartMin + shift.gracePeriodLate) {
      lateMinutes = checkInMin - shiftStartMin;
      const minutesFromPrep = checkInMin - (shiftStartMin - (shift.earlyCheckInMinutes || 15));
      if (lateMinutes > 30 || minutesFromPrep > 30) {
        isLateOver30Mins = true;
      }
    }
  }

  if (checkOut) {
    const checkOutMin = dateToMinutes(checkOut);
    if (checkOutMin < shiftEndMin - shift.gracePeriodEarly) {
      earlyMinutes = shiftEndMin - checkOutMin;
      checkOutStatus = 'EARLY';
    }

    if (checkOutMin >= shiftEndMin + 15) {
      const rawOtMinutes = checkOutMin - shiftEndMin;
      const x2OtMinutes = rawOtMinutes * 2;
      otHours = Math.round((x2OtMinutes / 60) * 10) / 10;
    }
  }

  if (checkIn && checkOut) {
    const inMin = dateToMinutes(checkIn);
    const outMin = dateToMinutes(checkOut);

    let actualBreakOverlap = 0;
    if (breakStartMin && breakEndMin && breakEndMin > breakStartMin) {
      const overlapStart = Math.max(inMin, breakStartMin);
      const overlapEnd = Math.min(outMin, breakEndMin);
      if (overlapEnd > overlapStart) {
        actualBreakOverlap = overlapEnd - overlapStart;
      }
    }

    let totalMinutes = Math.max(0, outMin - inMin - actualBreakOverlap);
    workHours = Math.max(0, Math.round((totalMinutes / 60) * 10) / 10);

    const baseUnits = shift.workUnits || 1.0;

    if (isLateOver30Mins) {
      if (baseUnits >= 3.0) {
        calculatedWorkUnits = 2.0;
      } else if (baseUnits >= 2.0) {
        calculatedWorkUnits = 1.0;
      } else {
        calculatedWorkUnits = 0.0;
      }
    } else {
      const standardShiftHours = Math.max(1, (shiftEndMin - shiftStartMin - breakDurationMin) / 60);
      if (workHours >= standardShiftHours * 0.8) {
        calculatedWorkUnits = baseUnits;
      } else if (workHours >= standardShiftHours * 0.4) {
        calculatedWorkUnits = Math.round(baseUnits * 0.5 * 10) / 10;
      } else {
        calculatedWorkUnits = 0;
      }
    }
  }

  return {
    lateMinutes,
    earlyMinutes,
    workHours,
    otHours,
    calculatedWorkUnits,
    checkInStatus,
    checkOutStatus,
    isLateOver30Mins,
  };
}

function registerTier6Tests() {
  describe('Tier 6 - Feature: Clinic Shifts, Late Rules, Study Override & OT x2', () => {
    let lamClient;
    let managerClient;
    let hrClient;
    let adminClient;

    let lamUser;
    let managerUser;
    let hrUser;

    test('6.1 Login all test roles', async () => {
      lamClient = new HttpClient();
      const resLam = await lamClient.login('lam@peace.vn', 'user123');
      assertEqual(resLam.status, 200, 'Lam login 200');
      lamUser = resLam.data.user;

      managerClient = new HttpClient();
      const resManager = await managerClient.login('manager@peace.vn', 'admin123');
      assertEqual(resManager.status, 200, 'Manager login 200');
      managerUser = resManager.data.user;

      hrClient = new HttpClient();
      const resHr = await hrClient.login('hr@peace.vn', 'admin123');
      assertEqual(resHr.status, 200, 'HR login 200');
      hrUser = resHr.data.user;

      adminClient = new HttpClient();
      const resAdmin = await adminClient.login('admin@peace.vn', 'admin123');
      assertEqual(resAdmin.status, 200, 'Admin login 200');
    });

    test('6.2 Verify standard shifts (T2-T7 Ca 1, 2, 3, All-Day & Sunday)', async () => {
      const res = await hrClient.get('/api/admin/shifts');
      assertEqual(res.status, 200, 'Status 200');
      const shifts = res.data.shifts;

      const shift1 = shifts.find((s) => s.code === 'CA_1_SANG');
      const shift2 = shifts.find((s) => s.code === 'CA_2_CHIEU');
      const shift3 = shifts.find((s) => s.code === 'CA_3_TOI');
      const shiftAllDay = shifts.find((s) => s.code === 'CA_ALL_DAY');
      const shiftCNSang = shifts.find((s) => s.code === 'CA_CN_SANG');
      const shiftCNChieu = shifts.find((s) => s.code === 'CA_CN_CHIEU');

      assert(shift1 !== undefined, 'CA_1_SANG exists');
      assertEqual(shift1.startTime, '08:00', 'Ca 1 starts at 08:00');
      assertEqual(shift1.endTime, '12:00', 'Ca 1 ends at 12:00');
      assertEqual(shift1.workUnits, 1.0, 'Ca 1 is 1.0 work unit');

      assert(shift2 !== undefined, 'CA_2_CHIEU exists');
      assertEqual(shift2.startTime, '13:30', 'Ca 2 starts at 13:30');
      assertEqual(shift2.endTime, '17:30', 'Ca 2 ends at 17:30');

      assert(shift3 !== undefined, 'CA_3_TOI exists');
      assertEqual(shift3.startTime, '15:30', 'Ca 3 starts at 15:30');
      assertEqual(shift3.endTime, '19:30', 'Ca 3 ends at 19:30');

      assert(shiftAllDay !== undefined, 'CA_ALL_DAY exists');
      assertEqual(shiftAllDay.workUnits, 3.0, 'CA_ALL_DAY is 3.0 work units');

      assert(shiftCNSang !== undefined, 'CA_CN_SANG exists');
      assert(shiftCNChieu !== undefined, 'CA_CN_CHIEU exists');
    });

    test('6.3 Late > 30 mins Rule: Arriving at 08:35 on 3-unit full-day cancels morning shift -> 2.0 units', () => {
      const shiftAllDay = {
        startTime: '08:00',
        endTime: '19:30',
        breakStartTime: '12:00',
        breakEndTime: '13:30',
        gracePeriodLate: 15,
        gracePeriodEarly: 15,
        workUnits: 3.0,
      };

      const inDate = new Date('2026-09-08T08:35:00'); // 35 mins late (> 30 mins)
      const outDate = new Date('2026-09-08T19:30:00');

      const metrics = calculateAttendanceMetrics(inDate, outDate, shiftAllDay);
      assertEqual(metrics.lateMinutes, 35, 'Late 35 minutes');
      assertEqual(metrics.isLateOver30Mins, true, 'isLateOver30Mins is true');
      assertEqual(metrics.calculatedWorkUnits, 2.0, 'Calculated work units reduced to 2.0 (morning canceled)');
    });

    test('6.4 OT Rule: Overtime >= 15 mins outside shift end calculated with x2 multiplier', () => {
      const shiftStandard = {
        startTime: '08:00',
        endTime: '17:30',
        gracePeriodLate: 15,
        gracePeriodEarly: 15,
        workUnits: 1.0,
      };

      // Check-out 45 mins late (18:15) -> 45 mins * 2 = 90 mins = 1.5 hours OT
      const inDate = new Date('2026-09-08T08:00:00');
      const outDate = new Date('2026-09-08T18:15:00');

      const metrics = calculateAttendanceMetrics(inDate, outDate, shiftStandard);
      assertEqual(metrics.otHours, 1.5, 'OT is (45m * 2) / 60 = 1.5 hours');
    });

    test('6.5 Manual Override API: HR / Manager overrides attendance for study day (Đi học đặc cách -> 2.0 công)', async () => {
      const targetDate = '2026-09-12';

      const res = await hrClient.post('/api/admin/timesheet/override', {
        userId: lamUser.id,
        workDate: targetDate,
        workUnits: 2.0,
        workHours: 5.5,
        lateMinutes: 0,
        otHours: 0,
        status: 'EXPLAINED',
        note: 'Đi học được duyệt đặc cách 2 ca (14:00 - 19:30)',
      });

      assertEqual(res.status, 200, 'Override API returns 200');
      assert(res.data.success === true, 'Success is true');
      assertEqual(res.data.attendance.calculatedWorkUnits, 2.0, 'Work units is 2.0');
      assert(res.data.attendance.note.includes('Đi học được duyệt đặc cách'), 'Note contains reason');

      // Verify in Timesheet API
      const resTs = await hrClient.get(`/api/admin/timesheet?month=9&year=2026&search=${lamUser.employeeCode}`);
      assertEqual(resTs.status, 200, 'Timesheet query returns 200');
      const lamRow = resTs.data.matrix.find((m) => m.user.id === lamUser.id);
      const day12Record = lamRow.dailyRecords[12];
      assert(day12Record !== null, 'Day 12 record exists');
      assertEqual(day12Record.workUnits, 2.0, 'Day 12 reflects 2.0 work units');
    });

    test('6.6 Verify all 8 Standardized Approval Templates exist in system', async () => {
      const res = await hrClient.get('/api/approvals/templates');
      assertEqual(res.status, 200, 'Status 200');
      const templates = res.data.templates;

      const expectedCodes = [
        'LEAVE_ANNUAL',
        'LEAVE_UNPAID',
        'LEAVE_SICK',
        'LEAVE_SPECIAL',
        'LEAVE_HALF_SHIFT',
        'LATE_EARLY_CONFIRM',
        'FORGOT_CHECKIN_CONFIRM',
        'OVERTIME_X2_CONFIRM',
      ];

      for (const code of expectedCodes) {
        const found = templates.find((t) => t.code === code);
        assert(found !== undefined, `Template ${code} exists in system`);
      }
    });

    test('6.7 Exception 1: Submit LEAVE_HALF_SHIFT (0.5 công phép) -> Approved -> Timesheet reflects 0.5 LEAVE', async () => {
      const resTpl = await lamClient.get('/api/approvals/templates');
      const tpl = resTpl.data.templates.find((t) => t.code === 'LEAVE_HALF_SHIFT');

      const submitRes = await lamClient.post('/api/approvals', {
        templateId: tpl.id,
        data: {
          workDate: '2026-09-14',
          shiftType: 'Nửa ca sáng (08h00 - 10h00)',
          duration: 0.5,
          reason: 'Xin nghỉ nửa ca sáng vì việc gia đình',
        },
        approvers: {
          1: managerUser.id,
          2: hrUser.id,
        },
      });

      assertEqual(submitRes.status, 200, 'Submit 200');
      const reqId = submitRes.data.request.id;

      // Manager approves step 1
      await managerClient.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'Đồng ý 0.5 ca' });

      // HR approves step 2
      const hrAction = await hrClient.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'HR xác nhận 0.5 công phép' });
      assertEqual(hrAction.status, 200, 'HR approval 200');

      // Verify in Timesheet API
      const resTs = await hrClient.get(`/api/admin/timesheet?month=9&year=2026&search=${lamUser.employeeCode}`);
      const lamRow = resTs.data.matrix.find((m) => m.user.id === lamUser.id);
      const day14Record = lamRow.dailyRecords[14];
      assert(day14Record !== null, 'Day 14 record exists');
      assertEqual(day14Record.status, 'LEAVE', 'Status is LEAVE');
      assertEqual(day14Record.workUnits, 0.5, 'Work units is 0.5');
    });

    test('6.8 Exception 2: LATE_EARLY_CONFIRM removes lateness penalty and restores full 3.0 work units', async () => {
      const resTpl = await lamClient.get('/api/approvals/templates');
      const tpl = resTpl.data.templates.find((t) => t.code === 'LATE_EARLY_CONFIRM');

      const submitRes = await lamClient.post('/api/approvals', {
        templateId: tpl.id,
        data: {
          workDate: '2026-09-08',
          type: 'Xác nhận đi trễ',
          actualMinutes: 35,
          reason: 'Kẹt xe cầu Chương Dương có xác nhận',
        },
        approvers: {
          1: managerUser.id,
        },
      });

      assertEqual(submitRes.status, 200, 'Submit 200');
      const reqId = submitRes.data.request.id;

      // Manager approves
      const actionRes = await managerClient.post(`/api/approvals/${reqId}/action`, {
        action: 'APPROVE',
        note: 'Quản lý xác nhận xóa phạt trễ',
      });
      assertEqual(actionRes.status, 200, 'Action 200');

      // Verify in Timesheet API
      const resTs = await hrClient.get(`/api/admin/timesheet?month=9&year=2026&search=${lamUser.employeeCode}`);
      const lamRow = resTs.data.matrix.find((m) => m.user.id === lamUser.id);
      const day8Record = lamRow.dailyRecords[8];
      assert(day8Record !== null, 'Day 8 record exists');
      assertEqual(day8Record.lateMinutes, 0, 'Late minutes reset to 0');
      assertEqual(day8Record.status, 'EXPLAINED', 'Status is EXPLAINED');
    });

    test('6.9 Overtime x2 Confirm Form: OVERTIME_X2_CONFIRM enriches attendance with double OT hours', async () => {
      const resTpl = await lamClient.get('/api/approvals/templates');
      const tpl = resTpl.data.templates.find((t) => t.code === 'OVERTIME_X2_CONFIRM');

      // 60 mins OT -> x2 = 120 mins = 2.0h OT
      const submitRes = await lamClient.post('/api/approvals', {
        templateId: tpl.id,
        data: {
          workDate: '2026-09-13',
          otStartTime: '19:30',
          otEndTime: '20:30',
          actualMinutes: 60,
          doctorOrManagerName: 'Bác sĩ Nguyễn Văn Trưởng',
          taskDescription: 'Ca cấy ghép Implant kéo dài',
        },
        approvers: {
          1: managerUser.id,
          2: hrUser.id,
        },
      });

      assertEqual(submitRes.status, 200, 'Submit 200');
      const reqId = submitRes.data.request.id;

      await managerClient.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'Bác sĩ xác nhận' });
      await hrClient.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'HR tính OT x2' });

      // Verify in Timesheet API
      const resTs = await hrClient.get(`/api/admin/timesheet?month=9&year=2026&search=${lamUser.employeeCode}`);
      const lamRow = resTs.data.matrix.find((m) => m.user.id === lamUser.id);
      const day13Record = lamRow.dailyRecords[13];
      assert(day13Record !== null, 'Day 13 record exists');
      assertEqual(day13Record.otHours, 2.0, 'OT hours is 2.0 (60m * 2 / 60 = 2.0h)');
    });

    test('6.10 Biometric Fingerprint Sync API: GET & POST /api/attendance/biometric syncs terminal logs with FINGERPRINT status', async () => {
      // 1. GET status of biometric devices
      const getRes = await hrClient.get('/api/attendance/biometric');
      assertEqual(getRes.status, 200, 'GET biometric info 200');
      assert(Array.isArray(getRes.data.devices), 'Devices is array');
      assert(getRes.data.devices.length >= 2, 'Has at least 2 terminals');

      // 2. POST sync fingerprint punches
      const syncRes = await hrClient.post('/api/attendance/biometric', {
        action: 'sync_all',
      });
      assertEqual(syncRes.status, 200, 'POST biometric sync 200');
      assert(syncRes.data.success, 'Sync returned success');
      assert(syncRes.data.updatedUsersCount >= 1, 'Updated at least 1 user');

      // 3. Verify specific fingerprint log upload (using local ISO format)
      const specificSyncRes = await hrClient.post('/api/attendance/biometric', {
        logs: [
          {
            employeeCode: lamUser.employeeCode,
            timestamp: '2026-09-22T07:50:00',
            verifyType: 'FINGERPRINT',
            deviceName: 'Máy Vân Tay Cửa Chính - Chi Nhánh 1',
          },
          {
            employeeCode: lamUser.employeeCode,
            timestamp: '2026-09-22T17:35:00',
            verifyType: 'FINGERPRINT',
            deviceName: 'Máy Vân Tay Cửa Chính - Chi Nhánh 1',
          },
        ],
      });
      assertEqual(specificSyncRes.status, 200, 'Specific sync 200');

      // Check in Timesheet
      const resTs = await hrClient.get(`/api/admin/timesheet?month=9&year=2026&search=${lamUser.employeeCode}`);
      const lamRow = resTs.data.matrix.find((m) => m.user.id === lamUser.id);
      const day22Record = lamRow.dailyRecords[22];
      assert(day22Record !== null, 'Day 22 record exists');
      assertEqual(day22Record.status, 'PRESENT', 'Status is PRESENT');
      assertEqual(day22Record.lateMinutes, 0, 'No late minutes (07:50 < 08:00)');
    });

    test('6.11 Forgotten punch rule: Unexplained missing check-in results in 0.0 work units on timesheet', async () => {
      // Day 29 has no attendance record and no approved request -> Should be null or 0 work units
      const resTs = await hrClient.get(`/api/admin/timesheet?month=9&year=2026&search=${lamUser.employeeCode}`);
      const lamRow = resTs.data.matrix.find((m) => m.user.id === lamUser.id);
      const day29Record = lamRow.dailyRecords[29];
      assert(day29Record === null || day29Record.workUnits === 0, 'Unexplained day 29 has 0 work units');
    });

    test('6.12 Manager creates FORGOT_CHECKIN_CONFIRM on behalf of employee (targetUserId) -> Approved -> Timesheet updated to EXPLAINED', async () => {
      const resTpl = await managerClient.get('/api/approvals/templates');
      const tpl = resTpl.data.templates.find((t) => t.code === 'FORGOT_CHECKIN_CONFIRM');

      // Manager submits form ON BEHALF OF employee Lam (targetUserId)
      const submitRes = await managerClient.post('/api/approvals', {
        templateId: tpl.id,
        targetUserId: lamUser.id,
        data: {
          workDate: '2026-09-29',
          checkInTime: '08:00',
          checkOutTime: '17:30',
          reason: 'Nhân sự quên bấm vân tay đầu ca sáng, đã báo quản lý trực tiếp xác nhận',
        },
        approvers: {
          1: managerUser.id,
          2: hrUser.id,
        },
      });

      assertEqual(submitRes.status, 200, 'Submit 200');
      const reqId = submitRes.data.request.id;
      assertEqual(submitRes.data.request.creatorId, lamUser.id, 'Creator is employee Lam');

      // Manager approves Step 1
      const actionRes1 = await managerClient.post(`/api/approvals/${reqId}/action`, {
        action: 'APPROVE',
        note: 'Quản lý xác nhận có mặt làm việc đúng giờ',
      });
      assertEqual(actionRes1.status, 200, 'Step 1 Action 200');

      // HR approves Step 2 (Final approval -> creates attendance record)
      const actionRes2 = await hrClient.post(`/api/approvals/${reqId}/action`, {
        action: 'APPROVE',
        note: 'HR xác nhận cập nhật công hợp lệ',
      });
      assertEqual(actionRes2.status, 200, 'Step 2 Action 200');

      // Verify in Timesheet API
      const resTs = await hrClient.get(`/api/admin/timesheet?month=9&year=2026&search=${lamUser.employeeCode}`);
      const lamRow = resTs.data.matrix.find((m) => m.user.id === lamUser.id);
      const day29Record = lamRow.dailyRecords[29];
      assert(day29Record !== null, 'Day 29 record now exists');
      assertEqual(day29Record.status, 'EXPLAINED', 'Status is EXPLAINED');
      assert(day29Record.workUnits >= 1.0, 'Work units restored to at least 1.0');
    });
  });
}

module.exports = { registerTier6Tests };
