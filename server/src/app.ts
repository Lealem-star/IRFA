import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Cross-Origin Resource Sharing
const configuredOrigins: string[] = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((u: string) => u.trim())
  : [];

const allowedOrigins: string[] = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...configuredOrigins,
];

app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes('*') ||
        origin.endsWith('.onrender.com') ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// Core Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static File Serving for Uploaded Photos
const uploadsPath = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath, {
  dotfiles: 'ignore',
  index: false,
  maxAge: '1d',
}));

// Base Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    system: 'Digital Fuel Coupon System — Bahir Dar City Administration Office of Agriculture',
    administration: 'Bahir Dar City Administration Office of Agriculture (የባሕር ዳር ከተማ አስተዳደር ግብርና መምሪያ)',
    timestamp: new Date().toISOString(),
  });
});

// Mount modular API routes
app.use('/api', routes);

// Centralized error handling
app.use(errorHandler);

export default app;
