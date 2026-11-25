import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import prisma from './config/db.js';

const PORT = process.env.PORT || 5000;

async function connectWithRetry(retries = 5, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Connecting to database (attempt ${attempt}/${retries})...`);
      await prisma.$connect();
      console.log('Connected to database (TiDB / MySQL) successfully.');
      return;
    } catch (err: any) {
      console.warn(`Database connection attempt ${attempt} failed: ${err.message || err}`);
      if (attempt < retries) {
        console.log(`Waiting ${delayMs / 1000}s for database to wake up before retry...`);
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
}

async function startServer() {
  try {
    // Validate database connectivity with resilient retry (handles TiDB serverless wake-up)
    await connectWithRetry(5, 3000);

    app.listen(PORT, () => {
      console.log(`Digital Fuel Coupon System Server is running at http://localhost:${PORT}`);
      console.log(`Target: Bahir Dar City Administration Office of Agriculture (የባሕር ዳር ከተማ አስተዳደር ግብርና መምሪያ), Ethiopia`);
    });
  } catch (err) {
    console.error('Failed to initialize server or database connection after retries:', err);
    process.exit(1);
  }
}

startServer();
