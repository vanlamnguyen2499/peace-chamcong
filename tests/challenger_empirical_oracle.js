/**
 * Empirical Verification Oracle by Challenger 1 (Iteration 2)
 *
 * Hostile verification of:
 *  1. Simultaneous 10x Approvals on OVERTIME (OT hours preservation oracle)
 *  2. Simultaneous 10x Approvals on LEAVE (Annual leave quota deduction oracle)
 *  3. Rapid/Concurrent 20x Request Creation (P2002 collision-free code uniqueness oracle)
 *  4. Deep Comment Type Fragility Matrix (Non-string, arrays, objects, booleans, null, boundaries)
 */

process.env.TEST_PORT = process.env.TEST_PORT || '3000';

const { HttpClient, startServerIfNeeded, stopServer } = require('./e2e/harness');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runOracle() {
  console.log('===============================================================');
  console.log('🔬 EMPIRICAL CHALLENGER ORACLE: DEEP STRESS & VERIFICATION');
  console.log(`   Target Server: http://localhost:${process.env.TEST_PORT}`);
  console.log('===============================================================');

  let serverStarted = false;
  let passed = 0;
  let failed = 0;

  function assert(condition, msg) {
    if (!condition) {
      console.error(`  ❌ FAILED: ${msg}`);
      failed++;
      throw new Error(msg);
    } else {
      console.log(`  ✅ PASSED: ${msg}`);
      passed++;
    }
  }

  try {
    const srv = await startServerIfNeeded();
    serverStarted = srv !== null;

    // -------------------------------------------------------------
    // TEST 1: Rapid / Concurrent Request Creation (20x simultaneous)
    // -------------------------------------------------------------
    console.log('\n--- [ORACLE 1] Concurrency Test: 20x Simultaneous Request Submissions ---');
    const clientLam = new HttpClient();
    await clientLam.login('lam@peace.vn', 'user123');

    const tplsRes = await clientLam.get('/api/approvals/templates');
    const tplLeave = tplsRes.data.templates.find(t => t.code === 'LEAVE');
    assert(tplLeave !== undefined, 'LEAVE template must exist');

    const NUM_CONCURRENT_CREATES = 20;
    const createPromises = Array.from({ length: NUM_CONCURRENT_CREATES }).map((_, idx) =>
      clientLam.post('/api/approvals', {
        templateId: tplLeave.id,
        data: {
          leaveType: 'Nghỉ không lương',
          startDate: `2026-10-${String((idx % 28) + 1).padStart(2, '0')}`,
          endDate: `2026-10-${String((idx % 28) + 1).padStart(2, '0')}`,
          duration: 1.0,
          reason: `High Concurrency Stress Creation #${idx + 1}`,
        },
      })
    );

    const createResponses = await Promise.all(createPromises);
    const createStatuses = createResponses.map(r => r.status);
    const p2002Occurred = createResponses.some(
      r => r.status === 500 && (JSON.stringify(r.data).includes('Unique constraint') || JSON.stringify(r.data).includes('P2002'))
    );

    assert(!p2002Occurred, 'Zero P2002 unique constraint collisions on code generation');
    assert(createStatuses.every(s => s === 200), `All 20 concurrent requests must return HTTP 200 (Got: ${JSON.stringify(createStatuses)})`);

    const generatedCodes = createResponses.map(r => r.data.request.code);
    const uniqueCodesSet = new Set(generatedCodes);
    assert(
      uniqueCodesSet.size === NUM_CONCURRENT_CREATES,
      `All ${NUM_CONCURRENT_CREATES} generated codes must be strictly unique (Set size: ${uniqueCodesSet.size})`
    );

    const regexPattern = /^REQ-\d{6}-\d{4}$/;
    const allMatchRegex = generatedCodes.every(c => regexPattern.test(c));
    assert(allMatchRegex, 'All generated codes strictly adhere to REQ-YYYYMM-XXXX regex');
    console.log(`     Sample generated codes: ${generatedCodes.slice(0, 5).join(', ')} ... (${generatedCodes.length} total)`);

    // -------------------------------------------------------------
    // TEST 2: OVERTIME Simultaneous 10x Approvals (No OT multiplication)
    // -------------------------------------------------------------
    console.log('\n--- [ORACLE 2] Concurrency Test: 10x Simultaneous Approvals on OVERTIME ---');
    const otWorkDate = '2026-12-15';
    const lamUser = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });

    await prisma.attendance.upsert({
      where: { userId_workDate: { userId: lamUser.id, workDate: otWorkDate } },
      update: { otHours: 0, status: 'PRESENT', calculatedWorkUnits: 1.0 },
      create: {
        userId: lamUser.id,
        workDate: otWorkDate,
        otHours: 0,
        status: 'PRESENT',
        calculatedWorkUnits: 1.0,
      },
    });

    const otTpl = tplsRes.data.templates.find(t => t.code === 'OVERTIME');
    const otCreateRes = await clientLam.post('/api/approvals', {
      templateId: otTpl.id,
      data: {
        workDate: otWorkDate,
        estimatedHours: 3.5,
        reason: 'Oracle OT Multiplication Stress Test',
      },
    });
    assert(otCreateRes.status === 200, 'OT request created successfully');
    const otReqId = otCreateRes.data.request.id;

    // Step 1: Manager approves
    const clientMgr = new HttpClient();
    await clientMgr.login('manager@peace.vn', 'admin123');
    const mgrRes = await clientMgr.post(`/api/approvals/${otReqId}/action`, { action: 'APPROVE' });
    assert(mgrRes.status === 200, 'Manager Step 1 approval succeeded');

    // Step 2: 10 concurrent HR Admin clients fire final approvals simultaneously
    const hrClients = await Promise.all(
      Array.from({ length: 10 }).map(async () => {
        const c = new HttpClient();
        await c.login('hr@peace.vn', 'admin123');
        return c;
      })
    );

    const hrOtResults = await Promise.all(
      hrClients.map(c => c.post(`/api/approvals/${otReqId}/action`, { action: 'APPROVE', note: 'Concurrent OT Final' }))
    );

    const hrOtStatuses = hrOtResults.map(r => r.status);
    const hrOtSuccesses = hrOtStatuses.filter(s => s === 200).length;
    const hrOtRejections = hrOtStatuses.filter(s => s === 400).length;
    console.log(`     10 concurrent approvals result: ${hrOtSuccesses} succeeded (200), ${hrOtRejections} rejected by CAS (400)`);

    assert(hrOtSuccesses === 1, `Exactly 1 approval transaction must commit successfully (Got ${hrOtSuccesses})`);
    assert(hrOtSuccesses + hrOtRejections === 10, 'All 10 requests returned valid HTTP 200 or 400 (zero 500 errors)');

    const attAfter = await prisma.attendance.findUnique({
      where: { userId_workDate: { userId: lamUser.id, workDate: otWorkDate } },
    });
    assert(
      attAfter.otHours === 3.5,
      `Attendance otHours must be EXACTLY 3.5h, not multiplied (Found: ${attAfter.otHours}h)`
    );

    // -------------------------------------------------------------
    // TEST 3: LEAVE Simultaneous 10x Approvals (No Quota Multiplication)
    // -------------------------------------------------------------
    console.log('\n--- [ORACLE 3] Concurrency Test: 10x Simultaneous Approvals on LEAVE ---');
    const leaveReqRes = await clientLam.post('/api/approvals', {
      templateId: tplLeave.id,
      data: {
        leaveType: 'Nghỉ phép năm (có lương)',
        startDate: '2026-12-16',
        endDate: '2026-12-16',
        duration: 1.0,
        reason: 'Oracle Leave Quota Stress Test Lam',
      },
    });
    assert(leaveReqRes.status === 200, 'Leave request created successfully for Lam');
    const leaveReqId = leaveReqRes.data.request.id;

    // Step 1 Manager approves (Lam is in TECH department, managed by manager@peace.vn)
    const mgrLeaveRes = await clientMgr.post(`/api/approvals/${leaveReqId}/action`, { action: 'APPROVE' });
    assert(mgrLeaveRes.status === 200, 'Manager Step 1 approval succeeded for Lam leave');

    const userBeforeLeave = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
    const baselineQuota = userBeforeLeave.annualLeaveUsed;

    // 10 concurrent HR Admin clients fire final approvals simultaneously
    const hrLeaveResults = await Promise.all(
      hrClients.map(c => c.post(`/api/approvals/${leaveReqId}/action`, { action: 'APPROVE', note: 'Concurrent Leave Final' }))
    );

    const hrLeaveStatuses = hrLeaveResults.map(r => r.status);
    const hrLeaveSuccesses = hrLeaveStatuses.filter(s => s === 200).length;
    const hrLeaveRejections = hrLeaveStatuses.filter(s => s === 400).length;
    console.log(`     10 concurrent approvals result: ${hrLeaveSuccesses} succeeded (200), ${hrLeaveRejections} rejected by CAS (400)`);

    assert(hrLeaveSuccesses === 1, `Exactly 1 approval transaction must commit successfully (Got ${hrLeaveSuccesses})`);
    assert(hrLeaveSuccesses + hrLeaveRejections === 10, 'All 10 requests returned valid HTTP 200 or 400 (zero 500 errors)');

    const userAfterLeave = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
    const quotaDelta = userAfterLeave.annualLeaveUsed - baselineQuota;
    assert(
      quotaDelta === 1.0,
      `Annual leave quota delta must be EXACTLY +1.0, not multiplied (Found: +${quotaDelta})`
    );

    // -------------------------------------------------------------
    // TEST 4: Deep Comment Type Fragility & Validation Matrix
    // -------------------------------------------------------------
    console.log('\n--- [ORACLE 4] Hostile Comment Validation Matrix (Non-string type rejection) ---');

    const testPayloads = [
      { name: 'Integer number', body: { content: 12345 }, expectedStatus: 400 },
      { name: 'Float number', body: { content: 99.99 }, expectedStatus: 400 },
      { name: 'Boolean true', body: { content: true }, expectedStatus: 400 },
      { name: 'Boolean false', body: { content: false }, expectedStatus: 400 },
      { name: 'Array of strings', body: { content: ['attack', 'vector'] }, expectedStatus: 400 },
      { name: 'Plain Object', body: { content: { injected: true } }, expectedStatus: 400 },
      { name: 'Null value', body: { content: null }, expectedStatus: 400 },
      { name: 'Empty object {}', body: {}, expectedStatus: 400 },
      { name: 'Whitespace string', body: { content: '    \n\r\t   ' }, expectedStatus: 400 },
      { name: 'Oversized string (2001 chars)', body: { content: 'a'.repeat(2001) }, expectedStatus: 400 },
      { name: 'Valid boundary string (2000 chars)', body: { content: 'b'.repeat(2000) }, expectedStatus: 200 },
      { name: 'SQL Injection probe string', body: { content: "Robert'); DROP TABLE User; --" }, expectedStatus: 200 },
      { name: 'Normal valid comment string', body: { content: 'Bình luận trao đổi hợp lệ từ nhân viên' }, expectedStatus: 200 },
    ];

    for (const item of testPayloads) {
      const res = await clientLam.post(`/api/approvals/${leaveReqId}/comment`, item.body);
      assert(
        res.status === item.expectedStatus,
        `Comment payload [${item.name}] returned status ${res.status} (Expected: ${item.expectedStatus})`
      );
      if (item.expectedStatus === 400) {
        assert(res.data && res.data.error, `Comment payload [${item.name}] returned error message: "${res.data?.error}"`);
      }
    }

    console.log('\n===============================================================');
    console.log(`🏆 ALL ORACLE TESTS PASSED: ${passed} assertions passed, ${failed} failed.`);
    console.log('===============================================================');
    process.exitCode = 0;
  } catch (err) {
    console.error('\n💥 ORACLE ASSERTION FAILURE:', err);
    process.exitCode = 1;
  } finally {
    if (serverStarted) {
      stopServer();
    }
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  }
}

runOracle();
