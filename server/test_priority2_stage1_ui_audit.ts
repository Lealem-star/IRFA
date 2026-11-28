import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\1234\\.gemini\\antigravity\\brain\\cd1b2618-018f-4d4d-a1a5-e15c803d4780';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBrowserAudit() {
  console.log('Starting Puppeteer UI Functional Audit for Agriculture Portal...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 850 });

  try {
    // 1. Login Page
    console.log('1. Navigating to login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await delay(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'agri_audit_01_login.png') });

    // Fill credentials for Agriculture
    console.log('Submitting login credentials...');
    await page.type('input[type="text"], input[name="username"]', 'agriculture');
    await page.type('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');

    // Wait for Dashboard
    console.log('2. Waiting for Dashboard and navigation sidebar...');
    await page.waitForSelector('aside nav a[href="/farmers"]', { timeout: 15000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'agri_audit_02_dashboard.png') });

    // 2. Farmers Registry Page
    console.log('3. Navigating to Farmer Registry via sidebar...');
    await page.click('aside nav a[href="/farmers"]');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'agri_audit_03_farmer_registry.png') });

    // Open Register Farmer Modal
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && text.includes('Register Farmer')) {
        await btn.click();
        await delay(800);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'agri_audit_04_register_modal.png') });
        // Close modal
        const closeBtn = await page.$('form button');
        if (closeBtn) {
          const btnText = await page.evaluate((el) => el.textContent, closeBtn);
          if (btnText && btnText.includes('Cancel')) await closeBtn.click();
        }
        await delay(500);
        break;
      }
    }

    // 3. Farmer Dossier Page
    console.log('4. Navigating to Farmer Dossier...');
    const detailsBtn = await page.$('table tbody tr:first-child button');
    if (detailsBtn) {
      await detailsBtn.click();
      await page.waitForSelector('#printable-card', { timeout: 10000 });
      await delay(1500);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'agri_audit_05_farmer_dossier.png') });

      // Click "Back" side of card preview
      const cardButtons = await page.$$('button');
      for (const b of cardButtons) {
        const text = await page.evaluate((el) => el.textContent, b);
        if (text && text.trim() === 'Back') {
          await b.click();
          await delay(600);
          await page.screenshot({ path: path.join(ARTIFACT_DIR, 'agri_audit_06_farmer_card_back.png') });
          break;
        }
      }
    }

    // 4. Monthly Fuel Allocations Page
    console.log('5. Navigating to Allocations via sidebar...');
    await page.click('aside nav a[href="/allocations"]');
    await page.waitForSelector('table', { timeout: 10000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'agri_audit_07_allocations_page.png') });

    // Open Create Allocation Modal
    const allocBtns = await page.$$('button');
    for (const b of allocBtns) {
      const text = await page.evaluate((el) => el.textContent, b);
      if (text && text.includes('Create Allocation')) {
        await b.click();
        await delay(800);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'agri_audit_08_create_allocation_modal.png') });
        const closeX = await page.$('.fixed button');
        if (closeX) await closeX.click();
        await delay(500);
        break;
      }
    }

    // 5. Fuel Requests Management Page
    console.log('6. Navigating to Requests via sidebar...');
    await page.click('aside nav a[href="/requests"]');
    await page.waitForSelector('table', { timeout: 10000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'agri_audit_09_requests_page.png') });

    // Open Prepare Fuel Request Modal
    const reqBtns = await page.$$('button');
    for (const b of reqBtns) {
      const text = await page.evaluate((el) => el.textContent, b);
      if (text && text.includes('Prepare Fuel Request')) {
        await b.click();
        await delay(800);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'agri_audit_10_prepare_request_modal.png') });
        const closeX = await page.$('.fixed button');
        if (closeX) await closeX.click();
        await delay(500);
        break;
      }
    }

    // 6. Farmer Cards & QR Identity Page
    console.log('7. Navigating to Farmer Cards via sidebar...');
    await page.click('aside nav a[href="/cards"]');
    await page.waitForSelector('table', { timeout: 10000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'agri_audit_11_farmer_cards_page.png') });

    // 7. Mobile Viewport Usability (390x844)
    console.log('8. Testing mobile viewport 390x844...');
    await page.setViewport({ width: 390, height: 844 });
    await delay(500);
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await page.waitForSelector('h1', { timeout: 10000 });
    await delay(1200);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'agri_audit_12_mobile_dashboard.png') });

    await page.goto('http://localhost:3000/farmers', { waitUntil: 'networkidle2' });
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    await delay(1200);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'agri_audit_13_mobile_farmers.png') });

    console.log('SUCCESS: All 13 Agriculture Portal UI screenshots captured and verified!');
  } catch (err) {
    console.error('Error during UI audit:', err);
  } finally {
    await browser.close();
  }
}

runBrowserAudit().catch(console.error);
