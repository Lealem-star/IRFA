import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\1234\\.gemini\\antigravity\\brain\\cd1b2618-018f-4d4d-a1a5-e15c803d4780';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runUIAudit() {
  console.log('Starting Puppeteer UI Functional Audit for System Administration Portal...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();

  try {
    // ------------------------------------------------------------------------
    // DESKTOP VIEWPORT AUDIT (1366 x 850)
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Testing Desktop Chrome Viewport (1366 x 850) ---');
    await page.setViewport({ width: 1366, height: 850, deviceScaleFactor: 1 });

    // Step 1: Login as System Admin
    console.log('Navigating to Login Page: http://localhost:3000/login');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await delay(1000);

    console.log('Entering admin credentials (admin / demo123)...');
    await page.type('input[placeholder*="username" i], input[type="text"]', 'admin');
    await page.type('input[type="password"]', 'demo123');

    console.log('Submitting login form...');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);

    await delay(2500); // Allow central ledger API to complete fetch
    console.log(`Current URL after login: ${page.url()}`);

    // Screenshot 1: Desktop System Admin Dashboard
    console.log('Capturing Screenshot 01: System Admin Dashboard (Desktop)...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sysadmin_audit_01_dashboard.png'),
      fullPage: false,
    });

    // Step 2: Navigate to Users & Roles Management
    console.log('Navigating to Users Page: http://localhost:3000/sysadmin/users');
    await page.goto('http://localhost:3000/sysadmin/users', { waitUntil: 'networkidle2' });
    await delay(2000);

    // Screenshot 2: Desktop Users Table
    console.log('Capturing Screenshot 02: Users Management Page (Desktop)...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sysadmin_audit_02_users_page.png'),
      fullPage: false,
    });

    // Step 3: Open Create User Modal
    console.log('Opening Create User Modal...');
    const createBtn = await page.waitForSelector('button:has-text("Create User"), button:has(svg.lucide-plus), button:has(span:has-text("Create User"))', { timeout: 5000 }).catch(() => null);
    if (createBtn) {
      await createBtn.click();
    } else {
      // Fallback selector
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find((b) => b.innerText.includes('Create User'));
        if (target) target.click();
      });
    }
    await delay(1000);

    // Screenshot 3: Create User Modal
    console.log('Capturing Screenshot 03: Create User Modal Dialog...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sysadmin_audit_03_create_user_modal.png'),
      fullPage: false,
    });

    // Close modal
    await page.evaluate(() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Cancel'));
      if (cancelBtn) cancelBtn.click();
    });
    await delay(500);

    // Step 4: Open Reset Password Modal
    console.log('Opening Reset Password Modal for a user...');
    await page.evaluate(() => {
      const resetBtns = Array.from(document.querySelectorAll('button')).filter((b) => b.innerText.includes('Reset Pwd'));
      if (resetBtns.length > 0) resetBtns[0].click();
    });
    await delay(1000);

    // Screenshot 4: Reset Password Modal
    console.log('Capturing Screenshot 04: Reset Password Modal Dialog...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sysadmin_audit_04_reset_password_modal.png'),
      fullPage: false,
    });

    // Close modal
    await page.evaluate(() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Cancel'));
      if (cancelBtn) cancelBtn.click();
    });
    await delay(500);

    // Step 5: System Configuration Settings
    console.log('Navigating to System Settings: http://localhost:3000/sysadmin/settings');
    await page.goto('http://localhost:3000/sysadmin/settings', { waitUntil: 'networkidle2' });
    await delay(2000);

    // Screenshot 5: System Settings
    console.log('Capturing Screenshot 05: System Settings Page (Desktop)...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sysadmin_audit_05_settings_page.png'),
      fullPage: false,
    });

    // Step 6: Technical Audit Logs
    console.log('Navigating to Audit Logs: http://localhost:3000/sysadmin/audit');
    await page.goto('http://localhost:3000/sysadmin/audit', { waitUntil: 'networkidle2' });
    await delay(2000);

    // Screenshot 6: Audit Logs
    console.log('Capturing Screenshot 06: Technical Audit Logs Page (Desktop)...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sysadmin_audit_06_audit_logs_page.png'),
      fullPage: false,
    });

    // Step 7: System Health Diagnostics
    console.log('Navigating to System Health: http://localhost:3000/sysadmin/health');
    await page.goto('http://localhost:3000/sysadmin/health', { waitUntil: 'networkidle2' });
    await delay(2000);

    // Screenshot 7: System Health
    console.log('Capturing Screenshot 07: System Health Diagnostics Page (Desktop)...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sysadmin_audit_07_system_health_page.png'),
      fullPage: false,
    });

    // ------------------------------------------------------------------------
    // MOBILE VIEWPORT AUDIT (390 x 844 — iPhone 14 / Standard Handheld)
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing Mobile Handheld Viewport (390 x 844) ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    // Step 8: Mobile Dashboard
    console.log('Navigating to Mobile Dashboard: http://localhost:3000/dashboard');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await delay(2000);

    // Screenshot 8: Mobile Dashboard
    console.log('Capturing Screenshot 08: Mobile System Admin Dashboard...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sysadmin_audit_08_mobile_dashboard.png'),
      fullPage: false,
    });

    // Step 9: Mobile Users Management
    console.log('Navigating to Mobile Users: http://localhost:3000/sysadmin/users');
    await page.goto('http://localhost:3000/sysadmin/users', { waitUntil: 'networkidle2' });
    await delay(2000);

    // Screenshot 9: Mobile Users
    console.log('Capturing Screenshot 09: Mobile Users Management Page...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sysadmin_audit_09_mobile_users.png'),
      fullPage: false,
    });

    // Step 10: Mobile Technical Audit Logs
    console.log('Navigating to Mobile Audit Logs: http://localhost:3000/sysadmin/audit');
    await page.goto('http://localhost:3000/sysadmin/audit', { waitUntil: 'networkidle2' });
    await delay(2000);

    // Screenshot 10: Mobile Audit Logs
    console.log('Capturing Screenshot 10: Mobile Technical Audit Logs Page...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sysadmin_audit_10_mobile_audit_logs.png'),
      fullPage: false,
    });

    // Step 11: Mobile System Health
    console.log('Navigating to Mobile System Health: http://localhost:3000/sysadmin/health');
    await page.goto('http://localhost:3000/sysadmin/health', { waitUntil: 'networkidle2' });
    await delay(2000);

    // Screenshot 11: Mobile System Health
    console.log('Capturing Screenshot 11: Mobile System Health Page...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sysadmin_audit_11_mobile_system_health.png'),
      fullPage: false,
    });

    // Step 12: Mobile System Settings
    console.log('Navigating to Mobile Settings: http://localhost:3000/sysadmin/settings');
    await page.goto('http://localhost:3000/sysadmin/settings', { waitUntil: 'networkidle2' });
    await delay(2000);

    // Screenshot 12: Mobile Settings
    console.log('Capturing Screenshot 12: Mobile System Settings Page...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sysadmin_audit_12_mobile_settings.png'),
      fullPage: false,
    });

    console.log('\nPuppeteer UI Functional Audit for System Administration Portal completed successfully!');
  } catch (err: any) {
    console.error('Puppeteer UI Audit Error:', err);
  } finally {
    await browser.close();
  }
}

runUIAudit();
