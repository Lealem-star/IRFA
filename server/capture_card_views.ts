import puppeteer, { Browser, Page } from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:/Users/1234/.gemini/antigravity/brain/cd1b2618-018f-4d4d-a1a5-e15c803d4780';

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

async function loginAsAgri(page: Page) {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#username-input', { timeout: 5000 });
  await page.click('#username-input', { clickCount: 3 });
  await page.type('#username-input', 'agriculture');
  await page.click('#password-input', { clickCount: 3 });
  await page.type('#password-input', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => window.location.pathname.includes('/dashboard'), { timeout: 6000 });
}

async function run() {
  console.log('=== Capturing Official Farmer Digital ID Card Views ===\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', (msg) => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', (err) => console.error(`[Browser PageError] ${err.message}`));

  try {
    // 1. Log in as Agriculture Office
    await loginAsAgri(page);
    console.log('1. Logged in as Agriculture Office');

    // 2. Navigate to Farmer Cards page
    await page.goto(`${APP_URL}/cards`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 8000 });
    console.log('2. Navigated to Farmer Cards Registry (/cards) with records loaded');

    // 3. Open Single Card Modal
    const buttons = await page.$$('button');
    let viewBtnFound = false;
    for (const b of buttons) {
      const txt = await page.evaluate((el) => el.textContent, b);
      if (txt && txt.includes('View Card')) {
        await b.click();
        viewBtnFound = true;
        break;
      }
    }
    console.log(`Found and clicked View Card button: ${viewBtnFound}`);
    await page.waitForSelector('#printable-card', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 1000));
    console.log(`Found and clicked View Card button: ${viewBtnFound}`);
    await page.waitForSelector('#printable-card', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 1000));

    // 4. Capture Front View
    await clickByText(page, 'button', 'Front');
    await new Promise((r) => setTimeout(r, 600));
    const frontEl = await page.$('.farmer-id-card-front');
    if (frontEl) {
      const frontPath = `${ARTIFACT_DIR}/card-front-view.png`;
      await frontEl.screenshot({ path: frontPath });
      console.log(`Saved Front Card screenshot: ${frontPath}`);
    }

    // 5. Capture Back View
    await clickByText(page, 'button', 'Back');
    await new Promise((r) => setTimeout(r, 600));
    const backEl = await page.$('.farmer-id-card-back');
    if (backEl) {
      const backPath = `${ARTIFACT_DIR}/card-back-view.png`;
      await backEl.screenshot({ path: backPath });
      console.log(`Saved Back Card screenshot: ${backPath}`);
    }

    // 6. Capture Both Sides Modal Preview
    await clickByText(page, 'button', 'Both Sides');
    await new Promise((r) => setTimeout(r, 600));
    const modalPath = `${ARTIFACT_DIR}/card-modal-preview.png`;
    await page.screenshot({ path: modalPath });
    console.log(`Saved Full Card Modal screenshot: ${modalPath}`);

    // Close Single Card Modal
    await clickByText(page, 'button', 'Close');
    await new Promise((r) => setTimeout(r, 500));

    // 7. Open A4 Batch Print Modal & Capture Sheet Preview
    await clickByText(page, 'button', 'A4 Batch Print');
    await page.waitForSelector('#printable-batch-sheet', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 1000));
    const batchPath = `${ARTIFACT_DIR}/card-a4-batch-preview.png`;
    await page.screenshot({ path: batchPath });
    console.log(`Saved A4 Batch Sheet screenshot: ${batchPath}`);

    // Close Batch Modal
    await clickByText(page, 'button', 'Cancel');
    await new Promise((r) => setTimeout(r, 500));

    // 8. Test Farmer Registration with Photo Upload
    await page.goto(`${APP_URL}/farmers`, { waitUntil: 'networkidle2' });
    await clickByText(page, 'button', 'Register Farmer');
    await page.waitForSelector('input[placeholder="e.g. Abebe Tesfaye"]', { timeout: 4000 });

    const newFarmerName = `Tadesse Assefa ${Date.now().toString().slice(-4)}`;
    await page.type('input[placeholder="e.g. Abebe Tesfaye"]', newFarmerName);
    await page.type('input[placeholder="+251 918 000 000"]', '+251 918 444 333');
    await page.type('input[placeholder="ETH-BD-2026-..."]', `ETH-BD-2026-${Date.now().toString().slice(-4)}`);

    // Create a mock passport photo buffer and upload
    const testPhotoPath = path.resolve('test-passport-photo.jpg');
    // Simple 100x120 dummy JPEG buffer
    const minimalJpg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
      0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
      0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x10,
      0x00, 0x10, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
      0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0xbf, 0x00, 0xff, 0xd9,
    ]);
    fs.writeFileSync(testPhotoPath, minimalJpg);

    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.uploadFile(testPhotoPath);
      await new Promise((r) => setTimeout(r, 600));
      console.log('3. Attached test photo in registration modal');
    }

    await clickByText(page, 'button', 'Save & Issue QR Card');
    await new Promise((r) => setTimeout(r, 2000));

    // Verify newly registered farmer appears
    const createdWithPhoto = await page.evaluate((name) => document.body.innerText.includes(name), newFarmerName);
    console.log(`4. Registered farmer with photo "${newFarmerName}": ${createdWithPhoto ? 'SUCCESS' : 'FAILED'}`);

    if (fs.existsSync(testPhotoPath)) fs.unlinkSync(testPhotoPath);

    console.log('\n=== All Views Captured Successfully ===');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
