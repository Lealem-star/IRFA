import { Response, NextFunction } from 'express';
import { verifyToken } from '../config/jwt.js';
import { AuthenticatedRequest, AuthenticatedUser } from '../types/auth.js';
import prisma from '../config/db.js';

export const authenticateJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Check Authorization header, query parameter (for media/images), or cookie
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query && typeof req.query.token === 'string') {
      token = req.query.token;
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
      return;
    }

    const payload = verifyToken(token);

    // Verify user is still active in database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        office: true,
        fuelStation: true,
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: 'Account is deactivated or not found.' });
      return;
    }

    req.user = {
      userId: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      officeId: user.officeId,
      fuelStationId: user.fuelStationId,
      officeType: user.office?.type || null,
      fuelStationCode: user.fuelStation?.code || null,
    };

    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired session. Please sign in again.' });
    return;
  }
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Access requires ${allowedRoles.join(' or ')} permission.`,
      });
      return;
    }

    next();
  };
};

export const requireStationScope = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  if (req.user.role !== 'STATION_ADMIN' || !req.user.fuelStationId) {
    res.status(403).json({
      success: false,
      message: 'Forbidden: User is not assigned to an active fuel station.',
    });
    return;
  }

  next();
};

export const disallowAdminOperational = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user && req.user.role === 'SYSTEM_ADMIN') {
    res.status(403).json({
      success: false,
      message: 'Forbidden: System Administrator has technical configuration access only and is prohibited from operational workflows.',
    });
    return;
  }
  next();
};
