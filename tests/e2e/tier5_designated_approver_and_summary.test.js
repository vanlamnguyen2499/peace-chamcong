/**
 * Tier 5: Designated Approver Selection and Approval Summary Hub Tests
 */

const { describe, test, assert, assertEqual, HttpClient } = require('./harness');
const ExcelJS = require('exceljs');

function registerTier5Tests() {
  describe('Tier 5 - Feature: Designated Approver & Summary Hub', () => {
    let lamClient;
    let managerClient;
    let hrClient;
    let superAdminClient;

    let managerUser;
    let hrUser;
    let lamUser;
    let leaveTemplate;
    let createdRequestId;
    let createdRequestCode;

    test('5.1 Login all test accounts', async () => {
      lamClient = new HttpClient();
      const resLam = await lamClient.login('lam@peace.vn', 'user123');
      assertEqual(resLam.status, 200, 'Lam login status 200');
      lamUser = resLam.data.user;

      managerClient = new HttpClient();
      const resManager = await managerClient.login('manager@peace.vn', 'admin123');
      assertEqual(resManager.status, 200, 'Manager login status 200');
      managerUser = resManager.data.user;

      hrClient = new HttpClient();
      const resHr = await hrClient.login('hr@peace.vn', 'admin123');
      assertEqual(resHr.status, 200, 'HR login status 200');
      hrUser = resHr.data.user;

      superAdminClient = new HttpClient();
      const resAdmin = await superAdminClient.login('admin@peace.vn', 'admin123');
      assertEqual(resAdmin.status, 200, 'Admin login status 200');
    });

    test('5.2 GET /api/approvals/approvers returns list of approvers and recommendations', async () => {
      const res = await lamClient.get('/api/approvals/approvers');
      assertEqual(res.status, 200, 'Status is 200');

      const data = res.data;
      assert(Array.isArray(data.users), 'Users is an array');
      assert(data.users.length >= 3, 'Contains multiple users');
      assert(data.recommendations !== undefined, 'Contains recommendations');
      assert(data.groups !== undefined, 'Contains groups');

      if (lamUser.managerId && data.recommendations.directManager) {
        assertEqual(data.recommendations.directManager.id, lamUser.managerId, 'Recommends direct manager');
      }
    });

    test('5.3 Resolve LEAVE template', async () => {
      const res = await lamClient.get('/api/approvals/templates');
      assertEqual(res.status, 200, 'Status 200');
      const data = res.data;
      leaveTemplate = data.templates.find((t) => t.code === 'LEAVE');
      assert(leaveTemplate !== undefined, 'Leave template found');
    });

    test('5.4 Employee submits request selecting designated approvers for Step 1 & Step 2', async () => {
      const payload = {
        templateId: leaveTemplate.id,
        data: {
          leaveType: 'ANNUAL',
          startDate: '2026-09-20',
          endDate: '2026-09-20',
          duration: 1.0,
          reason: 'Nghỉ phép việc gia đình (chỉ định người duyệt)',
        },
        approvers: {
          1: managerUser.id,
          2: hrUser.id,
        },
      };

      const res = await lamClient.post('/api/approvals', payload);
      assertEqual(res.status, 200, 'Submit returned 200');
      const resData = res.data;
      assert(resData.success === true, 'Request created successfully');
      assert(resData.request !== undefined, 'Request returned');

      createdRequestId = resData.request.id;
      createdRequestCode = resData.request.code;

      const step1 = resData.request.steps.find((s) => s.stepOrder === 1);
      const step2 = resData.request.steps.find((s) => s.stepOrder === 2);

      assertEqual(step1.approverId, managerUser.id, 'Step 1 approverId bound to manager');
      assertEqual(step2.approverId, hrUser.id, 'Step 2 approverId bound to HR');
    });

    test('5.5 Designated Approver (Manager) sees request in pending_me tab', async () => {
      const res = await managerClient.get('/api/approvals?tab=pending_me');
      assertEqual(res.status, 200, 'Status 200');

      const data = res.data;
      const found = data.requests.find((r) => r.id === createdRequestId);
      assert(found !== undefined, 'Request appears in Manager pending_me tab');
      assert(data.counts.pendingMe > 0, 'Pending me counter is greater than 0');
    });

    test('5.6 Designated Approver (Manager) approves Step 1 with opinion note', async () => {
      const res = await managerClient.post(`/api/approvals/${createdRequestId}/action`, {
        action: 'APPROVE',
        note: 'Đồng ý duyệt cho Lâm nghỉ ngày 20/09',
      });

      assertEqual(res.status, 200, 'Step 1 approved successfully');
    });

    test('5.7 Manager checks history_me tab (Tôi Đã Duyệt) and sees processed request', async () => {
      const res = await managerClient.get('/api/approvals?tab=history_me');
      assertEqual(res.status, 200, 'Status 200');

      const data = res.data;
      const found = data.requests.find((r) => r.id === createdRequestId);
      assert(found !== undefined, 'Request appears in Manager history_me tab');
      assert(data.counts.historyMe > 0, 'History counter incremented');
    });

    test('5.8 Requester (Lam) checks my_requests tab (Đơn Của Tôi) and sees progress', async () => {
      const res = await lamClient.get('/api/approvals?tab=my_requests');
      assertEqual(res.status, 200, 'Status 200');

      const data = res.data;
      const found = data.requests.find((r) => r.id === createdRequestId);
      assert(found !== undefined, 'Request found in my_requests');
      assertEqual(found.currentStep, 2, 'Request progressed to step 2');

      const step1 = found.steps.find((s) => s.stepOrder === 1);
      assertEqual(step1.status, 'APPROVED', 'Step 1 status is APPROVED');
      assertEqual(step1.note, 'Đồng ý duyệt cho Lâm nghỉ ngày 20/09', 'Step 1 note is present');
    });

    test('5.9 Designated Approver 2 (HR) approves Step 2', async () => {
      const res = await hrClient.post(`/api/approvals/${createdRequestId}/action`, {
        action: 'APPROVE',
        note: 'HR đã ghi nhận và trừ phép',
      });

      assertEqual(res.status, 200, 'Step 2 approved successfully');
    });

    test('5.10 Summary API (/api/approvals/summary) returns accurate stats', async () => {
      const res = await hrClient.get('/api/approvals/summary');
      assertEqual(res.status, 200, 'Status 200');

      const data = res.data;
      assert(data.summary !== undefined, 'Contains summary object');
      assert(data.summary.total > 0, 'Total requests > 0');
      assert(data.summary.approved > 0, 'Approved requests > 0');
      assert(Array.isArray(data.templateStats), 'Contains templateStats');
    });

    test('5.11 Export Excel API (/api/approvals/export) generates valid 2-sheet workbook', async () => {
      const res = await hrClient.get('/api/approvals/export');
      assertEqual(res.status, 200, 'Status 200');
      assert(
        res.headers.get('content-type').includes('spreadsheetml') ||
        res.headers.get('content-type').includes('octet-stream'),
        'Content type is Excel'
      );

      const buffer = res.data;
      assert(Buffer.isBuffer(buffer) && buffer.length > 1000, 'Buffer has content');

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);

      assertEqual(wb.worksheets.length, 2, 'Workbook has exactly 2 sheets');
      assertEqual(wb.worksheets[0].name, 'Sổ Phê Duyệt', 'Sheet 1 is Sổ Phê Duyệt');
      assertEqual(wb.worksheets[1].name, 'Thống Kê Tổng Hợp', 'Sheet 2 is Thống Kê Tổng Hợp');

      const sheet1 = wb.worksheets[0];
      assert(sheet1.rowCount >= 4, 'Sheet 1 has title + headers + data rows');
    });

    test('5.12 Filter by approverId and creatorId in /api/approvals', async () => {
      const resCreator = await hrClient.get(`/api/approvals?tab=all&creatorId=${lamUser.id}`);
      const dataCreator = resCreator.data;
      assert(
        dataCreator.requests.every((r) => r.creator.id === lamUser.id),
        'All filtered requests belong to creator'
      );

      const resApprover = await hrClient.get(`/api/approvals?tab=all&approverId=${managerUser.id}`);
      const dataApprover = resApprover.data;
      assert(
        dataApprover.requests.some((r) => r.id === createdRequestId),
        'Approver filter found the request'
      );
    });
  });
}

module.exports = { registerTier5Tests };
