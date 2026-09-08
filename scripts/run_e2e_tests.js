#!/usr/bin/env node

/**
 * Master E2E Test Runner for PEACE GapoWork
 * Usage: node scripts/run_e2e_tests.js
 * Exits with code 0 on pass, code 1 on failure.
 */

const {
  startServerIfNeeded,
  stopServer,
  killPort,
  runAllRegisteredSuites,
} = require('../tests/e2e/harness');

const { registerTier1Tests } = require('../tests/e2e/tier1_features.test');
const { registerTier2Tests } = require('../tests/e2e/tier2_boundaries.test');
const { registerTier3Tests } = require('../tests/e2e/tier3_cross_features.test');
const { registerTier4Tests } = require('../tests/e2e/tier4_real_world.test');
const { registerTier5Tests } = require('../tests/e2e/tier5_designated_approver_and_summary.test');
const { registerTier6Tests } = require('../tests/e2e/tier6_clinic_shift_and_ot_rules.test');
const { registerTier7Tests } = require('../tests/e2e/tier7_hr_offline_digitization.test');
const { registerAcceptanceCriteriaTests } = require('../tests/e2e/acceptance_criteria.test');

const TEST_PORT = process.env.TEST_PORT || 3005;

function registerSignalHandlers() {
  const handleExit = (signal) => {
    console.log(`\n⚠️  Nhận tín hiệu ${signal}. Đang dọn dẹp server và giải phóng cổng ${TEST_PORT}...`);
    stopServer();
    killPort(TEST_PORT);
    process.exit(1);
  };

  process.on('SIGINT', () => handleExit('SIGINT'));
  process.on('SIGTERM', () => handleExit('SIGTERM'));
  process.on('uncaughtException', (err) => {
    console.error('💥 Ngoại lệ chưa xử lý:', err);
    handleExit('uncaughtException');
  });
}

async function main() {
  registerSignalHandlers();

  console.log(`===============================================================`);
  console.log(`🌟 PEACE GapoWork Multi-Role End-to-End Test Suite`);
  console.log(`   Framework: Next.js 14 / Prisma / SQLite / ExcelJS`);
  console.log(`   Scope: Tiers 1-7 + Acceptance Criteria AC 1-5`);
  console.log(`===============================================================`);

  try {
    // Always start a fresh, clean test server on port 3005
    await startServerIfNeeded({ forceFresh: true });

    // Register all suites
    registerTier1Tests();
    registerTier2Tests();
    registerTier3Tests();
    registerTier4Tests();
    registerTier5Tests();
    registerTier6Tests();
    registerTier7Tests();
    registerAcceptanceCriteriaTests();

    // Run suites
    const results = await runAllRegisteredSuites();

    if (results.failed > 0) {
      console.error(`❌ TEST SUITE FAILED: ${results.failed} test(s) failed out of ${results.total}.`);
      process.exitCode = 1;
    } else {
      console.log(`🎉 ALL ${results.total} E2E TESTS PASSED WITH 100% INTEGRITY!`);
      process.exitCode = 0;
    }
  } catch (error) {
    console.error('💥 Fatal error in test runner:', error);
    process.exitCode = 1;
  } finally {
    stopServer();
    killPort(TEST_PORT);
  }
}

main().then(() => {
  process.exit(process.exitCode || 0);
});
