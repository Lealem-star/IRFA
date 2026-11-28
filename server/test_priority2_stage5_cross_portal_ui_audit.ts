import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\1234\\.gemini\\antigravity\\brain\\cd1b2618-018f-4d4d-a1a5-e15c803d4780';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loginAs(page: any, username: string, pass = 'demo123') {
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
  await delay(800);
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
  await delay(800);

  await page.type('input[placeholder*="username" i], input[type="text"]', username);
  await page.type('input[type="password"]', pass);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
  ]);
  await delay(2000);
}

async function runCrossPortalUIAudit() {
  console.log('Starting Puppeteer Cross-Portal UI Functional Audit...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();

  try {
    // -------------------------------------------------------------
    // 1. DESKTOP LOGIN SCREEN
    // -------------------------------------------------------------
    console.log('\n--- 1. Shared Login & Branding (Desktop 1366x850) ---');
    await page.setViewport({ width: 1366, height: 850 });
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await delay(1200);

    console.log('Capturing Screenshot 01: Shared Login Screen...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shared_audit_01_desktop_login.png'),
      fullPage: false,
    });

    // -------------------------------------------------------------
    // 2. AGRICULTURE DASHBOARD (DESKTOP)
    // -------------------------------------------------------------
    console.log('\n--- 2. Agriculture Office Dashboard (Desktop) ---');
    await loginAs(page, 'agriculture');
    console.log('Capturing Screenshot 02: Agriculture Dashboard...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shared_audit_02_desktop_agri_dashboard.png'),
      fullPage: false,
    });

    // Open User Profile Modal on Agriculture
    console.log('Opening Shared User Profile Modal...');
    await page.evaluate(() => {
      const btn = document.querySelector('button[title*="profile" i]') as HTMLElement;
      if (btn) btn.click();
    });
    await delay(1000);

    console.log('Capturing Screenshot 06: Shared Profile Modal...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shared_audit_06_profile_modal.png'),
      fullPage: false,
    });

    // Close Profile Modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button:has(svg.lucide-x)') as HTMLElement;
      if (closeBtn) closeBtn.click();
    });
    await delay(500);

    // -------------------------------------------------------------
    // 3. TRADE DASHBOARD (DESKTOP)
    // -------------------------------------------------------------
    console.log('\n--- 3. Trade Office Dashboard (Desktop) ---');
    await loginAs(page, 'trade');
    console.log('Capturing Screenshot 03: Trade Dashboard...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shared_audit_03_desktop_trade_dashboard.png'),
      fullPage: false,
    });

    // -------------------------------------------------------------
    // 4. FUEL STATION DASHBOARD (DESKTOP)
    // -------------------------------------------------------------
    console.log('\n--- 4. Fuel Station Dashboard (Desktop) ---');
    await loginAs(page, 'station');
    console.log('Capturing Screenshot 04: Fuel Station Dashboard...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shared_audit_04_desktop_station_dashboard.png'),
      fullPage: false,
    });

    // -------------------------------------------------------------
    // 5. SYSTEM ADMIN DASHBOARD (DESKTOP)
    // -------------------------------------------------------------
    console.log('\n--- 5. System Administration Dashboard (Desktop) ---');
    await loginAs(page, 'admin');
    console.log('Capturing Screenshot 05: System Admin Dashboard...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shared_audit_05_desktop_sysadmin_dashboard.png'),
      fullPage: false,
    });

    // -------------------------------------------------------------
    // 6. MOBILE NAVIGATION DRAWERS (390x844)
    // -------------------------------------------------------------
    console.log('\n--- 6. Mobile Navigation Drawers (390x844) ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    // 6A. Agriculture Mobile Drawer
    await loginAs(page, 'agriculture');
    await delay(1000);
    console.log('Opening Agriculture Mobile Menu Drawer...');
    await page.evaluate(() => {
      const moreBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('More'));
      if (moreBtn) moreBtn.click();
    });
    await delay(800);
    console.log('Capturing Screenshot 07: Agriculture Mobile Drawer...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shared_audit_07_mobile_drawer_agri.png'),
      fullPage: false,
    });

    // 6B. Trade Mobile Drawer
    await loginAs(page, 'trade');
    await delay(1000);
    console.log('Opening Trade Mobile Menu Drawer...');
    await page.evaluate(() => {
      const moreBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('More'));
      if (moreBtn) moreBtn.click();
    });
    await delay(800);
    console.log('Capturing Screenshot 08: Trade Mobile Drawer...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shared_audit_08_mobile_drawer_trade.png'),
      fullPage: false,
    });

    // 6C. Station Mobile Drawer
    await loginAs(page, 'station');
    await delay(1000);
    console.log('Opening Station Mobile Menu Drawer (revealing P2-S5-BUG-01)...');
    await page.evaluate(() => {
      // In station bottom nav, there is no more button on bottom nav, but there may be topbar or other navigation
      // Check topbar or evaluate opening drawer directly
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('More') || b.querySelector('svg.lucide-menu'));
      if (btn) btn.click();
    });
    await delay(800);
    console.log('Capturing Screenshot 09: Station Mobile Drawer...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shared_audit_09_mobile_drawer_station.png'),
      fullPage: false,
    });

    // 6D. System Admin Mobile Drawer
    await loginAs(page, 'admin');
    await delay(1000);
    console.log('Opening System Admin Mobile Menu Drawer...');
    await page.evaluate(() => {
      const moreBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('More'));
      if (moreBtn) moreBtn.click();
    });
    await delay(800);
    console.log('Capturing Screenshot 10: System Admin Mobile Drawer...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shared_audit_10_mobile_drawer_sysadmin.png'),
      fullPage: false,
    });

    // -------------------------------------------------------------
    // 7. PRINTABLE A4 BATCH CARD PREVIEW
    // -------------------------------------------------------------
    console.log('\n--- 7. Printable Farmer Card Preview (Desktop 1366x850) ---');
    await page.setViewport({ width: 1366, height: 850 });
    await loginAs(page, 'agriculture');
    console.log('Navigating to Farmer Cards Page: http://localhost:3000/cards');
    await page.goto('http://localhost:3000/cards', { waitUntil: 'networkidle2' });
    await delay(2500);

    console.log('Capturing Screenshot 11: Printable Card Preview...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shared_audit_11_print_card_preview.png'),
      fullPage: false,
    });

    console.log('\nCross-Portal UI Functional Audit completed successfully!');
  } catch (err: any) {
    console.error('Puppeteer Cross-Portal UI Audit Error:', err);
  } finally {
    await browser.close();
  }
}

runCrossPortalUIAudit();
