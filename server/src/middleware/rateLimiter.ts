import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
}

// In-memory store for tracking IP attempts
const loginAttempts = new Map<string, RateLimitRecord>();

// Configurable constants
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_ATTEMPTS = 10; // 10 attempts per 15 minutes

/**
 * Cleanup expired entries every 10 minutes to prevent memory growth
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of loginAttempts.entries()) {
    if (now - record.firstAttemptAt > DEFAULT_WINDOW_MS) {
      loginAttempts.delete(key);
    }
  }
}, 10 * 60 * 1000).unref(); // unref so timer doesn't prevent process exit

/**
 * Login Rate Limiting Middleware (SEC-03)
 * Protects POST /api/auth/login against brute-force and credential stuffing.
 */
export const loginRateLimiter = (
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  windowMs: number = DEFAULT_WINDOW_MS
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Determine client IP safely
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.socket.remoteAddress || req.ip || 'unknown-ip'
    );

    const now = Date.now();
    const record = loginAttempts.get(ip);

    if (!record) {
      // First attempt in window
      loginAttempts.set(ip, {
        count: 1,
        firstAttemptAt: now,
        lastAttemptAt: now,
      });
      return next();
    }

    // Check if current window has expired
    if (now - record.firstAttemptAt > windowMs) {
      // Reset window
      loginAttempts.set(ip, {
        count: 1,
        firstAttemptAt: now,
        lastAttemptAt: now,
      });
      return next();
    }

    // Still within active window
    record.count += 1;
    record.lastAttemptAt = now;

    if (record.count > maxAttempts) {
      const remainingMs = Math.max(0, windowMs - (now - record.firstAttemptAt));
      const retryAfterSeconds = Math.ceil(remainingMs / 1000);

      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', maxAttempts);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil((record.firstAttemptAt + windowMs) / 1000));

      console.warn(`[SECURITY] Login rate limit exceeded for IP: ${ip} (${record.count} attempts)`);

      res.status(429).json({
        success: false,
        message: 'Too many login attempts. Please try again in 15 minutes.',
        retryAfterSeconds,
      });
      return;
    }

    res.setHeader('X-RateLimit-Limit', maxAttempts);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxAttempts - record.count));

    next();
  };
};

/**
 * Utility to clear the rate limiter cache (useful for automated testing)
 */
export const resetLoginRateLimiter = (): void => {
  loginAttempts.clear();
};
