import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Cross-Origin Resource Sharing (SEC-02 Remediated)
const configuredOrigins: string[] = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',')
      .map((u: string) => u.trim().replace(/\/+$/, ''))
      .filter(Boolean)
  : [];

const isProduction = process.env.NODE_ENV === 'production';

const developmentOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const allowedOrigins: string[] = isProduction
  ? configuredOrigins
  : Array.from(new Set([...developmentOrigins, ...configuredOrigins]));

app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/+$/, '');

      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      // In non-production only, permit preview deployments
      if (!isProduction) {
        if (normalizedOrigin.endsWith('.onrender.com') || normalizedOrigin.endsWith('.vercel.app')) {
          return callback(null, true);
        }
      }

      // Strict fail-closed policy for unapproved origins
      const corsError = new Error(`CORS blocked: Origin ${origin} is not allowed by security policy.`);
      (corsError as any).status = 403;
      (corsError as any).statusCode = 403;
      return callback(corsError, false);
    },
    credentials: true,
  })
);

// Core Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static File Serving for Public Avatars ONLY (SEC-04 Remediated)
// Sensitive farmer photographs are strictly blocked from public static access
// and are served exclusively via authenticated /api/farmers/... endpoints
const getAvatarsPath = (): string => {
  const candidates = [
    path.resolve(process.cwd(), 'uploads/avatars'),
    path.resolve(process.cwd(), 'server/uploads/avatars'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
};

const avatarsPath = getAvatarsPath();
if (!fs.existsSync(avatarsPath)) {
  fs.mkdirSync(avatarsPath, { recursive: true });
}

app.use('/uploads/avatars', express.static(avatarsPath, {
  dotfiles: 'ignore',
  index: false,
  maxAge: '1d',
}));

// Explicitly reject direct public requests to farmer uploads
app.use('/uploads/farmers', (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Direct public access to farmer photographs is strictly prohibited.',
  });
});

// Explicitly reject any other direct public requests to uploads root
app.use('/uploads', (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Direct public access to the uploads directory is prohibited.',
  });
});

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
