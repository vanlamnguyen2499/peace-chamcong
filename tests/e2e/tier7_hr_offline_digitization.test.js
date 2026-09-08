/**
 * Tier 7: HR Offline Slip Digitization Hub (Cổng Nhập & Số Hóa Phiếu Xác Nhận Ký Tay Của Bác Sĩ)
 * Comprehensive testing of single entry, batch entry, auto-approval, timesheet side-effects,
 * notification broadcasts, and audit filtering.
 */

const { describe, test, assert, assertEqual, HttpClient } = require('./harness');

function registerTier7Tests() {
  describe('Tier 7 - Feature: HR Offline Slip Digitization Hub', () => {
    const adminClient = new HttpClient();
    const hrClient = new HttpClient();
    const managerClient = new HttpClient();
    const lamClient = new HttpClient();

    let adminUser, hrUser, managerUser, lamUser;

    test('7.1 Login accounts and resolve master data', async () => {
      const resAdmin = await adminClient.post('/api/auth/login', { email: 'admin@peace.vn', password: 'admin123' });
      assertEqual(resAdmin.status, 200, 'Admin login 200');
      adminUser = resAdmin.data.user;

      const resHr = await hrClient.post('/api/auth/login', { email: 'hr@peace.vn', password: 'admin123' });
      assertEqual(resHr.status, 200, 'HR login 200');
      hrUser = resHr.data.user;

      const resMgr = await managerClient.post('/api/auth/login', { email: 'manager@peace.vn', password: 'admin123' });
      assertEqual(resMgr.status, 200, 'Manager login 200');
      managerUser = resMgr.data.user;

      const resLam = await lamClient.post('/api/auth/login', { email: 'lam@peace.vn', password: 'user123' });
      assertEqual(resLam.status, 200, 'Lam login 200');
      lamUser = resLam.data.user;
    });

    test('7.2 Single Entry: HR digitizes an OVERTIME_X2_CONFIRM slip signed by Doctor -> Auto-Approved with OT x2', async () => {
      const workDate = '2026-09-18';
      const targetMinutes = 75; // 75 mins -> x2 = 150 mins = 2.5 hours OT

      const res = await hrClient.post('/api/approvals/digitize', {
        targetUserId: lamUser.id,
        templateCode: 'OVERTIME_X2_CONFIRM',
        signedByApproverId: managerUser.id,
        signedByApproverName: managerUser.name,
        paperSlipCode: 'PKT-202609-001',
        paperSlipPhotoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        data: {
          workDate,
          actualMinutes: targetMinutes,
          otStartTime: '19:30',
          otEndTime: '20:45',
          reason: 'Ca cấy ghép Implant phức tạp kéo dài',
          doctorOrManagerName: managerUser.name,
        },
      });

      assertEqual(res.status, 200, 'Digitize single slip returns 200');
      assert(res.data.success === true, 'Success is true');
      assertEqual(res.data.count, 1, 'Count is 1');

      const createdReq = res.data.requests[0];
      assertEqual(createdReq.status, 'APPROVED', 'Status is APPROVED immediately');
      assertEqual(createdReq.isDigitizedOffline, true, 'isDigitizedOffline is true');
      assertEqual(createdReq.signedByApproverId, managerUser.id, 'signedByApproverId matches');

      // Verify in Timesheet API
      const resTs = await hrClient.get(`/api/admin/timesheet?month=9&year=2026&search=${lamUser.employeeCode}`);
      assertEqual(resTs.status, 200, 'Timesheet 200');
      const lamRow = resTs.data.matrix.find((m) => m.user.id === lamUser.id);
      const day18Record = lamRow.dailyRecords[18];
      assert(day18Record !== null, 'Day 18 record exists');
      assertEqual(day18Record.otHours, 2.5, 'OT is (75 * 2) / 60 = 2.5 hours');
    });

    test('7.3 Batch Entry: HR digitizes 3 signed paper slips in one click (Forgot Checkin, Half Shift Leave, Late Confirm)', async () => {
      const batchItems = [
        {
          targetUserId: lamUser.id,
          templateCode: 'FORGOT_CHECKIN_CONFIRM',
          signedByApproverId: managerUser.id,
          signedByApproverName: managerUser.name,
          data: {
            workDate: '2026-09-19',
            checkInTime: '08:00',
            checkOutTime: '17:30',
            reason: 'Quên bấm vân tay ca sáng, Bác sĩ xác nhận có mặt',
          },
        },
        {
          targetUserId: lamUser.id,
          templateCode: 'LEAVE_HALF_SHIFT',
          signedByApproverId: managerUser.id,
          signedByApproverName: managerUser.name,
          data: {
            workDate: '2026-09-21',
            duration: 0.5,
            reason: 'Xin nghỉ nửa ca sáng đi khám răng định kỳ',
          },
        },
        {
          targetUserId: lamUser.id,
          templateCode: 'LATE_EARLY_CONFIRM',
          signedByApproverId: managerUser.id,
          signedByApproverName: managerUser.name,
          data: {
            workDate: '2026-09-23',
            reason: 'Đi trễ vì tắc đường mưa to, Bác sĩ ký xác nhận xóa phạt',
          },
        },
      ];

      const res = await hrClient.post('/api/approvals/digitize', { items: batchItems });
      assertEqual(res.status, 200, 'Batch digitize returns 200');
      assertEqual(res.data.count, 3, 'Processed 3 slips');

      // Verify in Timesheet
      const resTs = await hrClient.get(`/api/admin/timesheet?month=9&year=2026&search=${lamUser.employeeCode}`);
      const lamRow = resTs.data.matrix.find((m) => m.user.id === lamUser.id);

      // Day 19: Forgot checkin restored
      const day19 = lamRow.dailyRecords[19];
      assert(day19 !== null, 'Day 19 exists');
      assertEqual(day19.status, 'EXPLAINED', 'Day 19 is EXPLAINED');
      assert(day19.workUnits >= 1.0, 'Day 19 has work units');

      // Day 21: Half shift leave
      const day21 = lamRow.dailyRecords[21];
      assert(day21 !== null, 'Day 21 exists');
      assertEqual(day21.status, 'LEAVE', 'Day 21 is LEAVE');
      assertEqual(day21.workUnits, 0.5, 'Day 21 is 0.5 work units');
    });

    test('7.4 Transparency: Employee Lam receives notification and sees digitized slips in My Requests', async () => {
      // 1. Check notifications
      const notifRes = await lamClient.get('/api/notifications');
      assertEqual(notifRes.status, 200, 'Get notifications 200');
      const digitizedNotif = notifRes.data.notifications.find((n) =>
        n.title.includes('HR số hóa') || n.title.includes('Phiếu xác nhận')
      );
      assert(digitizedNotif !== undefined, 'Employee received digitization notification');

      // 2. Check My Requests tab
      const reqsRes = await lamClient.get('/api/approvals?tab=my_requests');
      assertEqual(reqsRes.status, 200, 'My requests 200');
      const offlineSlip = reqsRes.data.requests.find((r) => r.isDigitizedOffline === true);
      assert(offlineSlip !== undefined, 'Offline digitized request visible in employee list');
      assertEqual(offlineSlip.status, 'APPROVED', 'Status is APPROVED');
    });

    test('7.5 Transparency: Signing Doctor (Manager) receives notification and sees digitized slip in History', async () => {
      const notifRes = await managerClient.get('/api/notifications');
      assertEqual(notifRes.status, 200, 'Get notifications 200');
      const docNotif = notifRes.data.notifications.find((n) =>
        n.title.includes('số hóa phiếu ký tay') || n.message.includes('số hóa phiếu xác nhận')
      );
      assert(docNotif !== undefined, 'Doctor received confirmation notification');

      const historyRes = await managerClient.get('/api/approvals?tab=history_me');
      assertEqual(historyRes.status, 200, 'History tab 200');
      const processedSlip = historyRes.data.requests.find((r) => r.isDigitizedOffline === true);
      assert(processedSlip !== undefined, 'Processed slip appears in Manager history');
    });

    test('7.6 Audit API: GET /api/approvals/digitize returns accurate registry and KPI metrics', async () => {
      const res = await hrClient.get('/api/approvals/digitize');
      assertEqual(res.status, 200, 'Audit API returns 200');
      assert(Array.isArray(res.data.requests), 'Requests is array');
      assert(res.data.requests.length >= 4, 'Has at least 4 digitized requests');
      assert(res.data.stats.totalDigitized >= 4, 'Total digitized >= 4');
      assert(res.data.stats.totalWithPhoto >= 1, 'Total with photo >= 1');

      // Filter by hasPhoto=true
      const photoRes = await hrClient.get('/api/approvals/digitize?hasPhoto=true');
      assertEqual(photoRes.status, 200, 'Photo filter 200');
      assert(photoRes.data.requests.every((r) => r.paperSlipPhotoUrl !== null), 'All returned items have photo');
    });

    test('7.7 RBAC Security: Employee cannot call POST /api/approvals/digitize (HTTP 403)', async () => {
      const res = await lamClient.post('/api/approvals/digitize', {
        targetUserId: lamUser.id,
        templateCode: 'FORGOT_CHECKIN_CONFIRM',
      });
      assertEqual(res.status, 403, 'Employee returns 403 Forbidden');
    });

    test('7.8 Standard Request with Optional Photo: Employee/HR attaches photo of handwritten paper slip -> Photo stored and retrievable', async () => {
      const tplRes = await hrClient.get('/api/approvals/templates');
      const leaveTpl = tplRes.data.templates.find((t) => t.code === 'LEAVE_ANNUAL') || tplRes.data.templates[0];
      const mockPhotoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const createRes = await hrClient.post('/api/approvals', {
        templateId: leaveTpl.id,
        targetUserId: lamUser.id,
        paperSlipPhotoUrl: mockPhotoBase64,
        paperSlipCode: 'GIAY-PHEP-2026-001',
        signedByApproverName: 'BS. Lê Hoàng',
        data: {
          startDate: '2026-09-25',
          duration: 1.0,
          reason: 'Nghỉ phép năm có kèm ảnh giấy xác nhận viết tay của Bác sĩ',
        },
      });

      assertEqual(createRes.status, 200, 'Create request with optional photo returns 200');
      const reqId = createRes.data.request.id;
      assertEqual(createRes.data.request.paperSlipPhotoUrl, mockPhotoBase64, 'Photo URL saved on request');
      assertEqual(createRes.data.request.signedByApproverName, 'BS. Lê Hoàng', 'Signer name saved');

      // Verify GET /api/approvals/[id]
      const detailRes = await hrClient.get(`/api/approvals/${reqId}`);
      assertEqual(detailRes.status, 200, 'Get detail returns 200');
      assertEqual(detailRes.data.request.paperSlipPhotoUrl, mockPhotoBase64, 'Detail includes paperSlipPhotoUrl');
      assertEqual(detailRes.data.request.paperSlipCode, 'GIAY-PHEP-2026-001', 'Detail includes paperSlipCode');
    });

    test('7.9 Photo is strictly Optional: Creating request without photo succeeds cleanly with 200', async () => {
      const tplRes = await hrClient.get('/api/approvals/templates');
      const sickTpl = tplRes.data.templates.find((t) => t.code === 'LEAVE_SICK') || tplRes.data.templates[0];

      const createRes = await lamClient.post('/api/approvals', {
        templateId: sickTpl.id,
        data: {
          startDate: '2026-09-26',
          duration: 1.0,
          reason: 'Nghỉ ốm thông thường không đính kèm ảnh',
        },
      });

      assertEqual(createRes.status, 200, 'Create request without photo returns 200');
      assert(createRes.data.request.id !== undefined, 'Request created successfully');
      assertEqual(createRes.data.request.paperSlipPhotoUrl, null, 'paperSlipPhotoUrl is null');
    });
  });
}

module.exports = { registerTier7Tests };
