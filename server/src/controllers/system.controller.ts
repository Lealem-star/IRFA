import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { createUserSchema, updateUserSchema } from '../validators/auth.validator.js';
import { logAudit } from '../middleware/audit.js';
import { UserRole } from '@prisma/client';

export const listUsers = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        officeId: true,
        office: { select: { id: true, name: true, code: true } },
        fuelStationId: true,
        fuelStation: { select: { id: true, name: true, code: true } },
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve users', error });
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = createUserSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: data.username.toLowerCase().trim() },
          ...(data.email ? [{ email: data.email.toLowerCase().trim() }] : []),
        ],
      },
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'Username or email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const newUser = await prisma.user.create({
      data: {
        username: data.username.toLowerCase().trim(),
        email: data.email ? data.email.toLowerCase().trim() : null,
        passwordHash,
        fullName: data.fullName,
        role: data.role as UserRole,
        officeId: data.officeId || null,
        fuelStationId: data.fuelStationId || null,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'CREATE_USER',
      entityType: 'User',
      entityId: newUser.id,
      details: { username: newUser.username, role: newUser.role },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create user', error });
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        fullName: data.fullName,
        email: data.email || null,
        role: data.role as UserRole,
        officeId: data.officeId || null,
        fuelStationId: data.fuelStationId || null,
        isActive: data.isActive !== undefined ? data.isActive : user.isActive,
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'UPDATE_USER',
      entityType: 'User',
      entityId: id,
      details: { changes: data },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'User updated successfully', user: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user', error });
  }
};

export const resetUserPassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'ADMIN_RESET_PASSWORD',
      entityType: 'User',
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reset password', error });
  }
};

export const listSettings = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve settings', error });
  }
};

export const updateSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { settings } = req.body; // array of { key, value }

    if (!Array.isArray(settings)) {
      res.status(400).json({ success: false, message: 'Settings array required' });
      return;
    }

    for (const item of settings) {
      await prisma.systemSetting.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value, category: 'GENERAL' },
      });
    }

    await logAudit({
      userId: req.user?.userId,
      action: 'UPDATE_SYSTEM_SETTINGS',
      entityType: 'SystemSetting',
      details: { updatedKeys: settings.map((s) => s.key) },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update settings', error });
  }
};

export const getSystemHealth = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Ping DB
    await prisma.$queryRaw`SELECT 1`;

    const [userCount, farmerCount, reqCount, txCount] = await Promise.all([
      prisma.user.count(),
      prisma.farmer.count(),
      prisma.fuelRequest.count(),
      prisma.fuelTransaction.count(),
    ]);

    res.json({
      success: true,
      health: {
        application: 'Operational',
        database: 'Connected (MySQL / MariaDB)',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        counts: {
          users: userCount,
          farmers: farmerCount,
          fuelRequests: reqCount,
          transactions: txCount,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      health: {
        application: 'Degraded',
        database: 'Connection Failure',
        error: String(error),
      },
    });
  }
};

export const listAuditLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { action, entityType, page = '1', limit = '25' } = req.query;

    const where: any = {};
    if (action) where.action = { contains: action as string };
    if (entityType) where.entityType = entityType as string;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        include: {
          user: {
            select: { id: true, username: true, fullName: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve audit logs', error });
  }
};
