import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:5173';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 850 });
  await page.goto(APP_URL, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));

  const outDir = 'c:/Users/1234/Desktop/IRFA/client/public/branding';
  const outPath = `${outDir}/login-preview.png`;
  await page.screenshot({ path: outPath });

  // Also copy to artifact directory
  const artifactDir = 'C:/Users/1234/.gemini/antigravity/brain/cd1b2618-018f-4d4d-a1a5-e15c803d4780';
  fs.copyFileSync(outPath, `${artifactDir}/login-preview.png`);

  console.log(`Screenshot successfully captured to ${outPath} and ${artifactDir}/login-preview.png`);
  await browser.close();
}

capture().catch(console.error);
