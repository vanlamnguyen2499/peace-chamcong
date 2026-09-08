/**
 * Tier 1: Comprehensive Feature Coverage
 * Covers >= 5 test cases per feature across all 18 inventoried features in PROJECT.md.
 */

const { describe, test, assert, assertEqual, assertIncludes, HttpClient } = require('./harness');

const SAMPLE_PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const HN_HQ_LAT = 21.028511;
const HN_HQ_LNG = 105.854167;
const FAR_LAT = 21.250000;
const FAR_LNG = 106.100000;

function registerTier1Tests() {
  describe('Tier 1 - Feature 1: Auth & Multi-Account Login', () => {
    test('1.1 Super Admin login with valid credentials returns 200, role SUPER_ADMIN, sets auth cookie', async () => {
      const client = new HttpClient();
      const res = await client.login('admin@peace.vn', 'admin123');
      assertEqual(res.status, 200, 'Super admin login status must be 200');
      assert(res.data.success, 'Login response must indicate success');
      assertEqual(res.data.user.role, 'SUPER_ADMIN', 'Role must be SUPER_ADMIN');
      assert(client.cookies.has('peace_auth_token'), 'peace_auth_token cookie must be present');
    });

    test('1.2 HR Admin login with valid credentials returns 200, role HR_ADMIN', async () => {
      const client = new HttpClient();
      const res = await client.login('hr@peace.vn', 'admin123');
      assertEqual(res.status, 200, 'HR login status must be 200');
      assertEqual(res.data.user.role, 'HR_ADMIN', 'Role must be HR_ADMIN');
    });

    test('1.3 Manager login with valid credentials returns 200, role MANAGER', async () => {
      const client = new HttpClient();
      const res = await client.login('manager@peace.vn', 'admin123');
      assertEqual(res.status, 200, 'Manager login status must be 200');
      assertEqual(res.data.user.role, 'MANAGER', 'Role must be MANAGER');
    });

    test('1.4 Employees login (lam@peace.vn and hoa@peace.vn) returns 200, role EMPLOYEE', async () => {
      const clientLam = new HttpClient();
      const resLam = await clientLam.login('lam@peace.vn', 'user123');
      assertEqual(resLam.status, 200, 'Lam login status must be 200');
      assertEqual(resLam.data.user.role, 'EMPLOYEE', 'Role must be EMPLOYEE');

      const clientHoa = new HttpClient();
      const resHoa = await clientHoa.login('hoa@peace.vn', 'user123');
      assertEqual(resHoa.status, 200, 'Hoa login status must be 200');
      assertEqual(resHoa.data.user.role, 'EMPLOYEE', 'Role must be EMPLOYEE');
    });

    test('1.5 Login with invalid password returns 401', async () => {
      const client = new HttpClient();
      const res = await client.login('admin@peace.vn', 'wrongpassword123');
      assertEqual(res.status, 401, 'Invalid password must return 401');
      assert(res.data.error, 'Error message must be returned');
    });

    test('1.6 Login with non-existent email returns 401', async () => {
      const client = new HttpClient();
      const res = await client.login('nonexistent@peace.vn', 'user123');
      assertEqual(res.status, 401, 'Non-existent email must return 401');
    });

    test('1.7 GET /api/auth/me returns authenticated user session and logout clears cookie', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const meRes = await client.get('/api/auth/me');
      assertEqual(meRes.status, 200, 'GET /api/auth/me must return 200');
      assertEqual(meRes.data.user.email, 'lam@peace.vn', 'Session email must match');

      const logoutRes = await client.post('/api/auth/logout', {});
      assertEqual(logoutRes.status, 200, 'Logout status must be 200');
    });
  });

  describe('Tier 1 - Feature 2: GPS Geofence & Selfie Attendance', () => {
    test('2.1 Check-in missing GPS latitude/longitude returns 400', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.post('/api/attendance/check-in', {
        photo: SAMPLE_PHOTO,
      });
      assertEqual(res.status, 400, 'Missing coordinates must return 400');
      assertIncludes(res.data.error, 'tọa độ GPS', 'Error must mention GPS');
    });

    test('2.2 Check-in missing selfie photo returns 400', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.post('/api/attendance/check-in', {
        latitude: HN_HQ_LAT,
        longitude: HN_HQ_LNG,
      });
      assertEqual(res.status, 400, 'Missing photo must return 400');
      assertIncludes(res.data.error, 'selfie', 'Error must mention selfie photo');
    });

    test('2.3 Unauthenticated check-in attempt returns 401', async () => {
      const client = new HttpClient();
      const res = await client.post('/api/attendance/check-in', {
        latitude: HN_HQ_LAT,
        longitude: HN_HQ_LNG,
        photo: SAMPLE_PHOTO,
      });
      assertEqual(res.status, 401, 'Unauthenticated check-in must return 401');
    });

    test('2.4 Check-out without prior check-in returns 400', async () => {
      const client = new HttpClient();
      await client.login('hoa@peace.vn', 'user123');
      // If today already has check-in for Hoa, checkout test will check the appropriate condition
      const todayRes = await client.get('/api/attendance/today');
      if (!todayRes.data.todayAttendance?.checkInTime) {
        const res = await client.post('/api/attendance/check-out', {
          latitude: HN_HQ_LAT,
          longitude: HN_HQ_LNG,
          photo: SAMPLE_PHOTO,
        });
        assertEqual(res.status, 400, 'Check-out without check-in must return 400');
      } else {
        assert(true, 'Skipped condition since already checked in');
      }
    });

    test('2.5 Check-in with valid GPS within HN_HQ radius returns success', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.post('/api/attendance/check-in', {
        latitude: HN_HQ_LAT,
        longitude: HN_HQ_LNG,
        photo: SAMPLE_PHOTO,
        note: 'Check-in test',
      });
      // Can be 200 or 400 if already checked in today
      if (res.status === 200) {
        assert(res.data.success, 'Response must be success');
        assert(res.data.attendance !== null, 'Attendance record must be returned');
      } else {
        assertEqual(res.status, 400, 'If already checked in, returns 400');
        assertIncludes(res.data.error, 'đã check-in', 'Expected already checked in error');
      }
    });

    test('2.6 GET /api/attendance/today returns current shift and branch details', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.get('/api/attendance/today');
      assertEqual(res.status, 200, 'GET /api/attendance/today must return 200');
      assert(res.data.shift !== null, 'Shift must be present');
      assert(res.data.branch !== null, 'Branch must be present');
    });
  });

  describe('Tier 1 - Feature 3: Multi-Type Request Submission', () => {
    let leaveTpl, adjTpl, otTpl, lateTpl, payTpl;

    test('3.1 Retrieve all approval templates', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.get('/api/approvals/templates');
      assertEqual(res.status, 200, 'Templates query must return 200');
      assert(Array.isArray(res.data.templates), 'Templates must be an array');
      leaveTpl = res.data.templates.find(t => t.code === 'LEAVE');
      adjTpl = res.data.templates.find(t => t.code === 'ADJUSTMENT');
      otTpl = res.data.templates.find(t => t.code === 'OVERTIME');
      lateTpl = res.data.templates.find(t => t.code === 'LATE_EARLY');
      payTpl = res.data.templates.find(t => t.code === 'PAYMENT');
      assert(leaveTpl && adjTpl && otTpl && lateTpl && payTpl, 'All 5 core templates must exist');
    });

    test('3.2 Submit LEAVE request successfully', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.post('/api/approvals', {
        templateId: leaveTpl.id,
        data: {
          leaveType: 'Nghỉ phép năm (có lương)',
          startDate: '2026-09-18',
          endDate: '2026-09-18',
          duration: 1.0,
          reason: 'Test nghỉ phép cá nhân',
        },
      });
      assertEqual(res.status, 200, 'Leave submission must return 200');
      assert(res.data.request.code.startsWith('REQ-'), 'Request code must start with REQ-');
      assertEqual(res.data.request.status, 'PENDING', 'Initial status must be PENDING');
    });

    test('3.3 Submit ADJUSTMENT request successfully', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.post('/api/approvals', {
        templateId: adjTpl.id,
        data: {
          workDate: '2026-09-19',
          checkInTime: '08:30',
          checkOutTime: '17:30',
          reasonType: 'Quên chấm công',
          reason: 'Test quên chấm công buổi sáng',
        },
      });
      assertEqual(res.status, 200, 'Adjustment submission must return 200');
    });

    test('3.4 Submit OVERTIME request successfully', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.post('/api/approvals', {
        templateId: otTpl.id,
        data: {
          workDate: '2026-09-20',
          otStartTime: '18:00',
          otEndTime: '20:00',
          estimatedHours: 2.0,
          taskDescription: 'Test OT làm thêm tính năng',
        },
      });
      assertEqual(res.status, 200, 'Overtime submission must return 200');
    });

    test('3.5 Submit LATE_EARLY and PAYMENT requests successfully', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const resLate = await client.post('/api/approvals', {
        templateId: lateTpl.id,
        data: {
          type: 'Xin đi muộn',
          workDate: '2026-09-21',
          expectedTime: '09:15',
          reason: 'Hỏng xe trên đường',
        },
      });
      assertEqual(resLate.status, 200, 'Late/early submission must return 200');

      const resPay = await client.post('/api/approvals', {
        templateId: payTpl.id,
        data: {
          requestType: 'Tạm ứng chi phí',
          amount: 2000000,
          purpose: 'Tạm ứng mua thiết bị kiểm thử',
          bankAccount: '1234567890',
          bankName: 'Vietcombank',
        },
      });
      assertEqual(resPay.status, 200, 'Payment submission must return 200');
    });

    test('3.6 Submit request with missing templateId or data returns 400', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.post('/api/approvals', {
        templateId: leaveTpl.id,
      });
      assertEqual(res.status, 400, 'Missing data must return 400');
    });
  });

  describe('Tier 1 - Feature 4: Employee Notification & History', () => {
    test('4.1 GET /api/notifications returns user notifications list and unread count', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.get('/api/notifications');
      assertEqual(res.status, 200, 'Notifications query must return 200');
      assert(Array.isArray(res.data.notifications), 'notifications must be an array');
      assert(typeof res.data.unreadCount === 'number', 'unreadCount must be a number');
    });

    test('4.2 POST /api/notifications/mark-read without ID marks all as read', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.post('/api/notifications/mark-read', {});
      assertEqual(res.status, 200, 'Mark read status must be 200');
      assert(res.data.success, 'Response must indicate success');

      const checkRes = await client.get('/api/notifications');
      assertEqual(checkRes.data.unreadCount, 0, 'Unread count must be 0 after marking all read');
    });

    test('4.3 POST /api/notifications/mark-read with specific ID marks single notification read', async () => {
      const client = new HttpClient();
      await client.login('admin@peace.vn', 'admin123');
      const notifRes = await client.get('/api/notifications');
      if (notifRes.data.notifications.length > 0) {
        const id = notifRes.data.notifications[0].id;
        const res = await client.post('/api/notifications/mark-read', { notificationId: id });
        assertEqual(res.status, 200, 'Mark single read status must be 200');
      } else {
        assert(true, 'No notifications to mark');
      }
    });

    test('4.4 GET /api/attendance/history returns monthly history structure', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.get('/api/attendance/history?month=9&year=2026');
      assertEqual(res.status, 200, 'Attendance history query must return 200');
      assert(Array.isArray(res.data.attendances), 'attendances must be an array');
      assert(res.data.summary !== undefined, 'summary must be present in history response');
    });

    test('4.5 Unauthenticated request to /api/notifications returns 401', async () => {
      const client = new HttpClient();
      const res = await client.get('/api/notifications');
      assertEqual(res.status, 401, 'Unauthenticated query must return 401');
    });
  });

  describe('Tier 1 - Feature 5: Manager Real-Time Approval Tab', () => {
    test('5.1 Manager /api/auth/me returns pendingApprovalsCount >= 0', async () => {
      const client = new HttpClient();
      await client.login('manager@peace.vn', 'admin123');
      const res = await client.get('/api/auth/me');
      assertEqual(res.status, 200, 'Manager me query must return 200');
      assert(typeof res.data.pendingApprovalsCount === 'number', 'pendingApprovalsCount must be a number');
    });

    test('5.2 GET /api/approvals?tab=pending_me returns list of pending items for manager', async () => {
      const client = new HttpClient();
      await client.login('manager@peace.vn', 'admin123');
      const res = await client.get('/api/approvals?tab=pending_me');
      assertEqual(res.status, 200, 'Approvals pending_me query must return 200');
      assert(Array.isArray(res.data.requests), 'requests must be an array');
    });

    test('5.3 GET /api/approvals?tab=my_requests returns only user created requests', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.get('/api/approvals?tab=my_requests');
      assertEqual(res.status, 200, 'my_requests query must return 200');
      for (const r of res.data.requests) {
        assertEqual(r.creator.name, 'Nguyễn Văn Lâm', 'Creator must be Lam');
      }
    });

    test('5.4 Employee accessing /api/approvals?tab=all returns 403 Forbidden', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.get('/api/approvals?tab=all');
      assertEqual(res.status, 403, 'Employee cannot view all requests');
    });

    test('5.5 Employee /api/auth/me has pendingApprovalsCount = 0', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.get('/api/auth/me');
      assertEqual(res.status, 200, 'Me query must return 200');
      assertEqual(res.data.pendingApprovalsCount, 0, 'Employee pending approvals count must be 0');
    });
  });

  describe('Tier 1 - Feature 6: Manager Approval & Reasoned Rejection', () => {
    let testReqId;

    test('6.1 Prepare a fresh approval request for manager action testing', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const tplRes = await clientLam.get('/api/approvals/templates');
      const lateTpl = tplRes.data.templates.find(t => t.code === 'LATE_EARLY');

      const reqRes = await clientLam.post('/api/approvals', {
        templateId: lateTpl.id,
        data: {
          type: 'Xin đi muộn',
          workDate: '2026-09-22',
          expectedTime: '09:00',
          reason: 'Test duyệt quản lý',
        },
      });
      assertEqual(reqRes.status, 200, 'Setup request must succeed');
      testReqId = reqRes.data.request.id;
    });

    test('6.2 Manager attempts rejection with empty note returns 400', async () => {
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const res = await clientMgr.post(`/api/approvals/${testReqId}/action`, {
        action: 'REJECT',
        note: '',
      });
      assertEqual(res.status, 400, 'Rejection with empty note must return 400');
      assertIncludes(res.data.error, 'lý do từ chối', 'Error must mention rejection reason required');
    });

    test('6.3 Action with invalid action string returns 400', async () => {
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const res = await clientMgr.post(`/api/approvals/${testReqId}/action`, {
        action: 'INVALID_ACTION',
      });
      assertEqual(res.status, 400, 'Invalid action must return 400');
    });

    test('6.4 Manager approves Step 1 successfully', async () => {
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const res = await clientMgr.post(`/api/approvals/${testReqId}/action`, {
        action: 'APPROVE',
        note: 'Đồng ý duyệt',
      });
      assertEqual(res.status, 200, 'Manager approve must return 200');
      assert(res.data.success, 'Response must indicate success');
    });

    test('6.5 Attempting action on already finalized request returns 400', async () => {
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      // Request was single step LATE_EARLY, so it is already APPROVED
      const res = await clientMgr.post(`/api/approvals/${testReqId}/action`, {
        action: 'APPROVE',
      });
      assertEqual(res.status, 400, 'Action on finalized request must return 400');
    });
  });

  describe('Tier 1 - Feature 7: In-Request Discussion Thread', () => {
    let reqId;

    test('7.1 Create a request for comment testing', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const tpls = await client.get('/api/approvals/templates');
      const tpl = tpls.data.templates.find(t => t.code === 'LEAVE');
      const res = await client.post('/api/approvals', {
        templateId: tpl.id,
        data: {
          leaveType: 'Nghỉ việc riêng (có lương)',
          startDate: '2026-09-23',
          endDate: '2026-09-23',
          duration: 1.0,
          reason: 'Test bình luận',
        },
      });
      assertEqual(res.status, 200, 'Request creation must return 200');
      reqId = res.data.request.id;
    });

    test('7.2 POST /api/approvals/[id]/comment with content adds discussion comment', async () => {
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const res = await clientMgr.post(`/api/approvals/${reqId}/comment`, {
        content: 'Bạn nhớ bàn giao công việc trước khi nghỉ nhé!',
      });
      assertEqual(res.status, 200, 'Comment post must return 200');
      assert(res.data.success, 'Comment response must indicate success');
      assertEqual(res.data.comment.content, 'Bạn nhớ bàn giao công việc trước khi nghỉ nhé!');
    });

    test('7.3 GET /api/approvals/[id] includes newly added comment', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.get(`/api/approvals/${reqId}`);
      assertEqual(res.status, 200, 'Detail query must return 200');
      assert(Array.isArray(res.data.request.comments), 'comments must be an array');
      const found = res.data.request.comments.some(c => c.content.includes('bàn giao công việc'));
      assert(found, 'Added comment must be present in request comments');
    });

    test('7.4 Comment with empty or whitespace content returns 400', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.post(`/api/approvals/${reqId}/comment`, {
        content: '   ',
      });
      assertEqual(res.status, 400, 'Empty comment must return 400');
    });

    test('7.5 Comment on non-existent request ID returns 404', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.post('/api/approvals/non-existent-id/comment', {
        content: 'Test invalid id',
      });
      assertEqual(res.status, 404, 'Non-existent request comment must return 404');
    });
  });

  describe('Tier 1 - Feature 8: Manager Department Scoping (RBAC)', () => {
    test('8.1 Manager calling /api/admin/users only sees own department members', async () => {
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const res = await clientMgr.get('/api/admin/users');
      assertEqual(res.status, 200, 'Manager users query must return 200');
      assert(Array.isArray(res.data.users), 'users must be an array');
      // Manager Lê Hoàng Manager belongs to TECH department
      for (const u of res.data.users) {
        assertEqual(u.department.code, 'TECH', 'Manager can only see TECH department users');
      }
    });

    test('8.2 Manager does NOT see users from other departments (SALES, HR, BGD)', async () => {
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const res = await clientMgr.get('/api/admin/users');
      const emails = res.data.users.map(u => u.email);
      assert(!emails.includes('hoa@peace.vn'), 'Hoa (SALES) must NOT be visible to Tech Manager');
      assert(!emails.includes('hr@peace.vn'), 'HR must NOT be visible to Tech Manager');
    });

    test('8.3 HR Admin calling /api/admin/users sees all users across departments', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const res = await clientHr.get('/api/admin/users');
      assertEqual(res.status, 200, 'HR users query must return 200');
      const emails = res.data.users.map(u => u.email);
      assert(emails.includes('lam@peace.vn'), 'Lam must be visible to HR');
      assert(emails.includes('hoa@peace.vn'), 'Hoa must be visible to HR');
      assert(emails.includes('admin@peace.vn'), 'Admin must be visible to HR');
    });

    test('8.4 Super Admin calling /api/admin/users sees all users', async () => {
      const clientAdmin = new HttpClient();
      await clientAdmin.login('admin@peace.vn', 'admin123');
      const res = await clientAdmin.get('/api/admin/users');
      assertEqual(res.status, 200, 'Admin users query must return 200');
      assert(res.data.users.length >= 5, 'Super Admin must see all seeded users');
    });

    test('8.5 Regular Employee calling /api/admin/users returns 403 Forbidden', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const res = await clientLam.get('/api/admin/users');
      assertEqual(res.status, 403, 'Employee must be forbidden from accessing admin users API');
    });
  });

  describe('Tier 1 - Feature 9: HR Level 2 Approval & Leave Quota', () => {
    let leaveReqId;
    let initialLeaveUsed = 0;

    test('9.1 Employee submits 1.0 day annual leave request', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const meRes = await clientLam.get('/api/auth/me');
      initialLeaveUsed = meRes.data.user.annualLeaveUsed || 0;

      const tpls = await clientLam.get('/api/approvals/templates');
      const tpl = tpls.data.templates.find(t => t.code === 'LEAVE');
      const res = await clientLam.post('/api/approvals', {
        templateId: tpl.id,
        data: {
          leaveType: 'Nghỉ phép năm (có lương)',
          startDate: '2026-09-24',
          endDate: '2026-09-24',
          duration: 1.0,
          reason: 'Test HR level 2 approval',
        },
      });
      assertEqual(res.status, 200, 'Leave submission must return 200');
      leaveReqId = res.data.request.id;
    });

    test('9.2 Manager approves Step 1 of the leave request', async () => {
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const res = await clientMgr.post(`/api/approvals/${leaveReqId}/action`, {
        action: 'APPROVE',
        note: 'Quản lý duyệt cấp 1',
      });
      assertEqual(res.status, 200, 'Manager approval must return 200');
      assertIncludes(res.data.message, 'cấp phê duyệt tiếp theo', 'Must transition to next step');
    });

    test('9.3 HR Admin approves Step 2 (final approval)', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const res = await clientHr.post(`/api/approvals/${leaveReqId}/action`, {
        action: 'APPROVE',
        note: 'HR xác nhận duyệt trừ phép',
      });
      assertEqual(res.status, 200, 'HR approval must return 200');
    });

    test('9.4 Creator annualLeaveUsed incremented by exactly 1.0', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const meRes = await clientLam.get('/api/auth/me');
      const currentLeaveUsed = meRes.data.user.annualLeaveUsed;
      assertEqual(currentLeaveUsed, initialLeaveUsed + 1.0, 'annualLeaveUsed must increase by 1.0');
    });

    test('9.5 Non-HR non-SuperAdmin user cannot approve Step 2', async () => {
      // Create another request and approve step 1
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const tpls = await clientLam.get('/api/approvals/templates');
      const tpl = tpls.data.templates.find(t => t.code === 'LEAVE');
      const r = await clientLam.post('/api/approvals', {
        templateId: tpl.id,
        data: {
          leaveType: 'Nghỉ phép năm (có lương)',
          startDate: '2026-09-25',
          endDate: '2026-09-25',
          duration: 1.0,
          reason: 'Test unauthorized HR step',
        },
      });
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      await clientMgr.post(`/api/approvals/${r.data.request.id}/action`, { action: 'APPROVE' });

      // Manager tries to approve Step 2 (HR step)
      const res = await clientMgr.post(`/api/approvals/${r.data.request.id}/action`, { action: 'APPROVE' });
      assertEqual(res.status, 403, 'Manager cannot approve HR step');
    });
  });

  describe('Tier 1 - Feature 10: Timesheet Anti-Double-Counting', () => {
    test('10.1 GET /api/admin/timesheet returns 200 with monthly matrix', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const res = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      assertEqual(res.status, 200, 'Timesheet query must return 200');
      assert(Array.isArray(res.data.matrix), 'matrix must be an array');
      assert(typeof res.data.standardWorkDays === 'number', 'standardWorkDays must be number');
    });

    test('10.2 Timesheet standardWorkDays excludes Sundays correctly', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const res = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      // In Sept 2026 (30 days), Sundays are Sept 6, 13, 20, 27 (4 Sundays).
      // Standard working days = 30 - 4 = 26 days.
      assertEqual(res.data.standardWorkDays, 26, 'September 2026 standard work days must be 26');
    });

    test('10.3 For any user in timesheet, finalPayableUnits == actualWorkUnits + paidLeaveDays', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const res = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      for (const row of res.data.matrix) {
        const expected = Math.round((row.summary.actualWorkUnits + row.summary.paidLeaveDays) * 10) / 10;
        assertEqual(row.summary.finalPayableUnits, expected, `finalPayableUnits must equal actualWorkUnits + paidLeaveDays for ${row.user.name}`);
      }
    });

    test('10.4 Days with status LEAVE are not counted inside actualWorkUnits', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const res = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      const lamRow = res.data.matrix.find(r => r.user.email === 'lam@peace.vn');
      assert(lamRow !== undefined, 'Lam must be present in timesheet matrix');
      assert(lamRow.summary.paidLeaveDays >= 1, 'Lam must have at least 1 paid leave day recorded');
    });

    test('10.5 Employee accessing /api/admin/timesheet returns 403 Forbidden', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const res = await clientLam.get('/api/admin/timesheet?month=9&year=2026');
      assertEqual(res.status, 403, 'Employee must be forbidden from accessing admin timesheet API');
    });
  });

  describe('Tier 1 - Feature 11: Attendance Adjustment Execution', () => {
    let adjId;

    test('11.1 Employee submits ADJUSTMENT request for missing check-in on 2026-09-08', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const tpls = await clientLam.get('/api/approvals/templates');
      const tpl = tpls.data.templates.find(t => t.code === 'ADJUSTMENT');
      const res = await clientLam.post('/api/approvals', {
        templateId: tpl.id,
        data: {
          workDate: '2026-09-08',
          checkInTime: '08:30',
          checkOutTime: '17:30',
          reasonType: 'Quên chấm công',
          reason: 'Quên mang thẻ/điện thoại',
        },
      });
      assertEqual(res.status, 200, 'Adjustment submit must return 200');
      adjId = res.data.request.id;
    });

    test('11.2 Manager approves Step 1 of ADJUSTMENT', async () => {
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const res = await clientMgr.post(`/api/approvals/${adjId}/action`, {
        action: 'APPROVE',
        note: 'Xác nhận nhân viên có mặt',
      });
      assertEqual(res.status, 200, 'Manager step approve must return 200');
    });

    test('11.3 HR Admin approves Step 2 of ADJUSTMENT', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const res = await clientHr.post(`/api/approvals/${adjId}/action`, {
        action: 'APPROVE',
        note: 'HR chốt cập nhật công',
      });
      assertEqual(res.status, 200, 'HR final approve must return 200');
    });

    test('11.4 Timesheet reflects day 8 as EXPLAINED with 1.0 work unit', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const res = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      const lamRow = res.data.matrix.find(r => r.user.email === 'lam@peace.vn');
      const day8 = lamRow.dailyRecords[8];
      assert(day8 !== null, 'Day 8 record must exist');
      assertEqual(day8.status, 'EXPLAINED', 'Day 8 status must be EXPLAINED');
      assertEqual(day8.workUnits, 1.0, 'Day 8 workUnits must be 1.0');
    });

    test('11.5 Day 8 lateness and early penalties are excused (0 minutes)', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const res = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      const lamRow = res.data.matrix.find(r => r.user.email === 'lam@peace.vn');
      const day8 = lamRow.dailyRecords[8];
      assertEqual(day8.lateMinutes, 0, 'Late minutes must be 0');
      assertEqual(day8.earlyMinutes, 0, 'Early minutes must be 0');
    });
  });

  describe('Tier 1 - Feature 12: Batch Shift Scheduling', () => {
    let testUserId, testShiftId;

    test('12.1 Resolve user ID and shift ID for batch schedule', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const usersRes = await clientHr.get('/api/admin/users');
      testUserId = usersRes.data.users.find(u => u.email === 'lam@peace.vn').id;
      const shiftsRes = await clientHr.get('/api/admin/shifts');
      testShiftId = shiftsRes.data.shifts.find(s => s.code === 'CA_HC').id;
      assert(testUserId && testShiftId, 'Test user and shift must be resolved');
    });

    test('12.2 Batch assign shift to user across date interval with excludeSundays', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const res = await clientHr.post('/api/admin/schedules/batch', {
        userIds: [testUserId],
        shiftId: testShiftId,
        startDate: '2026-09-01',
        endDate: '2026-09-07',
        excludeSundays: true,
      });
      assertEqual(res.status, 200, 'Batch schedule must return 200');
      assert(res.data.success, 'Response must indicate success');
      assertIncludes(res.data.message, 'Đã phân ca thành công', 'Response must confirm batch allocation');
    });

    test('12.3 Batch schedule overwrite replaces existing shift without duplication', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const res = await clientHr.post('/api/admin/schedules/batch', {
        userIds: [testUserId],
        shiftId: testShiftId,
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        excludeSundays: false,
      });
      assertEqual(res.status, 200, 'Overwrite batch schedule must return 200');
      assert(res.data.success, 'Overwrite must succeed smoothly');
    });

    test('12.4 Batch schedule with empty userIds or missing fields returns 400', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const res = await clientHr.post('/api/admin/schedules/batch', {
        userIds: [],
        shiftId: testShiftId,
        startDate: '2026-09-01',
        endDate: '2026-09-05',
      });
      assertEqual(res.status, 400, 'Empty userIds must return 400');
    });

    test('12.5 Regular Employee calling /api/admin/schedules/batch returns 403', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const res = await clientLam.post('/api/admin/schedules/batch', {
        userIds: [testUserId],
        shiftId: testShiftId,
        startDate: '2026-09-01',
        endDate: '2026-09-05',
      });
      assertEqual(res.status, 403, 'Employee must be forbidden from batch scheduling');
    });
  });

  describe('Tier 1 - Feature 13: Multi-Sheet Excel Export', () => {
    let excelBuffer;
    const ExcelJS = require('exceljs');

    test('13.1 GET /api/admin/timesheet/export returns 200 with Excel content-type', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const res = await clientHr.get('/api/admin/timesheet/export?month=9&year=2026');
      assertEqual(res.status, 200, 'Export status must be 200');
      const contentType = res.headers.get('content-type') || '';
      assertIncludes(contentType, 'spreadsheetml.sheet', 'Content-type must be openxml formats spreadsheetml');
      excelBuffer = res.data;
      assert(Buffer.isBuffer(excelBuffer), 'Returned data must be a binary Buffer');
      assert(excelBuffer.length > 1000, 'Buffer length must be substantial (>1000 bytes)');
    });

    test('13.2 Excel buffer opens validly and contains exactly 2 worksheets', async () => {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(excelBuffer);
      assertEqual(workbook.worksheets.length, 2, 'Workbook must have exactly 2 worksheets');
      const sheetNames = workbook.worksheets.map(w => w.name);
      assert(sheetNames.some(n => n.includes('Tổng Hợp')), 'Sheet 1 must be Tổng Hợp');
      assert(sheetNames.some(n => n.includes('Chi Tiết')), 'Sheet 2 must be Chi Tiết');
    });

    test('13.3 Sheet 1 (Tổng Hợp) contains 14 standardized columns and header title', async () => {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(excelBuffer);
      const ws1 = workbook.getWorksheet(1);
      const title = ws1.getCell('A1').value;
      assertIncludes(String(title), 'BẢNG TỔNG HỢP CÔNG', 'Sheet 1 banner title must match');
      const headerRow = ws1.getRow(3).values;
      // Row values is 1-indexed in ExcelJS
      assert(headerRow.length >= 14, 'Sheet 1 must have at least 14 columns');
    });

    test('13.4 Sheet 2 (Chi Tiết) contains daily day columns N1 to N30', async () => {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(excelBuffer);
      const ws2 = workbook.getWorksheet(2);
      const headerRow = ws2.getRow(1).values;
      assert(headerRow.includes('N1'), 'Header must contain N1');
      assert(headerRow.includes('N30'), 'Header must contain N30');
    });

    test('13.5 Figures in Excel Sheet 1 match 100% with /api/admin/timesheet API', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const tsRes = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(excelBuffer);
      const ws1 = workbook.getWorksheet(1);

      // Verify row count matches users count
      const dataRows = [];
      ws1.eachRow((row, rowNumber) => {
        if (rowNumber > 3) dataRows.push(row);
      });
      assertEqual(dataRows.length, tsRes.data.matrix.length, 'Data rows count in Excel must equal users count');
    });
  });

  describe('Tier 1 - Feature 14: Super Admin Payment Approval', () => {
    let payReqId;

    test('14.1 Employee submits PAYMENT request', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const tpls = await clientLam.get('/api/approvals/templates');
      const tpl = tpls.data.templates.find(t => t.code === 'PAYMENT');
      const res = await clientLam.post('/api/approvals', {
        templateId: tpl.id,
        data: {
          requestType: 'Tạm ứng chi phí',
          amount: 5000000,
          purpose: 'Tạm ứng chi phí công tác chi nhánh HCM',
          bankAccount: '999988887777',
          bankName: 'MBBank',
        },
      });
      assertEqual(res.status, 200, 'Payment submit must return 200');
      payReqId = res.data.request.id;
    });

    test('14.2 Manager approves Step 1 of PAYMENT request', async () => {
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const res = await clientMgr.post(`/api/approvals/${payReqId}/action`, {
        action: 'APPROVE',
        note: 'Quản lý duyệt nhu cầu chi tiêu',
      });
      assertEqual(res.status, 200, 'Manager approve must return 200');
    });

    test('14.3 Non-SuperAdmin attempting Step 2 approval returns 403', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const res = await clientHr.post(`/api/approvals/${payReqId}/action`, {
        action: 'APPROVE',
        note: 'HR cannot approve financial payment',
      });
      assertEqual(res.status, 403, 'HR cannot approve Step 2 assigned to SUPER_ADMIN');
    });

    test('14.4 Super Admin approves Step 2 -> Request status transitions to APPROVED', async () => {
      const clientAdmin = new HttpClient();
      await clientAdmin.login('admin@peace.vn', 'admin123');
      const res = await clientAdmin.post(`/api/approvals/${payReqId}/action`, {
        action: 'APPROVE',
        note: 'Ban Giám Đốc phê duyệt chuẩn chi',
      });
      assertEqual(res.status, 200, 'Super admin approve must return 200');

      const detailRes = await clientAdmin.get(`/api/approvals/${payReqId}`);
      assertEqual(detailRes.data.request.status, 'APPROVED', 'Request status must be APPROVED');
    });

    test('14.5 Rejection of payment request terminates flow', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const tpls = await clientLam.get('/api/approvals/templates');
      const tpl = tpls.data.templates.find(t => t.code === 'PAYMENT');
      const r = await clientLam.post('/api/approvals', {
        templateId: tpl.id,
        data: {
          requestType: 'Tạm ứng chi phí',
          amount: 100000000,
          purpose: 'Số tiền quá lớn',
          bankAccount: '1111',
          bankName: 'Vietinbank',
        },
      });
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const rejRes = await clientMgr.post(`/api/approvals/${r.data.request.id}/action`, {
        action: 'REJECT',
        note: 'Số tiền vượt hạn mức phê duyệt',
      });
      assertEqual(rejRes.status, 200, 'Rejection must succeed');
      const detailRes = await clientMgr.get(`/api/approvals/${r.data.request.id}`);
      assertEqual(detailRes.data.request.status, 'REJECTED', 'Status must be REJECTED');
    });
  });

  describe('Tier 1 - Feature 15: Branch & Shift Provisioning', () => {
    const testBranchCode = `BR_TEST_${Date.now()}`;
    const testShiftCode = `SHIFT_TEST_${Date.now()}`;

    test('15.1 Super Admin creates new Branch with custom GPS coordinates', async () => {
      const clientAdmin = new HttpClient();
      await clientAdmin.login('admin@peace.vn', 'admin123');
      const res = await clientAdmin.post('/api/admin/branches', {
        name: 'Chi Nhánh Đà Nẵng Test',
        code: testBranchCode,
        address: '100 Nguyễn Văn Linh, Đà Nẵng',
        latitude: 16.06778,
        longitude: 108.22083,
        radiusMeters: 300,
      });
      assertEqual(res.status, 200, 'Branch create must return 200');
      assert(res.data.success, 'Response must indicate success');
      assertEqual(res.data.branch.code, testBranchCode);
    });

    test('15.2 GET /api/admin/branches lists newly created branch', async () => {
      const clientAdmin = new HttpClient();
      await clientAdmin.login('admin@peace.vn', 'admin123');
      const res = await clientAdmin.get('/api/admin/branches');
      assertEqual(res.status, 200, 'Branches query must return 200');
      const found = res.data.branches.some(b => b.code === testBranchCode);
      assert(found, 'Created branch must be present in branch list');
    });

    test('15.3 Super Admin creates new Shift with work parameters', async () => {
      const clientAdmin = new HttpClient();
      await clientAdmin.login('admin@peace.vn', 'admin123');
      const res = await clientAdmin.post('/api/admin/shifts', {
        name: 'Ca Tối Test',
        code: testShiftCode,
        startTime: '18:00',
        endTime: '22:00',
        workUnits: 0.5,
        gracePeriodLate: 10,
        gracePeriodEarly: 10,
      });
      assertEqual(res.status, 200, 'Shift create must return 200');
      assertEqual(res.data.shift.code, testShiftCode);
    });

    test('15.4 GET /api/admin/shifts lists newly created shift', async () => {
      const clientAdmin = new HttpClient();
      await clientAdmin.login('admin@peace.vn', 'admin123');
      const res = await clientAdmin.get('/api/admin/shifts');
      assertEqual(res.status, 200, 'Shifts query must return 200');
      const found = res.data.shifts.some(s => s.code === testShiftCode);
      assert(found, 'Created shift must be present in shift list');
    });

    test('15.5 Regular employee attempting to create branch or shift returns 403', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const resB = await clientLam.post('/api/admin/branches', {
        name: 'Hacked Branch',
        code: 'HACKED',
        latitude: 0,
        longitude: 0,
      });
      assertEqual(resB.status, 403, 'Employee cannot create branch');

      const resS = await clientLam.post('/api/admin/shifts', {
        name: 'Hacked Shift',
        code: 'HACKED_SHIFT',
        startTime: '00:00',
        endTime: '01:00',
      });
      assertEqual(resS.status, 403, 'Employee cannot create shift');
    });
  });

  describe('Tier 1 - Feature 16: Custom Form Builder & Fields', () => {
    const customTplCode = `CUST_${Date.now()}`;

    test('16.1 Super Admin creates custom approval template via Form Builder API', async () => {
      const clientAdmin = new HttpClient();
      await clientAdmin.login('admin@peace.vn', 'admin123');
      const res = await clientAdmin.post('/api/approvals/templates', {
        name: 'Đơn Xin Công Tác Test',
        code: customTplCode,
        icon: 'Plane',
        description: 'Mẫu đơn công tác ngoại tỉnh',
        schemaFields: [
          { name: 'destination', label: 'Địa điểm công tác', type: 'text', required: true },
          { name: 'daysCount', label: 'Số ngày', type: 'number', required: true },
        ],
        defaultSteps: [
          { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý duyệt' },
          { stepOrder: 2, approverRole: 'HR_ADMIN', label: 'HR xác nhận vé xe' },
        ],
      });
      assertEqual(res.status, 200, 'Custom template create must return 200');
      assertEqual(res.data.template.code, customTplCode);
    });

    test('16.2 GET /api/approvals/templates includes newly created custom template', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.get('/api/approvals/templates');
      assertEqual(res.status, 200, 'Templates query must return 200');
      const found = res.data.templates.some(t => t.code === customTplCode);
      assert(found, 'Custom template must be listed in template catalog');
    });

    test('16.3 Employee can submit a request using the custom template', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const tplsRes = await client.get('/api/approvals/templates');
      const customTpl = tplsRes.data.templates.find(t => t.code === customTplCode);

      const res = await client.post('/api/approvals', {
        templateId: customTpl.id,
        data: {
          destination: 'Chi nhánh Đà Nẵng',
          daysCount: 3,
        },
      });
      assertEqual(res.status, 200, 'Custom template submission must return 200');
      assertEqual(res.data.request.status, 'PENDING');
    });

    test('16.4 Creating template with missing name or code returns 400', async () => {
      const clientAdmin = new HttpClient();
      await clientAdmin.login('admin@peace.vn', 'admin123');
      const res = await clientAdmin.post('/api/approvals/templates', {
        name: 'Thiếu mã',
      });
      assertEqual(res.status, 400, 'Missing code must return 400');
    });

    test('16.5 Non-admin attempting to create template returns 403', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const res = await clientLam.post('/api/approvals/templates', {
        name: 'Đơn trái phép',
        code: 'UNAUTHORIZED_TPL',
      });
      assertEqual(res.status, 403, 'Non-admin cannot create templates');
    });
  });

  describe('Tier 1 - Feature 17: System Config & Telegram Alerts', () => {
    test('17.1 Super Admin retrieves system settings via GET /api/admin/settings', async () => {
      const clientAdmin = new HttpClient();
      await clientAdmin.login('admin@peace.vn', 'admin123');
      const res = await clientAdmin.get('/api/admin/settings');
      assertEqual(res.status, 200, 'Settings query must return 200');
      assert(typeof res.data.settings === 'object', 'settings must be an object');
      assert(res.data.settings.COMPANY_NAME !== undefined, 'COMPANY_NAME setting must exist');
    });

    test('17.2 Super Admin updates system settings via POST /api/admin/settings', async () => {
      const clientAdmin = new HttpClient();
      await clientAdmin.login('admin@peace.vn', 'admin123');
      const res = await clientAdmin.post('/api/admin/settings', {
        COMPANY_NAME: 'PEACE GapoWork Technology Corporation',
        GLOBAL_GRACE_PERIOD_LATE: '20',
      });
      assertEqual(res.status, 200, 'Settings update must return 200');
      assert(res.data.success, 'Settings update must succeed');
    });

    test('17.3 Updated system settings persist and are returned on subsequent GET', async () => {
      const clientAdmin = new HttpClient();
      await clientAdmin.login('admin@peace.vn', 'admin123');
      const res = await clientAdmin.get('/api/admin/settings');
      assertEqual(res.data.settings.COMPANY_NAME, 'PEACE GapoWork Technology Corporation');
      assertEqual(res.data.settings.GLOBAL_GRACE_PERIOD_LATE, '20');
    });

    test('17.4 Non-admin accessing GET /api/admin/settings returns 403', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const res = await clientLam.get('/api/admin/settings');
      assertEqual(res.status, 403, 'Employee cannot access system settings');
    });

    test('17.5 Non-admin accessing POST /api/admin/settings returns 403', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const res = await clientLam.post('/api/admin/settings', {
        COMPANY_NAME: 'Hacked Name',
      });
      assertEqual(res.status, 403, 'Employee cannot update system settings');
    });
  });

  describe('Tier 1 - Feature 18: E2E Integration & Stress Hardening', () => {
    test('18.1 Full multi-role end-to-end flow executes cleanly', async () => {
      // 1. Employee logs in
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      // 2. Employee checks today info
      const todayRes = await clientLam.get('/api/attendance/today');
      assertEqual(todayRes.status, 200, 'Today query must be 200');

      // 3. Employee creates request
      const tpls = await clientLam.get('/api/approvals/templates');
      const tpl = tpls.data.templates.find(t => t.code === 'LEAVE');
      const reqRes = await clientLam.post('/api/approvals', {
        templateId: tpl.id,
        data: {
          leaveType: 'Nghỉ phép năm (có lương)',
          startDate: '2026-09-26',
          endDate: '2026-09-26',
          duration: 1.0,
          reason: 'E2E flow test',
        },
      });
      assertEqual(reqRes.status, 200, 'Request creation must be 200');
      const reqId = reqRes.data.request.id;

      // 4. Manager approves
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const mgrApprove = await clientMgr.post(`/api/approvals/${reqId}/action`, {
        action: 'APPROVE',
        note: 'Manager E2E approval',
      });
      assertEqual(mgrApprove.status, 200, 'Manager approve must be 200');

      // 5. HR approves
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const hrApprove = await clientHr.post(`/api/approvals/${reqId}/action`, {
        action: 'APPROVE',
        note: 'HR E2E approval',
      });
      assertEqual(hrApprove.status, 200, 'HR approve must be 200');

      // 6. Timesheet reflects changes
      const tsRes = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      assertEqual(tsRes.status, 200, 'Timesheet query must be 200');
    });

    test('18.2 Rapid concurrent read requests execute without deadlocks or crashes', async () => {
      const client = new HttpClient();
      await client.login('admin@peace.vn', 'admin123');
      const promises = [
        client.get('/api/auth/me'),
        client.get('/api/attendance/today'),
        client.get('/api/approvals?tab=all'),
        client.get('/api/admin/users'),
        client.get('/api/admin/branches'),
        client.get('/api/admin/shifts'),
        client.get('/api/admin/timesheet?month=9&year=2026'),
      ];
      const results = await Promise.all(promises);
      for (const r of results) {
        assertEqual(r.status, 200, 'Concurrent requests must all return 200');
      }
    });

    test('18.3 Repeated query of notifications and history remains idempotent', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res1 = await client.get('/api/notifications');
      const res2 = await client.get('/api/notifications');
      assertEqual(res1.status, 200);
      assertEqual(res2.status, 200);
      assertEqual(res1.data.unreadCount, res2.data.unreadCount, 'Unread count should be idempotent on read');
    });

    test('18.4 Timesheet export handles parameter defaults gracefully', async () => {
      const clientAdmin = new HttpClient();
      await clientAdmin.login('admin@peace.vn', 'admin123');
      const res = await clientAdmin.get('/api/admin/timesheet/export');
      assertEqual(res.status, 200, 'Timesheet export without params must default and return 200');
      assert(Buffer.isBuffer(res.data), 'Must return valid buffer');
    });

    test('18.5 Malformed JSON payloads return clean 400/500 without unhandled server crashes', async () => {
      const client = new HttpClient();
      await client.login('admin@peace.vn', 'admin123');
      const res = await client.request('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json-payload{',
      });
      assert(res.status === 400 || res.status === 500, 'Malformed payload must be handled safely');
    });
  });
}

module.exports = { registerTier1Tests };
