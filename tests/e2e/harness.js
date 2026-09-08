/**
 * E2E Test Harness for PEACE GapoWork
 * Provides isolated HTTP client with cookie management, server provisioning,
 * user authentication sessions, and assertion utilities.
 */

const { spawn, execSync } = require('child_process');
const http = require('http');

const DEFAULT_PORT = process.env.TEST_PORT || 3005;
const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${DEFAULT_PORT}`;

class HttpClient {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.cookies = new Map();
  }

  setCookie(cookieStr) {
    if (!cookieStr) return;
    const parts = cookieStr.split(';')[0].split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      this.cookies.set(key, val);
    }
  }

  getCookieHeader() {
    if (this.cookies.size === 0) return '';
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  clearCookies() {
    this.cookies.clear();
  }

  async request(path, options = {}) {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const headers = { ...options.headers };

    const cookieHeader = this.getCookieHeader();
    if (cookieHeader && !headers['Cookie'] && !headers['cookie']) {
      headers['Cookie'] = cookieHeader;
    }

    if (options.body && typeof options.body === 'object' && !(options.body instanceof Buffer)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    // Capture set-cookie headers
    const setCookieHeaders = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')].filter(Boolean);

    for (const sc of setCookieHeaders) {
      this.setCookie(sc);
    }

    // Determine response body type
    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => null);
    } else if (contentType.includes('spreadsheetml') || contentType.includes('octet-stream')) {
      const arrayBuf = await res.arrayBuffer();
      data = Buffer.from(arrayBuf);
    } else {
      data = await res.text().catch(() => '');
    }

    return {
      status: res.status,
      headers: res.headers,
      data,
    };
  }

  async get(path, headers = {}) {
    return this.request(path, { method: 'GET', headers });
  }

  async post(path, body, headers = {}) {
    return this.request(path, { method: 'POST', body, headers });
  }

  async put(path, body, headers = {}) {
    return this.request(path, { method: 'PUT', body, headers });
  }

  async delete(path, headers = {}) {
    return this.request(path, { method: 'DELETE', headers });
  }

  async login(email, password) {
    const res = await this.post('/api/auth/login', { email, password });
    return res;
  }
}

// Test Runner & Assertion State
const testState = {
  suites: [],
  currentSuite: null,
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  failures: [],
  serverProcess: null,
};

function describe(suiteName, fn) {
  testState.suites.push({
    name: suiteName,
    tests: [],
    runFn: fn,
  });
}

function test(testName, testFn) {
  if (!testState.currentSuite) {
    throw new Error('test() must be called inside describe()');
  }
  testState.currentSuite.tests.push({
    name: testName,
    fn: testFn,
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'assertEqual failed'}: Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(actual, search, message) {
  if (typeof actual === 'string' && !actual.includes(search)) {
    throw new Error(`${message || 'assertIncludes failed'}: String "${actual}" does not contain "${search}"`);
  }
  if (Array.isArray(actual) && !actual.includes(search)) {
    throw new Error(`${message || 'assertIncludes failed'}: Array does not contain ${JSON.stringify(search)}`);
  }
}

async function isServerReachable(url) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = http.get({
        hostname: u.hostname,
        port: u.port || 80,
        path: '/api/attendance/today',
        timeout: 1000,
      }, (res) => {
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch (e) {
      resolve(false);
    }
  });
}

function killPort(port) {
  try {
    const output = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (output) {
      const pids = output.split(/\s+/).filter(Boolean);
      for (const pid of pids) {
        try {
          process.kill(Number(pid), 'SIGKILL');
        } catch (_) {}
      }
      console.log(`🧹 Đã dọn dẹp tiến trình treo [${pids.join(', ')}] trên cổng ${port}`);
    }
  } catch (_) {
    // Port is free
  }
}

async function startServerIfNeeded({ forceFresh = false } = {}) {
  if (forceFresh) {
    console.log(`🔄 Yêu cầu khởi động môi trường kiểm thử mới: Giải phóng cổng ${DEFAULT_PORT}...`);
    killPort(DEFAULT_PORT);
  } else {
    const reachable = await isServerReachable(BASE_URL);
    if (reachable) {
      console.log(`📡 Connected to existing server at ${BASE_URL}`);
      return null;
    }
  }

  console.log(`🚀 Starting Next.js test server on port ${DEFAULT_PORT}...`);
  const nextBin = require.resolve('next/dist/bin/next');
  const srv = spawn(process.execPath, [nextBin, 'start', '-p', String(DEFAULT_PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(DEFAULT_PORT) },
    stdio: 'pipe',
    detached: true,
  });

  srv.stderr.on('data', (d) => {
    process.stderr.write(`[Server] ${d.toString()}`);
  });

  testState.serverProcess = srv;

  // Poll until reachable (max 15 seconds)
  const startTime = Date.now();
  while (Date.now() - startTime < 15000) {
    await new Promise((r) => setTimeout(r, 400));
    if (await isServerReachable(BASE_URL)) {
      console.log(`✅ Test server is online at ${BASE_URL} (${Date.now() - startTime}ms)`);
      return srv;
    }
  }

  stopServer();
  throw new Error(`Failed to start test server on port ${DEFAULT_PORT} within 15s`);
}

function stopServer() {
  if (testState.serverProcess) {
    console.log('🛑 Stopping test server...');
    try {
      if (testState.serverProcess.pid) {
        process.kill(-testState.serverProcess.pid, 'SIGTERM');
      }
    } catch (_) {
      try {
        testState.serverProcess.kill('SIGTERM');
      } catch (_) {}
    }
    testState.serverProcess = null;
  }
  killPort(DEFAULT_PORT);
}

async function runAllRegisteredSuites() {
  const startTime = Date.now();
  console.log(`\n===============================================================`);
  console.log(`🧪 RUNNING E2E TEST TRACK (${testState.suites.length} Suites Registered)`);
  console.log(`===============================================================\n`);

  for (const suite of testState.suites) {
    testState.currentSuite = suite;
    console.log(`📂 Suite: ${suite.name}`);
    await suite.runFn();

    for (const t of suite.tests) {
      testState.totalTests++;
      const tStart = Date.now();
      try {
        await t.fn();
        testState.passedTests++;
        const dur = Date.now() - tStart;
        console.log(`   ✅ PASS: ${t.name} (${dur}ms)`);
      } catch (err) {
        testState.failedTests++;
        const dur = Date.now() - tStart;
        console.log(`   ❌ FAIL: ${t.name} (${dur}ms)`);
        console.log(`      Error: ${err.message}`);
        testState.failures.push({
          suite: suite.name,
          test: t.name,
          error: err.message,
          stack: err.stack,
        });
      }
    }
    console.log('');
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`===============================================================`);
  console.log(`📊 TEST EXECUTION SUMMARY`);
  console.log(`===============================================================`);
  console.log(`Total Suites:    ${testState.suites.length}`);
  console.log(`Total Tests:     ${testState.totalTests}`);
  console.log(`Passed:          ${testState.passedTests}`);
  console.log(`Failed:          ${testState.failedTests}`);
  console.log(`Execution Time:  ${duration}s`);

  if (testState.failures.length > 0) {
    console.log(`\n❌ FAILURES BREAKDOWN:`);
    testState.failures.forEach((f, idx) => {
      console.log(`\n[${idx + 1}] Suite: ${f.suite}`);
      console.log(`    Test:  ${f.test}`);
      console.log(`    Error: ${f.error}`);
    });
  }
  console.log(`===============================================================\n`);

  return {
    total: testState.totalTests,
    passed: testState.passedTests,
    failed: testState.failedTests,
    duration,
    failures: testState.failures,
  };
}

module.exports = {
  HttpClient,
  BASE_URL,
  describe,
  test,
  assert,
  assertEqual,
  assertIncludes,
  startServerIfNeeded,
  stopServer,
  killPort,
  runAllRegisteredSuites,
  testState,
};
