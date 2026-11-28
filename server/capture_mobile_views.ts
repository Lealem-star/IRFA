import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\1234\\.gemini\\antigravity\\brain\\cd1b2618-018f-4d4d-a1a5-e15c803d4780';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function captureMobile() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="text"]', 'station');
  await page.type('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');

  // Wait for dashboard to load
  await page.waitForFunction(() => !document.body.innerText.includes('Connecting to Digital Fuel Coupon System...'), { timeout: 15000 });
  await delay(2000);

  // Navigate to scanner
  await page.goto('http://localhost:3000/scanner', { waitUntil: 'networkidle2' });
  await delay(2000);

  // Open manual modal
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const txt = await b.evaluate((el) => el.textContent || '');
    if (txt.includes('Enter Farmer ID Manually') || txt.includes('Enter ID Manually')) {
      await b.click();
      break;
    }
  }
  await delay(1000);

  const input = await page.$('.fixed input[type="text"]');
  if (input) {
    await input.type('FR-P1T2-S9-6698');
    await delay(500);
    const submitBtn = await page.$('.fixed button[type="submit"]');
    await submitBtn?.click();

    // Wait until verification finishes
    await page.waitForFunction(() => !document.body.innerText.includes('Verifying Farmer Identity & Quota...'), { timeout: 20000 });
    await delay(1500);

    // Save Mobile Authorized View
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_11_mobile_authorized.png') });
    console.log('Saved station_audit_11_mobile_authorized.png');

    // Click CONTINUE TO DISPENSING
    const authButtons = await page.$$('button');
    for (const b of authButtons) {
      const txt = await b.evaluate((el) => el.textContent || '');
      if (txt.toUpperCase().includes('CONTINUE TO DISPENSING') || txt.toUpperCase().includes('DISPENSING')) {
        await b.click();
        await delay(1500);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_12_mobile_dispense.png') });
        console.log('Saved station_audit_12_mobile_dispense.png');
        break;
      }
    }
  }

  await browser.close();
  console.log('Done mobile capture!');
}

captureMobile().catch(console.error);
