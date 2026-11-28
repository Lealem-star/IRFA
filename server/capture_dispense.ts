import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\1234\\.gemini\\antigravity\\brain\\cd1b2618-018f-4d4d-a1a5-e15c803d4780';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function captureViews() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 850 });
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="text"]', 'station');
  await page.type('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('aside nav a[href="/scanner"]', { timeout: 15000 });
  await page.click('aside nav a[href="/scanner"]');
  await delay(2000);

  // 1. Open manual modal
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const txt = await b.evaluate((el) => el.textContent || '');
    if (txt.includes('Enter Farmer ID Manually') || txt.includes('Enter ID Manually')) {
      console.log('Clicking manual entry button:', txt);
      await b.click();
      break;
    }
  }
  await delay(1000);

  // 2. Type farmer code for Farmer P1T2 S9
  const input = await page.$('.fixed input[type="text"]');
  if (input) {
    await input.type('FR-P1T2-S9-6698');
    await delay(500);
    const submitBtn = await page.$('.fixed button[type="submit"]');
    await submitBtn?.click();
    console.log('Submitted verification modal, waiting for verification to complete...');

    // Wait until Verifying HUD is gone
    await page.waitForFunction(
      () => !document.body.innerText.includes('Verifying Farmer Identity & Quota...'),
      { timeout: 20000 }
    );
    await delay(1000);

    // Save authorized view
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_04_authorized_view.png') });
    console.log('Saved station_audit_04_authorized_view.png');

    // Click CONTINUE TO DISPENSING
    const authButtons = await page.$$('button');
    for (const b of authButtons) {
      const txt = await b.evaluate((el) => el.textContent || '');
      if (txt.toUpperCase().includes('CONTINUE TO DISPENSING') || txt.toUpperCase().includes('DISPENSING')) {
        console.log('Clicking CONTINUE TO DISPENSING...');
        await b.click();
        await delay(1500);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_05_dispense_view.png') });
        console.log('Saved station_audit_05_dispense_view.png');

        // Switch to mobile viewport
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        await delay(1000);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_12_mobile_dispense.png') });
        console.log('Saved station_audit_12_mobile_dispense.png');
        break;
      }
    }
  }

  // 3. Capture Rejected View with out-of-subcity farmer FR-00125
  await page.setViewport({ width: 1366, height: 850 });
  await page.goto('http://localhost:3000/scanner', { waitUntil: 'networkidle2' });
  await delay(2000);

  const buttons2 = await page.$$('button');
  for (const b of buttons2) {
    const txt = await b.evaluate((el) => el.textContent || '');
    if (txt.includes('Enter Farmer ID Manually') || txt.includes('Enter ID Manually')) {
      await b.click();
      break;
    }
  }
  await delay(1000);

  const input2 = await page.$('.fixed input[type="text"]');
  if (input2) {
    await input2.type('FR-00125');
    await delay(500);
    const submitBtn2 = await page.$('.fixed button[type="submit"]');
    await submitBtn2?.click();
    console.log('Submitted FR-00125, waiting for rejection view...');

    await page.waitForFunction(
      () => !document.body.innerText.includes('Verifying Farmer Identity & Quota...'),
      { timeout: 20000 }
    );
    await delay(1000);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_06_rejected_view.png') });
    console.log('Saved station_audit_06_rejected_view.png');
  }

  await browser.close();
  console.log('Done capturing views!');
}

captureViews().catch(console.error);
