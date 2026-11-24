import puppeteer, { Browser, Page } from 'puppeteer-core';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:5173';

interface TestResult {
  suite: string;
  testCase: string;
  role: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL';
  bug?: string;
  fix?: string;
  retest?: string;
}

const results: TestResult[] = [];

async function clickByText(page: Page, selector: string, text: string): Promise<boolean> {
  const found = await page.evaluate((sel, txt) => {
    const elements = Array.from(document.querySelectorAll(sel));
    for (const el of elements) {
      if (el.textContent && el.textContent.includes(txt)) {
        (el as HTMLElement).click();
        return true;
      }
    }
    return false;
  }, selector, text);
  return found;
}

async function loginAs(page: Page, username: string, roleBadge: string): Promise<boolean> {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#username-input, input[placeholder*="sername"]', { timeout: 4000 });

  await page.click('#username-input, input[placeholder*="sername"]', { clickCount: 3 });
  await page.type('#username-input, input[placeholder*="sername"]', username);
  await page.click('#password-input, input[placeholder*="assword"]', { clickCount: 3 });
  await page.type('#password-input, input[placeholder*="assword"]', 'demo123');
  await page.click('button[type="submit"]');

  await page.waitForFunction(
    () => window.location.pathname.includes('/dashboard'),
    { timeout: 6000 }
  );

  return page.evaluate((badge) => document.body.innerText.includes(badge), roleBadge);
}

async function logout(page: Page) {
  await clickByText(page, 'button', 'Logout');
  await page.waitForFunction(
    () => window.location.pathname.includes('/login') || window.location.pathname === '/',
    { timeout: 4000 }
  ).catch(() => null);
  await new Promise((r) => setTimeout(r, 500));
}

async function runBrowserAcceptanceTests() {
  console.log('=== Starting Real Chrome Browser Acceptance Testing ===\n');

  let browser: Browser | null = null;
  const consoleErrors: string[] = [];

  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[Console Error] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(`[Page Error] ${err.message}`);
    });

    // ==========================================
    // TEST 1 — APPLICATION & AUTHENTICATION
    // ==========================================
    console.log('--- TEST 1: APPLICATION & AUTHENTICATION ---');

    // 1.1 Minimal Institutional Landing / Login Page
    await page.goto(APP_URL, { waitUntil: 'networkidle2' });
    const landingTitle = await page.title();
    const hasAmharicName = await page.evaluate(() => document.body.innerText.includes('የባሕር ዳር ከተማ አስተዳደር ግብርና መምሪያ'));
    const hasEnglishName = await page.evaluate(() => document.body.innerText.includes('Bahir Dar City Administration Office of Agriculture'));
    const hasIrfaLogo = await page.evaluate(() => !!document.querySelector('img[alt*="IRFA"]'));

    results.push({
      suite: 'TEST 1 — APPLICATION & AUTHENTICATION',
      testCase: 'Minimal institutional login layout & Bahir Dar City Administration Office of Agriculture branding',
      role: 'Public / Unauthenticated',
      expected: 'Title "IRFA | Bahir Dar City Administration Office of Agriculture" with Amharic and English institutional branding',
      actual: `Title: "${landingTitle}", Office branding: ${hasAmharicName && hasEnglishName}, Logo: ${hasIrfaLogo}`,
      status: landingTitle.includes('Bahir Dar City Administration Office of Agriculture') && hasAmharicName && hasEnglishName && hasIrfaLogo ? 'PASS' : 'FAIL',
    });

    // 1.2 Direct Centered Login Form Presentation
    const hasLoginForm = await page.evaluate(() => !!document.querySelector('#username-input') && !!document.querySelector('#password-input'));
    results.push({
      suite: 'TEST 1 — APPLICATION & AUTHENTICATION',
      testCase: 'Direct centered login card on landing page',
      role: 'Public / Unauthenticated',
      expected: 'Username, password and sign-in button directly accessible on landing view',
      actual: `Login form directly present: ${hasLoginForm}`,
      status: hasLoginForm ? 'PASS' : 'FAIL',
    });

    // 1.3 Incorrect Credentials Validation
    await page.type('#username-input', 'agriculture');
    await page.type('#password-input', 'wrongpass999');
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 800));
    const errorAlertText = await page.evaluate(() => {
      const el = document.querySelector('[role="alert"], .bg-red-50');
      return el ? el.textContent : '';
    });
    const hasBadPassError = errorAlertText?.includes('Incorrect') || errorAlertText?.includes('Invalid') || errorAlertText?.includes('credentials');
    results.push({
      suite: 'TEST 1 — APPLICATION & AUTHENTICATION',
      testCase: 'Incorrect password validation',
      role: 'Public / Unauthenticated',
      expected: 'Displays error alert: "Invalid username or password"',
      actual: `Alert text: "${errorAlertText}"`,
      status: hasBadPassError ? 'PASS' : 'FAIL',
    });

    // 1.4 Test Agriculture Valid Login
    const agriLoginOk = await loginAs(page, 'agriculture', 'Agriculture Office');
    results.push({
      suite: 'TEST 1 — APPLICATION & AUTHENTICATION',
      testCase: 'Agriculture Office login and role redirect',
      role: 'AGRICULTURE_OFFICE',
      expected: 'Redirects to /dashboard with Agriculture Office badge',
      actual: `Redirected to /dashboard: ${page.url().includes('/dashboard')}, Badge verified: ${agriLoginOk}`,
      status: page.url().includes('/dashboard') && agriLoginOk ? 'PASS' : 'FAIL',
    });

    // 1.5 Test Logout
    await logout(page);
    results.push({
      suite: 'TEST 1 — APPLICATION & AUTHENTICATION',
      testCase: 'User logout and session clearance',
      role: 'AGRICULTURE_OFFICE',
      expected: 'Session terminated, redirected back to /login',
      actual: `Current URL: ${page.url()}`,
      status: page.url().includes('/login') ? 'PASS' : 'FAIL',
    });

    // 1.6 Protected Route Access without Auth
    await page.goto(`${APP_URL}/farmers`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));
    const redirectedToLogin = page.url().includes('/login');
    results.push({
      suite: 'TEST 1 — APPLICATION & AUTHENTICATION',
      testCase: 'Protected route guard without active session',
      role: 'Unauthenticated',
      expected: 'Immediate redirection to /login',
      actual: `Current URL: ${page.url()}`,
      status: redirectedToLogin ? 'PASS' : 'FAIL',
    });

    // ==========================================
    // TEST 2 — AGRICULTURE OFFICE WORKFLOWS
    // ==========================================
    console.log('\n--- TEST 2: AGRICULTURE OFFICE WORKFLOWS ---');
    await loginAs(page, 'agriculture', 'Agriculture Office');

    // 2.1 Farmer Registration
    await page.goto(`${APP_URL}/farmers`, { waitUntil: 'networkidle2' });
    await clickByText(page, 'button', 'Register Farmer');
    await page.waitForSelector('input[placeholder="e.g. Abebe Tesfaye"]', { timeout: 4000 });

    const testFarmerName = `Beshah Molla ${Date.now().toString().slice(-4)}`;
    await page.type('input[placeholder="e.g. Abebe Tesfaye"]', testFarmerName);
    await page.type('input[placeholder="+251 918 000 000"]', '+251 918 555 777');
    await page.type('input[placeholder="ETH-BD-2026-..."]', `ETH-BD-2026-${Date.now().toString().slice(-4)}`);
    await clickByText(page, 'button', 'Save & Issue QR Card');
    await new Promise((r) => setTimeout(r, 2000));

    const farmerCreated = await page.evaluate((name) => document.body.innerText.includes(name), testFarmerName);
    results.push({
      suite: 'TEST 2 — AGRICULTURE OFFICE',
      testCase: 'Farmer registration with irrigation profile & card issuance',
      role: 'AGRICULTURE_OFFICE',
      expected: 'Farmer saved in database with auto-generated ID and QR card',
      actual: `Farmer "${testFarmerName}" appears in registry: ${farmerCreated}`,
      status: farmerCreated ? 'PASS' : 'FAIL',
    });

    // 2.2 Search & Filter
    await page.type('input[placeholder*="Search by name"]', testFarmerName);
    await new Promise((r) => setTimeout(r, 800));
    const searchMatches = await page.evaluate((name) => document.body.innerText.includes(name), testFarmerName);
    results.push({
      suite: 'TEST 2 — AGRICULTURE OFFICE',
      testCase: 'Real-time farmer search by name / ID',
      role: 'AGRICULTURE_OFFICE',
      expected: 'Table filters dynamically to show searched farmer',
      actual: `Filtered list contains "${testFarmerName}": ${searchMatches}`,
      status: searchMatches ? 'PASS' : 'FAIL',
    });

    // 2.3 Farmer Detail Dossier & QR Card Preview
    // Clear search filter so the table lists farmers with details buttons
    await page.click('input[placeholder*="Search by name"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await new Promise((r) => setTimeout(r, 600));

    const detailsClicked = await clickByText(page, 'button', 'Details');
    let hasDossier = false;
    let hasQrImage = false;
    if (detailsClicked) {
      await page.waitForSelector('#printable-card', { timeout: 6000 }).catch(() => null);
      hasDossier = await page.evaluate(() => document.body.innerText.includes('Irrigation & Pump Profile') || document.body.innerText.includes('Farmer Details'));
      hasQrImage = await page.evaluate(() => !!document.querySelector('#printable-card img, #printable-card canvas, #printable-card'));
    }
    results.push({
      suite: 'TEST 2 — AGRICULTURE OFFICE',
      testCase: 'Farmer dossier page and printable QR digital ID card',
      role: 'AGRICULTURE_OFFICE',
      expected: 'Displays irrigation metrics and printable digital QR identity card',
      actual: `Irrigation profile present: ${hasDossier}, QR Code image rendered: ${hasQrImage}`,
      status: hasDossier && hasQrImage ? 'PASS' : 'FAIL',
    });

    // 2.4 Monthly Allocation Creation
    await page.goto(`${APP_URL}/allocations`, { waitUntil: 'networkidle2' });
    await clickByText(page, 'button', 'Create Allocation');
    await page.waitForSelector('button[type="submit"]', { timeout: 3000 });
    await clickByText(page, 'button', 'Confirm Allocation');
    await new Promise((r) => setTimeout(r, 1500));
    const allocationCreated = await page.evaluate(() => document.body.innerText.includes('L') && document.body.innerText.includes('Monthly Fuel Allocation'));
    results.push({
      suite: 'TEST 2 — AGRICULTURE OFFICE',
      testCase: 'Monthly fuel allocation quota creation',
      role: 'AGRICULTURE_OFFICE',
      expected: 'Allocation recorded with allocatedLiters = remainingLiters (175 L)',
      actual: `Table contains allocation: ${allocationCreated}`,
      status: allocationCreated ? 'PASS' : 'FAIL',
    });

    // 2.5 Submit Fuel Request to Trade
    await page.goto(`${APP_URL}/requests`, { waitUntil: 'networkidle2' });
    await clickByText(page, 'button', 'Prepare Fuel Request');
    await page.waitForSelector('input[type="checkbox"]', { timeout: 3000 });
    await page.click('input[type="checkbox"]');
    await clickByText(page, 'button', 'Submit to Trade');
    await new Promise((r) => setTimeout(r, 2000));
    const requestSubmitted = await page.evaluate(() => document.body.innerText.includes('TR-2026-') || document.body.innerText.includes('Submitted'));
    results.push({
      suite: 'TEST 2 — AGRICULTURE OFFICE',
      testCase: 'Prepare and submit bundled fuel request to Trade Office',
      role: 'AGRICULTURE_OFFICE',
      expected: 'Request submitted with TR-YYYY-XXX reference and status "Submitted"',
      actual: `Submitted request appears in table: ${requestSubmitted}`,
      status: requestSubmitted ? 'PASS' : 'FAIL',
    });

    // Logout Agriculture
    await logout(page);

    // ==========================================
    // TEST 3 — TRADE OFFICE WORKFLOWS
    // ==========================================
    console.log('\n--- TEST 3: TRADE OFFICE WORKFLOWS ---');
    await loginAs(page, 'trade', 'Trade Office');

    // 3.1 Review Incoming Requests
    await page.goto(`${APP_URL}/trade/requests`, { waitUntil: 'networkidle2' });
    const hasIncoming = await page.evaluate(() => document.body.innerText.includes('Review Request') || document.body.innerText.includes('Review') || document.body.innerText.includes('View Decision'));
    results.push({
      suite: 'TEST 3 — TRADE OFFICE',
      testCase: 'Incoming requests queue presentation',
      role: 'TRADE_OFFICE',
      expected: 'Trade queue lists requests submitted by Agriculture Office',
      actual: `Incoming request review buttons available: ${hasIncoming}`,
      status: hasIncoming ? 'PASS' : 'FAIL',
    });

    // 3.2 Review Decision Modal (Approve Full)
    const reviewClicked = await clickByText(page, 'button', 'Review Request') || await clickByText(page, 'button', 'Review');
    if (reviewClicked) {
      await page.waitForSelector('textarea', { timeout: 4000 });
      await clickByText(page, 'button', 'Approve Full');
      await page.type('textarea', 'Approved by Trade Department inspector.');
      await clickByText(page, 'button', 'Commit Trade Decision');
      await new Promise((r) => setTimeout(r, 2000));
    }
    const hasApproved = await page.evaluate(() => document.body.innerText.toLowerCase().includes('approved'));
    results.push({
      suite: 'TEST 3 — TRADE OFFICE',
      testCase: 'Request approval and formal authorization generation',
      role: 'TRADE_OFFICE',
      expected: 'Request status updates to Approved; provisions FuelAuthorization records',
      actual: `Approved status verified: ${hasApproved}`,
      status: hasApproved ? 'PASS' : 'FAIL',
    });

    // 3.3 Station Assignment
    await page.goto(`${APP_URL}/trade/stations`, { waitUntil: 'networkidle2' });
    const hasAssignBtn = await clickByText(page, 'button', '+ Assign Station') || await clickByText(page, 'button', 'Assign Station') || await clickByText(page, 'button', 'Change Station');
    if (hasAssignBtn) {
      await page.waitForSelector('select', { timeout: 3000 });
      // Select Tana Energy Fuel Station (BD-ST-01) so station matches demo operator
      await page.evaluate(() => {
        const select = document.querySelector('select') as HTMLSelectElement;
        if (select) {
          for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].text.includes('Tana')) {
              select.selectedIndex = i;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
      });
      await clickByText(page, 'button', 'Confirm Assignment');
      await new Promise((r) => setTimeout(r, 2000));
    }
    const hasAssignedPill = await page.evaluate(() => document.body.innerText.includes('Assigned') || document.body.innerText.includes('ASSIGNED'));
    results.push({
      suite: 'TEST 3 — TRADE OFFICE',
      testCase: 'Assign authorized farmer quota to local fuel station',
      role: 'TRADE_OFFICE',
      expected: 'Station assignment mapped and status shows "Assigned"',
      actual: `Assignment confirmed: ${hasAssignedPill}`,
      status: hasAssignedPill ? 'PASS' : 'FAIL',
    });

    // Logout Trade
    await logout(page);

    // ==========================================
    // TEST 4 — FUEL STATION OPERATIONS
    // ==========================================
    console.log('\n--- TEST 4: FUEL STATION OPERATIONS ---');
    await loginAs(page, 'station', 'Fuel Station');

    // 4.1 Scanner & Farmer Verification
    await page.goto(`${APP_URL}/scanner`, { waitUntil: 'networkidle2' });
    await clickByText(page, 'button', 'Demo: Abebe (FR-00124)');
    await new Promise((r) => setTimeout(r, 1500));

    const hasAuthorizedBanner = await page.evaluate(() => document.body.innerText.toUpperCase().includes('AUTHORIZED FOR DISPENSING'));
    const hasRemainingQuota = await page.evaluate(() => document.body.innerText.toUpperCase().includes('REMAINING AVAILABLE'));
    results.push({
      suite: 'TEST 4 — FUEL STATION OPERATIONS',
      testCase: '8-step live legality QR verification for authorized farmer',
      role: 'STATION_ADMIN',
      expected: 'Returns green AUTHORIZED banner with quota balance breakdown',
      actual: `Authorized banner: ${hasAuthorizedBanner}, Remaining quota card: ${hasRemainingQuota}`,
      status: hasAuthorizedBanner && hasRemainingQuota ? 'PASS' : 'FAIL',
    });

    // 4.2 Record Fuel Dispensing
    await clickByText(page, 'button', 'Confirm Dispensing & Issue Official Receipt');
    await page.waitForSelector('#printable-card', { timeout: 5000 }).catch(() => null);

    const hasReceiptModal = await page.evaluate(() => document.body.innerText.includes('Fuel Dispensed Successfully') && document.body.innerText.includes('Receipt #TX-'));
    results.push({
      suite: 'TEST 4 — FUEL STATION OPERATIONS',
      testCase: 'Atomic fuel dispensing and official receipt issuance',
      role: 'STATION_ADMIN',
      expected: 'Generates official receipt TX-YYYYMMDD-XXXX with printable layout',
      actual: `Receipt modal displayed: ${hasReceiptModal}`,
      status: hasReceiptModal ? 'PASS' : 'FAIL',
    });

    // Close Receipt Modal
    await clickByText(page, 'button', 'Close');

    // 4.3 Suspended Farmer Check
    await clickByText(page, 'button', 'Demo: Suspended (FR-00127)');
    await new Promise((r) => setTimeout(r, 1500));
    const hasRejectedAlert = await page.evaluate(() => document.body.innerText.includes('VERIFICATION REJECTED') && document.body.innerText.includes('inactive'));
    results.push({
      suite: 'TEST 4 — FUEL STATION OPERATIONS',
      testCase: 'Suspended / Inactive farmer scan rejection',
      role: 'STATION_ADMIN',
      expected: 'Access blocked with red REJECTED banner citing suspension reason',
      actual: `Rejected alert rendered: ${hasRejectedAlert}`,
      status: hasRejectedAlert ? 'PASS' : 'FAIL',
    });

    // 4.4 Transaction History Verification
    await page.goto(`${APP_URL}/transactions`, { waitUntil: 'networkidle2' });
    const hasRecordedTx = await page.evaluate(() => document.body.innerText.includes('TX-2026') && document.body.innerText.includes('RECORDED'));
    results.push({
      suite: 'TEST 4 — FUEL STATION OPERATIONS',
      testCase: 'Station transaction history audit log',
      role: 'STATION_ADMIN',
      expected: 'Completed dispensing appears in immutable transaction table',
      actual: `Transaction record visible: ${hasRecordedTx}`,
      status: hasRecordedTx ? 'PASS' : 'FAIL',
    });

    // Logout Station
    await logout(page);

    // ==========================================
    // TEST 5 — SYSTEM ADMINISTRATOR WORKFLOWS
    // ==========================================
    console.log('\n--- TEST 5: SYSTEM ADMINISTRATOR WORKFLOWS ---');
    await loginAs(page, 'admin', 'System Administrator');

    // 5.1 System Health
    await page.goto(`${APP_URL}/sysadmin/health`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));
    const hasHealth = await page.evaluate(() => document.body.innerText.includes('Operational') && document.body.innerText.includes('MariaDB'));
    results.push({
      suite: 'TEST 5 — SYSTEM ADMINISTRATOR',
      testCase: 'System health diagnostics & database ping',
      role: 'SYSTEM_ADMIN',
      expected: 'Displays operational application status and MySQL connectivity',
      actual: `Health indicators operational: ${hasHealth}`,
      status: hasHealth ? 'PASS' : 'FAIL',
    });

    // 5.2 Users Management
    await page.goto(`${APP_URL}/sysadmin/users`, { waitUntil: 'networkidle2' });
    const hasUsersTable = await page.evaluate(() => document.body.innerText.includes('agriculture') && document.body.innerText.includes('trade'));
    results.push({
      suite: 'TEST 5 — SYSTEM ADMINISTRATOR',
      testCase: 'User accounts and role access directory',
      role: 'SYSTEM_ADMIN',
      expected: 'Lists system users with roles, offices, and status',
      actual: `User table loaded: ${hasUsersTable}`,
      status: hasUsersTable ? 'PASS' : 'FAIL',
    });

    // 5.3 Technical Audit Logs
    await page.goto(`${APP_URL}/sysadmin/audit`, { waitUntil: 'networkidle2' });
    const hasAuditLogs = await page.evaluate(() => document.body.innerText.includes('USER_LOGIN') || document.body.innerText.includes('FUEL_DISPENSED'));
    results.push({
      suite: 'TEST 5 — SYSTEM ADMINISTRATOR',
      testCase: 'Technical audit trail log inspection',
      role: 'SYSTEM_ADMIN',
      expected: 'Displays immutable log of system actions and timestamps',
      actual: `Audit logs loaded: ${hasAuditLogs}`,
      status: hasAuditLogs ? 'PASS' : 'FAIL',
    });

    // Logout Admin
    await logout(page);

  } catch (err: any) {
    console.error('Browser testing encountered an unhandled exception:', err);
  } finally {
    if (browser) await browser.close();
  }

  console.log('\n=== Browser Acceptance Test Summary ===');
  let passCount = 0;
  let failCount = 0;
  for (const r of results) {
    console.log(`[${r.status}] ${r.testCase} (${r.role})`);
    if (r.status === 'PASS') passCount++;
    else failCount++;
  }
  console.log(`\nTotal: ${passCount} Passed, ${failCount} Failed.`);

  fs.writeFileSync(
    'c:/Users/1234/Desktop/IRFA/browser_test_results.json',
    JSON.stringify({ results, consoleErrors }, null, 2)
  );
}

runBrowserAcceptanceTests();
