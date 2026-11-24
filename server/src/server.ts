import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import prisma from './config/db.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Validate database connectivity
    await prisma.$connect();
    console.log('Connected to MySQL / MariaDB (irfa_db) successfully.');

    app.listen(PORT, () => {
      console.log(`Digital Fuel Coupon System Server is running at http://localhost:${PORT}`);
      console.log(`Target: Bahir Dar City Administration Office of Agriculture (የባሕር ዳር ከተማ አስተዳደር ግብርና መምሪያ), Ethiopia`);
    });
  } catch (err) {
    console.error('Failed to initialize server or database connection:', err);
    process.exit(1);
  }
}

startServer();
