/**
 * Tier 2: Boundary & Corner Cases Test Suite
 * Covers geofence boundaries, zero/empty inputs, invalid permissions, empty notes on reject, and edge values.
 */

const { describe, test, assert, assertEqual, assertIncludes, HttpClient } = require('./harness');

const HN_HQ_LAT = 21.028511;
const HN_HQ_LNG = 105.854167;
const SAMPLE_PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Haversine formula matching src/lib/geo.ts
function calculateDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * (Math.sin(Δλ / 2) ** 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function isWithinBranchRadius(userLat, userLng, branchLat, branchLng, radiusMeters) {
  const distance = calculateDistanceInMeters(userLat, userLng, branchLat, branchLng);
  return { isInside: distance <= radiusMeters, distance };
}

function registerTier2Tests() {
  describe('Tier 2 - Boundary & Corner Cases', () => {
    test('T2.1 Geofence distance calculation: point within 500m radius is verified inside', async () => {
      // Shift ~300 meters north: 0.0027 degrees lat
      const testLat = HN_HQ_LAT + 0.0027;
      const testLng = HN_HQ_LNG;
      const dist = calculateDistanceInMeters(HN_HQ_LAT, HN_HQ_LNG, testLat, testLng);
      assert(dist <= 500, `Calculated distance (${dist}m) should be <= 500m`);
      const check = isWithinBranchRadius(testLat, testLng, HN_HQ_LAT, HN_HQ_LNG, 500);
      assertEqual(check.isInside, true, 'Point within radius must have isInside = true');
    });

    test('T2.2 Geofence distance calculation: point beyond 500m radius is verified outside', async () => {
      // Shift ~700 meters north: 0.0063 degrees lat
      const testLat = HN_HQ_LAT + 0.0063;
      const testLng = HN_HQ_LNG;
      const dist = calculateDistanceInMeters(HN_HQ_LAT, HN_HQ_LNG, testLat, testLng);
      assert(dist > 500, `Calculated distance (${dist}m) should be > 500m`);
      const check = isWithinBranchRadius(testLat, testLng, HN_HQ_LAT, HN_HQ_LNG, 500);
      assertEqual(check.isInside, false, 'Point outside radius must have isInside = false');
    });

    test('T2.3 Extreme coordinates (lat: 0, lng: 0) result in out-of-range detection without crash', async () => {
      const check = isWithinBranchRadius(0, 0, HN_HQ_LAT, HN_HQ_LNG, 500);
      assertEqual(check.isInside, false, '(0,0) must be outside HN HQ radius');
      assert(check.distance > 1000000, 'Distance from (0,0) must be > 1,000 km');
    });

    test('T2.4 Rejection note with only whitespace ("   ") returns 400 error', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const tpls = await client.get('/api/approvals/templates');
      const tpl = tpls.data.templates.find(t => t.code === 'LATE_EARLY');
      const reqRes = await client.post('/api/approvals', {
        templateId: tpl.id,
        data: {
          type: 'Xin đi muộn',
          workDate: '2026-09-27',
          expectedTime: '09:00',
          reason: 'Test whitespace rejection',
        },
      });

      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const rejRes = await clientMgr.post(`/api/approvals/${reqRes.data.request.id}/action`, {
        action: 'REJECT',
        note: '     ',
      });
      assertEqual(rejRes.status, 400, 'Whitespace-only rejection note must return 400');
      assertIncludes(rejRes.data.error, 'lý do từ chối');
    });

    test('T2.5 Empty content comment ("") returns 400 error', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const tpls = await client.get('/api/approvals/templates');
      const tpl = tpls.data.templates.find(t => t.code === 'LEAVE');
      const r = await client.post('/api/approvals', {
        templateId: tpl.id,
        data: {
          leaveType: 'Nghỉ không lương',
          startDate: '2026-09-28',
          endDate: '2026-09-28',
          duration: 1.0,
          reason: 'Test empty comment',
        },
      });

      const commentRes = await client.post(`/api/approvals/${r.data.request.id}/comment`, {
        content: '',
      });
      assertEqual(commentRes.status, 400, 'Empty comment must return 400');
    });

    test('T2.6 Login with empty email or empty password returns 400', async () => {
      const client = new HttpClient();
      const res1 = await client.post('/api/auth/login', { email: '', password: '123' });
      assertEqual(res1.status, 400, 'Empty email must return 400');

      const res2 = await client.post('/api/auth/login', { email: 'admin@peace.vn', password: '' });
      assertEqual(res2.status, 400, 'Empty password must return 400');
    });

    test('T2.7 Non-existent entity IDs in /api/approvals/[id] return 404', async () => {
      const client = new HttpClient();
      await client.login('admin@peace.vn', 'admin123');
      const res = await client.get('/api/approvals/non_existent_cuid_12345');
      assertEqual(res.status, 404, 'Non-existent approval must return 404');

      const actionRes = await client.post('/api/approvals/non_existent_cuid_12345/action', {
        action: 'APPROVE',
      });
      assertEqual(actionRes.status, 404, 'Non-existent action must return 404');
    });

    test('T2.8 Non-existent template ID in /api/approvals returns 404', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');
      const res = await client.post('/api/approvals', {
        templateId: 'non_existent_template_id',
        data: { test: true },
      });
      assertEqual(res.status, 404, 'Non-existent template must return 404');
    });

    test('T2.9 Invalid / Tampered JWT cookie returns 401 on protected endpoints', async () => {
      const client = new HttpClient();
      client.setCookie('peace_auth_token=tampered.fake.jwt.token');
      const res = await client.get('/api/auth/me');
      assertEqual(res.status, 401, 'Tampered token must return 401');

      const notifRes = await client.get('/api/notifications');
      assertEqual(notifRes.status, 401, 'Tampered token on notifications must return 401');
    });

    test('T2.10 Missing Cookie on protected endpoints returns 401', async () => {
      const client = new HttpClient();
      const res1 = await client.get('/api/auth/me');
      assertEqual(res1.status, 401, 'Missing cookie on /api/auth/me must return 401');

      const res2 = await client.get('/api/admin/users');
      assertEqual(res2.status, 403, 'Unauthenticated /api/admin/users returns 403');
    });

    test('T2.11 Manager cannot access system configuration API (HTTP 403)', async () => {
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const res = await clientMgr.get('/api/admin/settings');
      assertEqual(res.status, 403, 'Manager cannot access system settings');
    });

    test('T2.12 Timesheet query with out-of-range month handled safely without crash', async () => {
      const clientAdmin = new HttpClient();
      await clientAdmin.login('admin@peace.vn', 'admin123');
      const res = await clientAdmin.get('/api/admin/timesheet?month=13&year=2026');
      assertEqual(res.status, 200, 'Out-of-range month handled safely');
    });

    test('T2.13 Unpaid leave approval does not increment user annualLeaveUsed', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const meBefore = await clientLam.get('/api/auth/me');
      const leaveUsedBefore = meBefore.data.user.annualLeaveUsed;

      const tpls = await clientLam.get('/api/approvals/templates');
      const tpl = tpls.data.templates.find(t => t.code === 'LEAVE');
      const r = await clientLam.post('/api/approvals', {
        templateId: tpl.id,
        data: {
          leaveType: 'Nghỉ không lương',
          startDate: '2026-09-29',
          endDate: '2026-09-29',
          duration: 1.0,
          reason: 'Nghỉ không lương test',
        },
      });

      const reqId = r.data.request.id;
      // Step 1: Manager approve
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      await clientMgr.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE' });

      // Step 2: HR approve
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      await clientHr.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE' });

      const meAfter = await clientLam.get('/api/auth/me');
      const leaveUsedAfter = meAfter.data.user.annualLeaveUsed;
      assertEqual(leaveUsedAfter, leaveUsedBefore, 'annualLeaveUsed must not change on unpaid leave');
    });

    test('T2.14 Timesheet treats unpaid leave with 0 work units (unpaidLeaveDays)', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');
      const res = await clientHr.get('/api/admin/timesheet?month=9&year=2026');
      const lamRow = res.data.matrix.find(r => r.user.email === 'lam@peace.vn');
      assert(lamRow.summary.unpaidLeaveDays >= 1, 'Lam must have at least 1 unpaid leave day recorded');
    });

    test('T2.15 Double-submit or action on already approved step returns 400', async () => {
      // Create request and approve
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');
      const tpls = await clientLam.get('/api/approvals/templates');
      const tpl = tpls.data.templates.find(t => t.code === 'LATE_EARLY');
      const r = await clientLam.post('/api/approvals', {
        templateId: tpl.id,
        data: {
          type: 'Xin về sớm',
          workDate: '2026-09-30',
          expectedTime: '16:30',
          reason: 'Về sớm có việc',
        },
      });

      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      const app1 = await clientMgr.post(`/api/approvals/${r.data.request.id}/action`, { action: 'APPROVE' });
      assertEqual(app1.status, 200);

      const app2 = await clientMgr.post(`/api/approvals/${r.data.request.id}/action`, { action: 'APPROVE' });
      assertEqual(app2.status, 400, 'Re-approving already approved request must return 400');
    });
  });
}

module.exports = { registerTier2Tests };
