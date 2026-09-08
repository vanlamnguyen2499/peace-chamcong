#!/usr/bin/env node

/**
 * Challenger 1 Adversarial Stress & Concurrency Runner
 * Usage: node scripts/run_challenger_tests.js
 */

const {
  startServerIfNeeded,
  stopServer,
  runAllRegisteredSuites,
} = require('../tests/e2e/harness');

const { registerChallengerTests } = require('../tests/adversarial_challenge');

async function main() {
  console.log(`===============================================================`);
  console.log(`⚔️  CHALLENGER 1: ADVERSARIAL STRESS & CONCURRENCY TEST TRACK`);
  console.log(`   Probing: Race conditions, Quota Integrity, Boundary GPS, Bypass Inputs`);
  console.log(`===============================================================`);

  let serverStarted = false;
  try {
    const srv = await startServerIfNeeded();
    serverStarted = srv !== null;

    registerChallengerTests();

    const results = await runAllRegisteredSuites();

    console.log(`===============================================================`);
    if (results.failed > 0) {
      console.error(`💥 CHALLENGER SUITE UNCOVERED ${results.failed} FAILURE(S) out of ${results.total} tests!`);
      process.exitCode = 1;
    } else {
      console.log(`🛡️  SYSTEM RESILIENT: ALL ${results.total} ADVERSARIAL STRESS TESTS SURVIVED!`);
      process.exitCode = 0;
    }
  } catch (error) {
    console.error('💥 Fatal error in challenger test runner:', error);
    process.exitCode = 1;
  } finally {
    if (serverStarted) {
      stopServer();
    }
  }
}

main().then(() => {
  process.exit(process.exitCode || 0);
});
