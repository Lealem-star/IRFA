import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\1234\\.gemini\\antigravity\\brain\\cd1b2618-018f-4d4d-a1a5-e15c803d4780';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runStationBrowserAudit() {
  console.log('Starting Puppeteer UI Functional Audit for Fuel Station Portal...');
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

    // Clear any existing session in localStorage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await delay(500);

    // Submit Station credentials
    console.log('Submitting credentials for user station...');
    await page.type('input[type="text"], input[name="username"]', 'station');
    await page.type('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');

    // Wait for Dashboard to render
    console.log('2. Waiting for Station Dashboard to load...');
    await page.waitForSelector('aside nav a[href="/scanner"]', { timeout: 15000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_01_dashboard.png') });
    console.log('Saved station_audit_01_dashboard.png');

    // 2. Scanner Page (/scanner)
    console.log('3. Navigating to Scanner Page (/scanner)...');
    await page.click('aside nav a[href="/scanner"]');
    await delay(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_02_scanner_camera.png') });
    console.log('Saved station_audit_02_scanner_camera.png');

    // 3. Open Manual Verification Modal
    console.log('4. Opening Manual Verification Modal...');
    const manualBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent?.toLowerCase().includes('manual') || b.textContent?.toLowerCase().includes('enter') || b.textContent?.toLowerCase().includes('id'));
    });

    if (manualBtn && manualBtn.asElement()) {
      await (manualBtn.asElement() as any).click();
      await delay(1000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_03_manual_modal.png') });
      console.log('Saved station_audit_03_manual_modal.png');

      // 4. Enter Farmer Code (Farmer P1T2 S9: FR-P1T2-S9-6698)
      console.log('5. Entering Farmer Code FR-P1T2-S9-6698...');
      const modalInput = await page.$('.fixed input[type="text"]');
      if (modalInput) {
        await modalInput.type('FR-P1T2-S9-6698');
        await delay(500);

        const submitVerify = await page.$('.fixed button[type="submit"]');
        if (submitVerify) {
          await submitVerify.click();
          console.log('Submitted verification, waiting for Authorized view...');
          await delay(2500);
          await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_04_authorized_view.png') });
          console.log('Saved station_audit_04_authorized_view.png');

          // 5. Click "CONTINUE TO DISPENSING" (case-insensitive)
          console.log('6. Clicking Continue to Dispense...');
          const continueBtn = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(b => b.textContent?.toLowerCase().includes('continue to dispensing') || b.textContent?.toLowerCase().includes('dispens'));
          });
          if (continueBtn && continueBtn.asElement()) {
            await (continueBtn.asElement() as any).click();
            await delay(1500);
            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_05_dispense_view.png') });
            console.log('Saved station_audit_05_dispense_view.png');
          }
        }
      }
    }

    // 6. Test Rejection Screen (Out of Area Farmer: FR-00125)
    console.log('7. Testing Rejection Screen with out-of-area farmer FR-00125...');
    await page.goto('http://localhost:3000/scanner', { waitUntil: 'networkidle2' });
    await delay(1500);
    const manualBtn2 = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent?.toLowerCase().includes('manual') || b.textContent?.toLowerCase().includes('enter'));
    });
    if (manualBtn2 && manualBtn2.asElement()) {
      await (manualBtn2.asElement() as any).click();
      await delay(800);
      const modalInput2 = await page.$('.fixed input[type="text"]');
      if (modalInput2) {
        await modalInput2.type('FR-00125');
        await delay(500);
        const submitVerify2 = await page.$('.fixed button[type="submit"]');
        if (submitVerify2) {
          await submitVerify2.click();
          await delay(2500);
          await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_06_rejected_view.png') });
          console.log('Saved station_audit_06_rejected_view.png');
        }
      }
    }

    // 7. Fuel Transactions Page (/transactions)
    console.log('8. Navigating to Fuel Transactions (/transactions)...');
    await page.goto('http://localhost:3000/transactions', { waitUntil: 'networkidle2' });
    await page.waitForSelector('table', { timeout: 10000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_07_transactions_page.png') });
    console.log('Saved station_audit_07_transactions_page.png');

    // 8. Fuel Shortages Page (/shortages)
    console.log('9. Navigating to Fuel Shortages (/shortages)...');
    await page.goto('http://localhost:3000/shortages', { waitUntil: 'networkidle2' });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_08_shortages_page.png') });
    console.log('Saved station_audit_08_shortages_page.png');

    // =============================================================
    // MOBILE VIEWPORT PASS (390 x 844)
    // =============================================================
    console.log('\n--- STARTING MOBILE VIEWPORT PASS (390 x 844) ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    // 9. Mobile Dashboard
    console.log('10. Mobile Dashboard...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await page.waitForSelector('h1', { timeout: 10000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_09_mobile_dashboard.png') });
    console.log('Saved station_audit_09_mobile_dashboard.png');

    // 10. Mobile Scanner
    console.log('11. Mobile Scanner View...');
    await page.goto('http://localhost:3000/scanner', { waitUntil: 'networkidle2' });
    await delay(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_10_mobile_scanner.png') });
    console.log('Saved station_audit_10_mobile_scanner.png');

    // 11. Mobile Manual Verification -> Authorized View
    console.log('12. Mobile Manual Verification -> Authorized View...');
    const mobileManualBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent?.toLowerCase().includes('manual') || b.textContent?.toLowerCase().includes('enter'));
    });
    if (mobileManualBtn && mobileManualBtn.asElement()) {
      await (mobileManualBtn.asElement() as any).click();
      await delay(800);
      const mobileInput = await page.$('.fixed input[type="text"]');
      if (mobileInput) {
        await mobileInput.type('FR-P1T2-S9-6698');
        await delay(500);
        const mobileSubmit = await page.$('.fixed button[type="submit"]');
        if (mobileSubmit) {
          await mobileSubmit.click();
          await delay(2500);
          await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_11_mobile_authorized.png') });
          console.log('Saved station_audit_11_mobile_authorized.png');

          // Mobile Dispense View
          const mobileContinue = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(b => b.textContent?.toLowerCase().includes('continue to dispensing') || b.textContent?.toLowerCase().includes('dispens'));
          });
          if (mobileContinue && mobileContinue.asElement()) {
            await (mobileContinue.asElement() as any).click();
            await delay(1500);
            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_12_mobile_dispense.png') });
            console.log('Saved station_audit_12_mobile_dispense.png');
          }
        }
      }
    }

    // 12. Mobile Transactions Card List View
    console.log('13. Mobile Transactions Page (/transactions)...');
    await page.goto('http://localhost:3000/transactions', { waitUntil: 'networkidle2' });
    await page.waitForSelector('h1', { timeout: 10000 });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'station_audit_13_mobile_transactions.png') });
    console.log('Saved station_audit_13_mobile_transactions.png');

    console.log('\nPuppeteer UI Functional Audit for Fuel Station Portal completed successfully!');
  } catch (err: any) {
    console.error('Puppeteer UI Audit Error:', err);
  } finally {
    await browser.close();
  }
}

runStationBrowserAudit().catch(console.error);
