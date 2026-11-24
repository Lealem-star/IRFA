import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
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
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    system: 'IRFA — Irrigation Resource & Fuel Authorization System',
    administration: 'Bahir Dar Agriculture Directorate (ባህርዳር ግብርና መምሪያ)',
    timestamp: new Date().toISOString(),
  });
});

// Mount modular API routes
app.use('/api', routes);

// Centralized error handling
app.use(errorHandler);

export default app;
