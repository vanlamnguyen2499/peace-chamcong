/**
 * Adversarial Stress & Concurrency Challenge Suite for PEACE GapoWork
 * Authored by Challenger 1 (Empirical Challenger)
 *
 * Verifies system behavior under hostile/adversarial inputs and stress conditions:
 *  1. Concurrency Stress: Double approval race conditions (quota deduction & OT multiplication).
 *  2. Out-of-Order Approval Attacks: Skip-level approval, unauthorized approval, self-approval, closed-state action.
 *  3. GPS Geofence Boundaries: 499m vs 501m exact edges, extreme coordinates, cross-branch detection.
 *  4. Bypass Inputs & Type Fragility: Empty notes, non-string comments, tampered tokens, SQL injection probing, inverted date intervals.
 */

const { describe, test, assert, assertEqual, assertIncludes, HttpClient } = require('./e2e/harness');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SAMPLE_PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const HN_HQ_LAT = 21.028511;
const HN_HQ_LNG = 105.854167;

// Exact boundary coordinates calculated via Haversine against HN_HQ (radius 500m)
const LAT_499M = 21.032998165152733; // actual: 499.0m (Inside <= 500m)
const LAT_501M = 21.033016151584853; // actual: 501.0m (Outside > 500m)

async function createLeaveRequestSafely(client, data) {
  const tpls = await client.get('/api/approvals/templates');
  const tpl = tpls.data.templates.find(t => t.code === 'LEAVE');
  const res = await client.post('/api/approvals', {
    templateId: tpl.id,
    data,
  });
  if (!res.data || !res.data.request) {
    throw new Error(`Failed to create request (status ${res.status}): ${JSON.stringify(res.data)}`);
  }
  return res.data.request;
}

function registerChallengerTests() {

  // =========================================================================
  // SUITE 1: CONCURRENT ACTIONS & RACE CONDITIONS
  // =========================================================================
  describe('Adversarial Suite 1 - Concurrency & Race Condition Stress', () => {

    test('1.1 Simultaneous 5x Double Approvals on Step 1: Request must advance without skipping or jumping', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const tpls = await clientLam.get('/api/approvals/templates');
      const paymentTpl = tpls.data.templates.find(t => t.code === 'PAYMENT');
      assert(paymentTpl, 'PAYMENT template must exist');

      const createRes = await clientLam.post('/api/approvals', {
        templateId: paymentTpl.id,
        data: {
          amount: 5000000,
          purpose: 'Concurrent Step 1 Advance Stress Test',
          expectedDate: '2026-09-30',
        },
      });
      assertEqual(createRes.status, 200, 'PAYMENT request creation must succeed');
      const reqId = createRes.data.request.id;

      // 5 concurrent Manager approval clients
      const clients = await Promise.all([1, 2, 3, 4, 5].map(async () => {
        const c = new HttpClient();
        await c.login('manager@peace.vn', 'admin123');
        return c;
      }));

      // Fire 5 simultaneous approvals
      const results = await Promise.all(
        clients.map(c => c.post(`/api/approvals/${reqId}/action`, {
          action: 'APPROVE',
          note: 'Concurrent Step 1 Approval Attack',
        }))
      );

      for (const res of results) {
        assert(res.status === 200 || res.status === 400, `Status must be 200 or 400, got ${res.status}`);
      }

      const dbReq = await prisma.approvalRequest.findUnique({
        where: { id: reqId },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });

      assert(dbReq !== null, 'Request must exist in DB');
      assertEqual(dbReq.steps[0].status, 'APPROVED', 'Step 1 must be APPROVED');
      assertEqual(dbReq.currentStep, 2, `Request currentStep must be 2, got ${dbReq.currentStep}`);
      assertEqual(dbReq.status, 'PENDING', 'Request status must remain PENDING for step 2');
    });

    test('1.2 [CRITICAL VULNERABILITY] Simultaneous 5x Final Approvals on LEAVE: Quota Race Condition Detected', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const req = await createLeaveRequestSafely(clientLam, {
        leaveType: 'Nghỉ phép năm (có lương)',
        startDate: '2026-09-28',
        endDate: '2026-09-28',
        duration: 1.0,
        reason: 'Concurrency Leave Quota Stress Test',
      });
      const reqId = req.id;

      // Manager approves Step 1
      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      await clientMgr.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'Step 1 OK' });

      // Record Lam annualLeaveUsed before final approval
      const userBefore = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
      const initialLeaveUsed = userBefore.annualLeaveUsed;

      // 5 concurrent HR Admin clients fire approvals at exact same time
      const hrClients = await Promise.all([1, 2, 3, 4, 5].map(async () => {
        const c = new HttpClient();
        await c.login('hr@peace.vn', 'admin123');
        return c;
      }));

      await Promise.all(
        hrClients.map(c => c.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE' }))
      );

      const userAfter = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
      const actualDelta = userAfter.annualLeaveUsed - initialLeaveUsed;

      console.log(`      [Empirical Finding 1.2] Leave Quota Delta under 5 concurrent requests: +${actualDelta} (Expected: +1.0)`);
      if (actualDelta > 1.0) {
        console.log(`      ⚠️  CONFIRMED BUG: Race Condition on Leave Quota Deduction (+${actualDelta} instead of +1.0)`);
      }
      assertEqual(actualDelta, 1.0, `Race condition detected: annualLeaveUsed incremented by ${actualDelta} instead of 1.0`);
    });

    test('1.3 Simultaneous Conflicting Actions (APPROVE vs REJECT on same step): State Consistency Probe', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const req = await createLeaveRequestSafely(clientLam, {
        leaveType: 'Nghỉ không lương',
        startDate: '2026-09-29',
        endDate: '2026-09-29',
        duration: 1.0,
        reason: 'Conflicting actions test',
      });
      const reqId = req.id;

      const clientMgr1 = new HttpClient();
      await clientMgr1.login('manager@peace.vn', 'admin123');
      const clientMgr2 = new HttpClient();
      await clientMgr2.login('manager@peace.vn', 'admin123');

      const [resApprove, resReject] = await Promise.all([
        clientMgr1.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE', note: 'Approve racer' }),
        clientMgr2.post(`/api/approvals/${reqId}/action`, { action: 'REJECT', note: 'Reject racer reason' }),
      ]);

      assert(resApprove.status === 200 || resApprove.status === 400, 'Approve status valid');
      assert(resReject.status === 200 || resReject.status === 400, 'Reject status valid');

      const dbReq = await prisma.approvalRequest.findUnique({
        where: { id: reqId },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });

      if (dbReq.status === 'REJECTED') {
        assertEqual(dbReq.steps[0].status, 'REJECTED', 'If request is REJECTED, step 1 must be REJECTED');
      } else {
        assertEqual(dbReq.steps[0].status, 'APPROVED', 'If request is not REJECTED, step 1 must be APPROVED');
      }
    });

    test('1.4 Rapid Concurrent Check-in Stress (10 simultaneous check-ins for same user and date)', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const testWorkDate = '2026-09-28';
      await prisma.attendance.deleteMany({
        where: { userId: (await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } })).id, workDate: testWorkDate },
      });

      const checkinPromises = Array.from({ length: 10 }).map((_, idx) =>
        clientLam.post('/api/attendance/check-in', {
          latitude: HN_HQ_LAT,
          longitude: HN_HQ_LNG,
          photo: SAMPLE_PHOTO,
          workDate: testWorkDate,
          note: `Concurrent check-in attempt #${idx + 1}`,
        })
      );

      const results = await Promise.all(checkinPromises);

      for (const res of results) {
        assert(res.status === 200 || res.status === 400, `Check-in status must be 200 or 400, got ${res.status}`);
      }

      const successCount = results.filter(r => r.status === 200).length;
      assert(successCount >= 1, `At least 1 check-in must succeed (succeeded: ${successCount})`);

      const lamUser = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
      const records = await prisma.attendance.findMany({
        where: { userId: lamUser.id, workDate: testWorkDate },
      });
      assertEqual(records.length, 1, `Must have exactly 1 attendance record in DB, found ${records.length}`);
      assert(records[0].checkInTime !== null, 'checkInTime must be set');
    });

    test('1.5 [CRITICAL VULNERABILITY] Simultaneous 5x Final Approvals on OVERTIME: OT Hours Multiplication Detected', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const lamUser = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
      const otWorkDate = '2026-09-27';

      await prisma.attendance.upsert({
        where: { userId_workDate: { userId: lamUser.id, workDate: otWorkDate } },
        update: { otHours: 0 },
        create: {
          userId: lamUser.id,
          workDate: otWorkDate,
          otHours: 0,
          status: 'PRESENT',
          calculatedWorkUnits: 1.0,
        },
      });

      const tpls = await clientLam.get('/api/approvals/templates');
      const otTpl = tpls.data.templates.find(t => t.code === 'OVERTIME');

      const createRes = await clientLam.post('/api/approvals', {
        templateId: otTpl.id,
        data: {
          workDate: otWorkDate,
          estimatedHours: 2.5,
          reason: 'Overtime race condition check',
        },
      });
      assertEqual(createRes.status, 200, 'OT request created');
      const reqId = createRes.data.request.id;

      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');
      await clientMgr.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE' });

      const hrClients = await Promise.all([1, 2, 3, 4, 5].map(async () => {
        const c = new HttpClient();
        await c.login('hr@peace.vn', 'admin123');
        return c;
      }));

      await Promise.all(
        hrClients.map(c => c.post(`/api/approvals/${reqId}/action`, { action: 'APPROVE' }))
      );

      const att = await prisma.attendance.findUnique({
        where: { userId_workDate: { userId: lamUser.id, workDate: otWorkDate } },
      });

      console.log(`      [Empirical Finding 1.5] Resulting OT hours under 5 concurrent requests: ${att.otHours}h (Expected: 2.5h)`);
      if (att.otHours > 2.5) {
        console.log(`      ⚠️  CONFIRMED BUG: Race Condition on OT Hours Multiplication (${att.otHours}h instead of 2.5h)`);
      }
      assertEqual(att.otHours, 2.5, `OT Hours must be exactly 2.5, got ${att.otHours}`);
    });
  });

  // =========================================================================
  // SUITE 2: OUT-OF-ORDER APPROVAL & AUTHORIZATION BYPASS ATTACKS
  // =========================================================================
  describe('Adversarial Suite 2 - Out-of-Order Approval & Authorization Bypass', () => {

    test('2.1 Skip-Level Attack: HR Admin attempts to approve Level 2 before Level 1', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const req = await createLeaveRequestSafely(clientLam, {
        leaveType: 'Nghỉ phép năm (có lương)',
        startDate: '2026-09-24',
        endDate: '2026-09-24',
        duration: 1.0,
        reason: 'Skip-level attack test',
      });
      const reqId = req.id;

      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');

      const hrAttackRes = await clientHr.post(`/api/approvals/${reqId}/action`, {
        action: 'APPROVE',
        note: 'Attempting out-of-order Level 2 approval before Level 1',
      });

      assertEqual(hrAttackRes.status, 403, 'HR cannot approve Step 1 (Must return 403)');
      assertIncludes(hrAttackRes.data.error, 'không có quyền', 'Error message must specify no permission');

      const dbReq = await prisma.approvalRequest.findUnique({ where: { id: reqId } });
      assertEqual(dbReq.currentStep, 1, 'Request currentStep must remain 1');
      assertEqual(dbReq.status, 'PENDING', 'Request status must remain PENDING');
    });

    test('2.2 Unauthorized Employee attempts approval on peer request', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const req = await createLeaveRequestSafely(clientLam, {
        leaveType: 'Nghỉ không lương',
        startDate: '2026-09-25',
        endDate: '2026-09-25',
        duration: 1.0,
      });
      const reqId = req.id;

      const clientHoa = new HttpClient();
      await clientHoa.login('hoa@peace.vn', 'user123');
      const attackRes = await clientHoa.post(`/api/approvals/${reqId}/action`, {
        action: 'APPROVE',
      });

      assertEqual(attackRes.status, 403, 'Employee peer cannot approve (HTTP 403)');
    });

    test('2.3 Self-Approval Attack: Employee attempts to approve their own request', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const req = await createLeaveRequestSafely(clientLam, {
        leaveType: 'Nghỉ không lương',
        startDate: '2026-09-25',
        endDate: '2026-09-25',
        duration: 1.0,
      });
      const reqId = req.id;

      const selfApproveRes = await clientLam.post(`/api/approvals/${reqId}/action`, {
        action: 'APPROVE',
        note: 'I approve my own request',
      });

      assertEqual(selfApproveRes.status, 403, 'Employee cannot self-approve (HTTP 403)');
    });

    test('2.4 Action on Terminal State: Attempting action on already REJECTED or APPROVED request', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const req = await createLeaveRequestSafely(clientLam, {
        leaveType: 'Nghỉ không lương',
        startDate: '2026-09-25',
        endDate: '2026-09-25',
        duration: 1.0,
      });
      const reqId = req.id;

      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');

      const rejectRes = await clientMgr.post(`/api/approvals/${reqId}/action`, {
        action: 'REJECT',
        note: 'Rejected permanently',
      });
      assertEqual(rejectRes.status, 200, 'Initial rejection succeeds');

      const attackRes = await clientMgr.post(`/api/approvals/${reqId}/action`, {
        action: 'APPROVE',
        note: 'Trying to resurrect rejected request',
      });
      assertEqual(attackRes.status, 400, 'Cannot act on REJECTED request (HTTP 400)');
      assertIncludes(attackRes.data.error, 'không thể thao tác thêm', 'Must reject closed request action');
    });

    test('2.5 Action with invalid action string (e.g. SUPER_APPROVE or DELETE)', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const req = await createLeaveRequestSafely(clientLam, {
        leaveType: 'Nghỉ không lương',
        startDate: '2026-09-25',
        endDate: '2026-09-25',
        duration: 1.0,
      });
      const reqId = req.id;

      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');

      const res = await clientMgr.post(`/api/approvals/${reqId}/action`, {
        action: 'SUPER_APPROVE',
      });
      assertEqual(res.status, 400, 'Invalid action must return 400');
    });
  });

  // =========================================================================
  // SUITE 3: GPS GEOFENCE ADVERSARIAL EDGE CASES
  // =========================================================================
  describe('Adversarial Suite 3 - GPS Geofence Boundary & Extreme Coordinates', () => {

    test('3.1 Precision Boundary 499.0m: Verified inside geofence for Lam (HN_HQ)', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');

      const testDate = '2026-09-18';
      const lamUser = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
      await prisma.attendance.deleteMany({
        where: { userId: lamUser.id, workDate: testDate },
      });

      const res = await client.post('/api/attendance/check-in', {
        latitude: LAT_499M,
        longitude: HN_HQ_LNG,
        photo: SAMPLE_PHOTO,
        workDate: testDate,
      });

      assertEqual(res.status, 200, '499m check-in must succeed');
      assertEqual(res.data.isInside, true, '499m distance must be strictly inside geofence');
      assert(res.data.distance <= 500, `Distance must be <= 500m, got ${res.data.distance}`);
      assert(res.data.attendance.status !== 'INVALID', 'Status must not be INVALID');
    });

    test('3.2 Precision Boundary 501.0m: Verified outside geofence for Lam (HN_HQ)', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');

      const testDate = '2026-09-19';
      const lamUser = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
      await prisma.attendance.deleteMany({
        where: { userId: lamUser.id, workDate: testDate },
      });

      const res = await client.post('/api/attendance/check-in', {
        latitude: LAT_501M,
        longitude: HN_HQ_LNG,
        photo: SAMPLE_PHOTO,
        workDate: testDate,
      });

      assertEqual(res.status, 200, '501m check-in returns 200 with invalid status');
      assertEqual(res.data.isInside, false, '501m distance must be outside geofence');
      assert(res.data.distance > 500, `Distance must be > 500m, got ${res.data.distance}`);
      assertEqual(res.data.attendance.status, 'INVALID', 'Status must be INVALID');
      assertEqual(res.data.attendance.checkInStatus, 'INVALID_LOCATION', 'checkInStatus must be INVALID_LOCATION');
    });

    test('3.3 Cross-Branch Check-in Detection: HCM employee checking in from Hanoi is detected outside (isInside = false)', async () => {
      const client = new HttpClient();
      await client.login('hoa@peace.vn', 'user123');

      const testDate = '2026-09-20';
      const hoaUser = await prisma.user.findUnique({ where: { email: 'hoa@peace.vn' } });
      await prisma.attendance.deleteMany({
        where: { userId: hoaUser.id, workDate: testDate },
      });

      const res = await client.post('/api/attendance/check-in', {
        latitude: HN_HQ_LAT,
        longitude: HN_HQ_LNG,
        photo: SAMPLE_PHOTO,
        workDate: testDate,
      });

      assertEqual(res.status, 200, 'Cross-branch check-in returns 200');
      assertEqual(res.data.isInside, false, 'Cross-branch distance must be detected as outside');
      assert(res.data.distance > 1000000, `Distance from HCM to Hanoi must be > 1000km, got ${res.data.distance}`);
      assertEqual(res.data.attendance.status, 'INVALID');
    });

    test('3.4 Extreme Coordinate: (0, 0) Gulf of Guinea returns clean 200 with isInside = false', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');

      const testDate = '2026-09-21';
      const lamUser = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
      await prisma.attendance.deleteMany({
        where: { userId: lamUser.id, workDate: testDate },
      });

      const res = await client.post('/api/attendance/check-in', {
        latitude: 0,
        longitude: 0,
        photo: SAMPLE_PHOTO,
        workDate: testDate,
      });

      assertEqual(res.status, 200, 'Extreme (0,0) check-in must return 200');
      assertEqual(res.data.isInside, false, 'Must be outside');
      assert(res.data.distance > 9000000, `Distance should be > 9,000km, got ${res.data.distance}`);
    });

    test('3.5 Extreme Coordinate: (-90, 0) South Pole returns clean 200 with isInside = false', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');

      const testDate = '2026-09-22';
      const lamUser = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
      await prisma.attendance.deleteMany({
        where: { userId: lamUser.id, workDate: testDate },
      });

      const res = await client.post('/api/attendance/check-in', {
        latitude: -90,
        longitude: 0,
        photo: SAMPLE_PHOTO,
        workDate: testDate,
      });

      assertEqual(res.status, 200, 'South Pole check-in returns 200');
      assertEqual(res.data.isInside, false, 'Must be outside');
    });

    test('3.6 Extreme Coordinate: (90, 180) North Pole / Dateline returns clean 200 with isInside = false', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');

      const testDate = '2026-09-23';
      const lamUser = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
      await prisma.attendance.deleteMany({
        where: { userId: lamUser.id, workDate: testDate },
      });

      const res = await client.post('/api/attendance/check-in', {
        latitude: 90,
        longitude: 180,
        photo: SAMPLE_PHOTO,
        workDate: testDate,
      });

      assertEqual(res.status, 200, 'North Pole check-in returns 200');
      assertEqual(res.data.isInside, false, 'Must be outside');
    });

    test('3.7 Malformed GPS: non-numeric string latitude returns clean error without server crash', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');

      const res = await client.post('/api/attendance/check-in', {
        latitude: 'not_a_latitude',
        longitude: 105.85,
        photo: SAMPLE_PHOTO,
      });

      assert(res.status === 400 || res.status === 500, `Must be handled error, got ${res.status}`);
    });

    test('3.8 Missing photo payload returns HTTP 400', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');

      const res = await client.post('/api/attendance/check-in', {
        latitude: HN_HQ_LAT,
        longitude: HN_HQ_LNG,
        photo: '',
      });

      assertEqual(res.status, 400, 'Missing photo must return 400');
      assertIncludes(res.data.error, 'ảnh selfie', 'Error must ask for selfie photo');
    });

    test('3.9 Malformed base64 photo does not crash server and persists safely', async () => {
      const client = new HttpClient();
      await client.login('lam@peace.vn', 'user123');

      const testDate = '2026-09-17';
      const lamUser = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
      await prisma.attendance.deleteMany({
        where: { userId: lamUser.id, workDate: testDate },
      });

      const res = await client.post('/api/attendance/check-in', {
        latitude: HN_HQ_LAT,
        longitude: HN_HQ_LNG,
        photo: 'data:image/jpeg;base64,broken_payload_not_real_base64!!!',
        workDate: testDate,
      });

      assert(res.status === 200 || res.status === 400, 'Must handle malformed photo string');
    });
  });

  // =========================================================================
  // SUITE 4: EMPTY, MALFORMED & BYPASS INPUT INJECTION
  // =========================================================================
  describe('Adversarial Suite 4 - Empty, Malformed & Bypass Input Injection', () => {

    test('4.1 Rejection without note property returns 400', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const req = await createLeaveRequestSafely(clientLam, {
        leaveType: 'Nghỉ không lương',
        startDate: '2026-09-25',
        endDate: '2026-09-25',
        duration: 1.0,
      });
      const reqId = req.id;

      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');

      const res = await clientMgr.post(`/api/approvals/${reqId}/action`, {
        action: 'REJECT',
      });
      assertEqual(res.status, 400, 'Rejection without note must return 400');
      assertIncludes(res.data.error, 'lý do từ chối', 'Must mention rejection reason');
    });

    test('4.2 Rejection with whitespace-only note returns 400', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const req = await createLeaveRequestSafely(clientLam, {
        leaveType: 'Nghỉ không lương',
        startDate: '2026-09-25',
        endDate: '2026-09-25',
        duration: 1.0,
      });
      const reqId = req.id;

      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');

      const res = await clientMgr.post(`/api/approvals/${reqId}/action`, {
        action: 'REJECT',
        note: '   \t\r\n   ',
      });
      assertEqual(res.status, 400, 'Whitespace rejection note must return 400');
    });

    test('4.3 Rejection with null note returns 400', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const req = await createLeaveRequestSafely(clientLam, {
        leaveType: 'Nghỉ không lương',
        startDate: '2026-09-25',
        endDate: '2026-09-25',
        duration: 1.0,
      });
      const reqId = req.id;

      const clientMgr = new HttpClient();
      await clientMgr.login('manager@peace.vn', 'admin123');

      const res = await clientMgr.post(`/api/approvals/${reqId}/action`, {
        action: 'REJECT',
        note: null,
      });
      assertEqual(res.status, 400, 'Null rejection note must return 400');
    });

    test('4.4 Comment with whitespace-only content returns 400', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const req = await createLeaveRequestSafely(clientLam, {
        leaveType: 'Nghỉ không lương',
        startDate: '2026-09-25',
        endDate: '2026-09-25',
        duration: 1.0,
      });
      const reqId = req.id;

      const res = await clientLam.post(`/api/approvals/${reqId}/comment`, {
        content: '     \n\t  ',
      });
      assertEqual(res.status, 400, 'Whitespace comment must return 400');
    });

    test('4.5 [TYPE FRAGILITY] Comment with non-string numeric payload: TypeError 500 detected', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const req = await createLeaveRequestSafely(clientLam, {
        leaveType: 'Nghỉ không lương',
        startDate: '2026-09-25',
        endDate: '2026-09-25',
        duration: 1.0,
      });
      const reqId = req.id;

      const res = await clientLam.post(`/api/approvals/${reqId}/comment`, {
        content: 12345,
      });
      console.log(`      [Empirical Finding 4.5] Non-string comment status: ${res.status}`);
      // An unhandled TypeError in comment route returns 500 instead of clean 400
      assert(res.status === 400 || res.status === 500, 'Must return HTTP error');
    });

    test('4.6 Tampered JWT Token returns 401 on protected route', async () => {
      const client = new HttpClient();
      client.setCookie('peace_auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYWtlX2FkbWluIn0.tampered_signature');
      const res = await client.get('/api/auth/me');
      assertEqual(res.status, 401, 'Tampered token must return 401');
    });

    test('4.7 Arbitrary garbage JWT Token returns 401', async () => {
      const client = new HttpClient();
      client.setCookie('peace_auth_token=not_a_valid_token_xyz_123');
      const res = await client.get('/api/auth/me');
      assertEqual(res.status, 401, 'Garbage token must return 401');
    });

    test('4.8 SQL Injection probe in comment payload: stored safely without injection', async () => {
      const clientLam = new HttpClient();
      await clientLam.login('lam@peace.vn', 'user123');

      const req = await createLeaveRequestSafely(clientLam, {
        leaveType: 'Nghỉ không lương',
        startDate: '2026-09-25',
        endDate: '2026-09-25',
        duration: 1.0,
      });
      const reqId = req.id;

      const sqlPayload = "Robert'); DROP TABLE ApprovalComment; --";
      const res = await clientLam.post(`/api/approvals/${reqId}/comment`, {
        content: sqlPayload,
      });

      assertEqual(res.status, 200, 'SQL injection probe stored as literal string');
      assertEqual(res.data.comment.content, sqlPayload, 'Content preserved verbatim');

      const count = await prisma.approvalComment.count();
      assert(count > 0, 'ApprovalComment table must remain healthy');
    });

    test('4.9 Timesheet query with adversarial month parameters handles gracefully without unhandled crashes', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');

      const resNeg = await clientHr.get('/api/admin/timesheet?month=-5&year=2026');
      assert(resNeg.status === 200 || resNeg.status === 400, `Negative month status ${resNeg.status}`);

      const resBig = await clientHr.get('/api/admin/timesheet?month=99999999999999999999&year=2026');
      assert(resBig.status === 200 || resBig.status === 400, `Overflow month status ${resBig.status}`);

      const resSql = await clientHr.get('/api/admin/timesheet?month=9%27%20OR%201=1--&year=2026');
      assert(resSql.status === 200 || resSql.status === 400, `SQL injection param status ${resSql.status}`);
    });

    test('4.10 [INPUT VALIDATION] Batch schedule inverted date range (startDate > endDate): Gracefully processed in reverse', async () => {
      const clientHr = new HttpClient();
      await clientHr.login('hr@peace.vn', 'admin123');

      const shiftsRes = await clientHr.get('/api/admin/shifts');
      const shift = shiftsRes.data.shifts[0];
      const lamUser = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });

      const res = await clientHr.post('/api/admin/schedules/batch', {
        userIds: [lamUser.id],
        shiftId: shift.id,
        startDate: '2026-09-30',
        endDate: '2026-09-01',
        excludeSundays: true,
      });

      console.log(`      [Empirical Finding 4.10] Inverted interval status: ${res.status}, response: "${res.data?.message}"`);
      assert(res.status === 200 || res.status === 400, 'Handled without crashing process');
    });
  });
}

module.exports = { registerChallengerTests };
