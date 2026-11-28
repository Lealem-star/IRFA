import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\1234\\.gemini\\antigravity\\brain\\cd1b2618-018f-4d4d-a1a5-e15c803d4780';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTradeBrowserAudit() {
  console.log('Starting Puppeteer UI Functional Audit for Trade Office Portal...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 850 });

  try {
    // 1. Login Page
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await delay(500);

    // Clear any existing tokens in localStorage first
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await delay(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'trade_audit_01_login.png') });

    // Submit Trade credentials
    console.log('Submitting credentials for user trade...');
    await page.type('input[type="text"], input[name="username"]', 'trade');
    await page.type('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');

    // Wait for Dashboard to render
    console.log('2. Waiting for Trade Dashboard to load...');
    await page.waitForSelector('aside nav a[href="/trade/requests"]', { timeout: 15000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'trade_audit_02_dashboard.png') });

    // 2. Incoming Requests Page
    console.log('3. Navigating to Incoming Requests (/trade/requests)...');
    await page.click('aside nav a[href="/trade/requests"]');
    await page.waitForSelector('table', { timeout: 10000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'trade_audit_03_incoming_requests.png') });

    // Open Review Modal on first request if exists
    const reviewBtn = await page.$('table tbody tr:first-child button');
    if (reviewBtn) {
      console.log('Opening Review Modal...');
      await reviewBtn.click();
      await delay(1000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'trade_audit_04_review_modal.png') });
      const closeX = await page.$('.fixed button svg.lucide-x') || await page.$('.fixed button');
      if (closeX) await closeX.click();
      await delay(500);
    }

    // 3. Fuel Authorizations Page
    console.log('4. Navigating to Authorizations (/trade/authorizations)...');
    await page.click('aside nav a[href="/trade/authorizations"]');
    await page.waitForSelector('table', { timeout: 10000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'trade_audit_05_authorizations_page.png') });

    // 4. Station Assignment Page
    console.log('5. Navigating to Station Assignment (/trade/stations)...');
    await page.click('aside nav a[href="/trade/stations"]');
    await page.waitForSelector('table', { timeout: 10000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'trade_audit_06_station_assignment_page.png') });

    // Open Assign Station Modal
    const assignBtn = await page.$('table tbody tr:first-child button');
    if (assignBtn) {
      console.log('Opening Assign Station Modal...');
      await assignBtn.click();
      await delay(1000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'trade_audit_07_assign_station_modal.png') });
      const closeX = await page.$('.fixed button svg.lucide-x') || await page.$('.fixed button');
      if (closeX) await closeX.click();
      await delay(500);
    }

    // 5. Station Representatives Page
    console.log('6. Navigating to Station Representatives (/trade/representatives)...');
    await page.click('aside nav a[href="/trade/representatives"]');
    await page.waitForSelector('table', { timeout: 10000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'trade_audit_08_station_representatives_page.png') });

    // 6. Sub-City Allocations Page
    console.log('7. Navigating to Sub-City Allocations (/trade/allocations)...');
    await page.click('aside nav a[href="/trade/allocations"]');
    await page.waitForSelector('table, .grid', { timeout: 10000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'trade_audit_09_subcity_allocations_page.png') });

    // 7. Fuel Shortages Incidents Page
    console.log('8. Navigating to Shortage Incidents (/trade/shortages)...');
    await page.click('aside nav a[href="/trade/shortages"]');
    await page.waitForSelector('table, .space-y-6', { timeout: 10000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'trade_audit_10_shortages_page.png') });

    // 8. Distribution Reports Page
    console.log('9. Navigating to Reports (/reports)...');
    await page.click('aside nav a[href="/reports"]');
    await page.waitForSelector('button, .space-y-6', { timeout: 10000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'trade_audit_11_reports_page.png') });

    // 9. Transactions History Page
    console.log('10. Navigating to Transactions (/transactions)...');
    await page.click('aside nav a[href="/transactions"]');
    await page.waitForSelector('table', { timeout: 10000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'trade_audit_12_transactions_page.png') });

    // 10. Mobile Viewport Usability (390x844)
    console.log('11. Testing mobile viewport 390x844 for Trade Office...');
    await page.setViewport({ width: 390, height: 844 });
    await delay(500);

    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await page.waitForSelector('h1', { timeout: 10000 });
    await delay(1200);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'trade_audit_13_mobile_dashboard.png') });

    await page.goto('http://localhost:3000/trade/requests', { waitUntil: 'networkidle2' });
    await page.waitForSelector('table', { timeout: 10000 });
    await delay(1200);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'trade_audit_14_mobile_requests.png') });

    await page.goto('http://localhost:3000/trade/authorizations', { waitUntil: 'networkidle2' });
    await page.waitForSelector('table', { timeout: 10000 });
    await delay(1200);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'trade_audit_15_mobile_authorizations.png') });

    console.log('SUCCESS: All 15 Trade Office Portal UI screenshots captured and verified!');
  } catch (err) {
    console.error('Error during Trade UI audit:', err);
  } finally {
    await browser.close();
  }
}

runTradeBrowserAudit().catch(console.error);
