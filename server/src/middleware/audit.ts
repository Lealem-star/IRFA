import prisma from '../config/db.js';

export const logAudit = async (params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, any> | string;
  ipAddress?: string;
  userAgent?: string;
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        details: typeof params.details === 'object' ? JSON.stringify(params.details) : params.details || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
};
