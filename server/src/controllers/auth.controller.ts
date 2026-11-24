import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { signToken } from '../config/jwt.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { loginSchema, changePasswordSchema } from '../validators/auth.validator.js';
import { logAudit } from '../middleware/audit.js';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase().trim() },
          { email: username.toLowerCase().trim() },
        ],
      },
      include: {
        office: true,
        fuelStation: true,
      },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid username or password.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact the administrator.' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({ success: false, message: 'Invalid username or password.' });
      return;
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      officeId: user.officeId,
      fuelStationId: user.fuelStationId,
    });

    // Set secure HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    await logAudit({
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      details: { role: user.role, ip: req.ip },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        office: user.office ? { id: user.office.id, name: user.office.name, code: user.office.code, type: user.office.type } : null,
        fuelStation: user.fuelStation ? { id: user.fuelStation.id, name: user.fuelStation.name, code: user.fuelStation.code } : null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Login failed', error });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        office: true,
        fuelStation: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        office: user.office ? { id: user.office.id, name: user.office.name, code: user.office.code, type: user.office.type } : null,
        fuelStation: user.fuelStation ? { id: user.fuelStation.id, name: user.fuelStation.name, code: user.fuelStation.code } : null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve profile' });
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (req.user) {
    await logAudit({
      userId: req.user.userId,
      action: 'USER_LOGOUT',
      entityType: 'User',
      entityId: req.user.userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  res.clearCookie('token');
  res.json({ success: true, message: 'Signed out successfully' });
};

export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      res.status(400).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    await logAudit({
      userId: user.id,
      action: 'PASSWORD_CHANGE',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update password', error });
  }
};
