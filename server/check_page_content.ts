import puppeteer from 'puppeteer-core';

async function check() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/login');
  await page.type('input[type="text"]', 'station');
  await page.type('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  await page.goto('http://localhost:3000/scanner', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  // Open manual modal
  const manualBtn = await page.$('button[aria-label="Manual Entry"]') || (await page.$$('button'))[0];
  await manualBtn?.click();
  await new Promise(r => setTimeout(r, 800));

  const input = await page.$('.fixed input[type="text"]');
  await input?.type('FR-P1T2-S9-6698');
  const submit = await page.$('.fixed button[type="submit"]');
  await submit?.click();
  await new Promise(r => setTimeout(r, 2000));

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent?.trim(),
      className: b.className,
      disabled: b.disabled
    }));
  });
  console.log('BUTTONS FOUND:', JSON.stringify(buttons, null, 2));

  await browser.close();
}
check().catch(console.error);
