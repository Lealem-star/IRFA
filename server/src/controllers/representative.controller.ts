import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import {
  createRepresentativeSchema,
  updateRepresentativeStatusSchema,
  replaceRepresentativeSchema,
  reassignRepresentativeSchema,
  resetRepresentativePasswordSchema,
} from '../validators/representative.validator.js';
import { logAudit } from '../middleware/audit.js';
import { UserRole } from '@prisma/client';

const TX_OPTIONS = {
  maxWait: 10000,
  timeout: 30000,
};

/**
 * List all fuel stations and their station representatives, along with summary metrics.
 */
export const listRepresentatives = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, status } = req.query;

    const stations = await prisma.fuelStation.findMany({
      include: {
        users: {
          where: { role: UserRole.STATION_ADMIN },
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            transactions: true,
            verificationLogs: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    // Compute summary metrics across all 22 stations
    const totalStations = stations.length;
    let stationsWithActiveRep = 0;
    let stationsWithoutRep = 0;
    let totalInactiveReps = 0;

    const formattedStations = stations.map((st) => {
      const activeRep = st.users.find((u) => u.isActive) || null;
      const inactiveReps = st.users.filter((u) => !u.isActive);

      if (activeRep) {
        stationsWithActiveRep++;
      } else {
        stationsWithoutRep++;
      }
      totalInactiveReps += inactiveReps.length;

      return {
        id: st.id,
        code: st.code,
        name: st.name,
        nameAmharic: st.nameAmharic,
        company: st.company,
        location: st.location,
        contactPerson: st.contactPerson,
        phone: st.phone,
        isActive: st.isActive,
        activeRepresentative: activeRep,
        representatives: st.users,
        totalRepresentatives: st.users.length,
        transactionCount: st._count.transactions,
        verificationCount: st._count.verificationLogs,
      };
    });

    // Apply optional filtering in memory for frontend search/status tabs
    let filteredStations = formattedStations;

    if (search && typeof search === 'string') {
      const query = search.toLowerCase().trim();
      filteredStations = filteredStations.filter((st) => {
        const matchesStation =
          st.name.toLowerCase().includes(query) ||
          st.code.toLowerCase().includes(query) ||
          (st.nameAmharic && st.nameAmharic.toLowerCase().includes(query)) ||
          (st.company && st.company.toLowerCase().includes(query)) ||
          st.location.toLowerCase().includes(query);

        const matchesRep = st.representatives.some(
          (rep) =>
            rep.fullName.toLowerCase().includes(query) ||
            rep.username.toLowerCase().includes(query) ||
            (rep.email && rep.email.toLowerCase().includes(query))
        );

        return matchesStation || matchesRep;
      });
    }

    if (status && typeof status === 'string') {
      const s = status.toUpperCase();
      if (s === 'ACTIVE') {
        filteredStations = filteredStations.filter((st) => st.activeRepresentative !== null);
      } else if (s === 'UNASSIGNED') {
        filteredStations = filteredStations.filter((st) => st.activeRepresentative === null);
      } else if (s === 'INACTIVE') {
        filteredStations = filteredStations.filter((st) =>
          st.representatives.some((r) => !r.isActive)
        );
      }
    }

    res.json({
      success: true,
      metrics: {
        totalStations,
        stationsWithActiveRep,
        stationsWithoutRep,
        totalInactiveReps,
      },
      stations: filteredStations,
    });
  } catch (error) {
    console.error('Failed to list representatives:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve representatives', error });
  }
};

/**
 * Create a new station representative.
 * Enforces one active representative per station with pessimistic row locking.
 */
export const createRepresentative = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = createRepresentativeSchema.parse(req.body);

    // 1. Verify Fuel Station exists
    const station = await prisma.fuelStation.findUnique({
      where: { id: data.fuelStationId },
    });

    if (!station) {
      res.status(404).json({ success: false, message: 'Specified fuel station not found' });
      return;
    }

    // 2. Check for duplicate username or email
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: data.username.toLowerCase().trim() },
          ...(data.email ? [{ email: data.email.toLowerCase().trim() }] : []),
        ],
      },
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: existingUser.username === data.username.toLowerCase().trim()
          ? `Username '${data.username}' is already in use.`
          : `Email '${data.email}' is already in use.`,
      });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const result = await prisma.$transaction(
      async (tx) => {
        // Pessimistic Row Lock: serialize all concurrent representative operations for this station
        await tx.$queryRaw`SELECT id FROM fuel_stations WHERE id = ${station.id} FOR UPDATE`;

        // Check active representative INSIDE the locked transaction to prevent concurrent race conditions
        const currentActiveRep = await tx.user.findFirst({
          where: {
            fuelStationId: station.id,
            role: UserRole.STATION_ADMIN,
            isActive: true,
          },
        });

        if (currentActiveRep && !data.forceReplace) {
          const err: any = new Error('ACTIVE_CONFLICT');
          err.conflict = true;
          err.currentRepresentative = {
            id: currentActiveRep.id,
            fullName: currentActiveRep.fullName,
            username: currentActiveRep.username,
          };
          throw err;
        }

        // If replacing active representative, deactivate former
        if (currentActiveRep && data.forceReplace) {
          await tx.user.updateMany({
            where: {
              fuelStationId: station.id,
              role: UserRole.STATION_ADMIN,
              isActive: true,
            },
            data: { isActive: false },
          });

          await logAudit({
            userId: req.user!.userId,
            action: 'DEACTIVATE_REPRESENTATIVE',
            entityType: 'User',
            entityId: currentActiveRep.id,
            details: {
              reason: `Replaced by new representative ${data.username}`,
              stationId: station.id,
              stationCode: station.code,
              formerRepUsername: currentActiveRep.username,
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            tx,
          });
        }

        // Create new representative
        const createdRep = await tx.user.create({
          data: {
            fullName: data.fullName.trim(),
            username: data.username.toLowerCase().trim(),
            email: data.email ? data.email.toLowerCase().trim() : null,
            passwordHash,
            role: UserRole.STATION_ADMIN,
            fuelStationId: station.id,
            isActive: true,
          },
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            role: true,
            fuelStationId: true,
            isActive: true,
            createdAt: true,
          },
        });

        await logAudit({
          userId: req.user!.userId,
          action: 'CREATE_STATION_REPRESENTATIVE',
          entityType: 'User',
          entityId: createdRep.id,
          details: {
            fullName: createdRep.fullName,
            username: createdRep.username,
            stationId: station.id,
            stationCode: station.code,
            wasReplaced: Boolean(currentActiveRep && data.forceReplace),
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          tx,
        });

        return createdRep;
      },
      TX_OPTIONS
    );

    res.status(201).json({
      success: true,
      message: `Representative ${result.fullName} successfully registered for ${station.name}.`,
      representative: result,
    });
  } catch (error: any) {
    if (error.message === 'ACTIVE_CONFLICT' && error.conflict) {
      res.status(409).json({
        success: false,
        conflict: true,
        message: `Station already has an active representative: ${error.currentRepresentative.fullName} (@${error.currentRepresentative.username}). To replace this representative, confirm replacement.`,
        currentRepresentative: error.currentRepresentative,
      });
      return;
    }
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Invalid input' });
      return;
    }
    console.error('Failed to create representative:', error);
    res.status(500).json({ success: false, message: 'Failed to create representative', error });
  }
};

/**
 * Toggle representative status (ACTIVE / INACTIVE).
 * If activating, enforces one active rep invariant using row-level locking.
 */
export const updateRepresentativeStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = updateRepresentativeStatusSchema.parse(req.body);

    const rep = await prisma.user.findFirst({
      where: { id, role: UserRole.STATION_ADMIN },
      include: { fuelStation: true },
    });

    if (!rep) {
      res.status(404).json({ success: false, message: 'Station representative not found' });
      return;
    }

    const targetActiveState = data.status === 'ACTIVE';

    if (targetActiveState && rep.fuelStationId) {
      await prisma.$transaction(
        async (tx) => {
          // Lock station row exclusively
          await tx.$queryRaw`SELECT id FROM fuel_stations WHERE id = ${rep.fuelStationId} FOR UPDATE`;

          // Check conflict inside transaction
          const activeConflict = await tx.user.findFirst({
            where: {
              fuelStationId: rep.fuelStationId,
              role: UserRole.STATION_ADMIN,
              isActive: true,
              id: { not: rep.id },
            },
          });

          if (activeConflict && !data.forceReplace) {
            const err: any = new Error('ACTIVE_CONFLICT');
            err.conflict = true;
            err.currentRepresentative = {
              id: activeConflict.id,
              fullName: activeConflict.fullName,
              username: activeConflict.username,
            };
            throw err;
          }

          if (activeConflict && data.forceReplace) {
            await tx.user.update({
              where: { id: activeConflict.id },
              data: { isActive: false },
            });

            await logAudit({
              userId: req.user!.userId,
              action: 'DEACTIVATE_REPRESENTATIVE',
              entityType: 'User',
              entityId: activeConflict.id,
              details: {
                reason: `Replaced by reactivation of representative ${rep.username}`,
                stationId: rep.fuelStationId,
              },
              ipAddress: req.ip,
              tx,
            });
          }

          await tx.user.update({
            where: { id: rep.id },
            data: { isActive: true },
          });

          await logAudit({
            userId: req.user!.userId,
            action: 'ACTIVATE_REPRESENTATIVE',
            entityType: 'User',
            entityId: rep.id,
            details: {
              stationId: rep.fuelStationId,
              username: rep.username,
              newStatus: 'ACTIVE',
            },
            ipAddress: req.ip,
            tx,
          });
        },
        TX_OPTIONS
      );

      res.json({
        success: true,
        message: `Representative ${rep.fullName} activated successfully.`,
      });
      return;
    }

    // Deactivation or unassigned status update
    await prisma.$transaction(
      async (tx) => {
        if (rep.fuelStationId) {
          await tx.$queryRaw`SELECT id FROM fuel_stations WHERE id = ${rep.fuelStationId} FOR UPDATE`;
        }

        await tx.user.update({
          where: { id: rep.id },
          data: { isActive: targetActiveState },
        });

        await logAudit({
          userId: req.user!.userId,
          action: targetActiveState ? 'ACTIVATE_REPRESENTATIVE' : 'DEACTIVATE_REPRESENTATIVE',
          entityType: 'User',
          entityId: rep.id,
          details: {
            stationId: rep.fuelStationId,
            username: rep.username,
            newStatus: targetActiveState ? 'ACTIVE' : 'INACTIVE',
          },
          ipAddress: req.ip,
          tx,
        });
      },
      TX_OPTIONS
    );

    res.json({
      success: true,
      message: `Representative ${rep.fullName} status updated to ${data.status}.`,
    });
  } catch (error: any) {
    if (error.message === 'ACTIVE_CONFLICT' && error.conflict) {
      res.status(409).json({
        success: false,
        conflict: true,
        message: `Station already has active representative: ${error.currentRepresentative.fullName} (@${error.currentRepresentative.username}). Deactivate or replace the current representative first.`,
        currentRepresentative: error.currentRepresentative,
      });
      return;
    }
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Invalid input' });
      return;
    }
    console.error('Failed to update representative status:', error);
    res.status(500).json({ success: false, message: 'Failed to update representative status', error });
  }
};

/**
 * Dedicated atomic replacement of an existing station representative.
 */
export const replaceRepresentative = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = replaceRepresentativeSchema.parse(req.body);

    const currentRep = await prisma.user.findFirst({
      where: { id, role: UserRole.STATION_ADMIN },
      include: { fuelStation: true },
    });

    if (!currentRep || !currentRep.fuelStationId) {
      res.status(404).json({ success: false, message: 'Current representative or station assignment not found' });
      return;
    }

    // Check unique username or email
    const duplicate = await prisma.user.findFirst({
      where: {
        OR: [
          { username: data.username.toLowerCase().trim() },
          ...(data.email ? [{ email: data.email.toLowerCase().trim() }] : []),
        ],
      },
    });

    if (duplicate) {
      res.status(400).json({
        success: false,
        message: duplicate.username === data.username.toLowerCase().trim()
          ? `Username '${data.username}' is already in use.`
          : `Email '${data.email}' is already in use.`,
      });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const replacementResult = await prisma.$transaction(
      async (tx) => {
        // Lock station row
        await tx.$queryRaw`SELECT id FROM fuel_stations WHERE id = ${currentRep.fuelStationId} FOR UPDATE`;

        // 1. Atomically deactivate target representative if and only if it is currently active
        const deactivateResult = await tx.user.updateMany({
          where: {
            id: currentRep.id,
            role: UserRole.STATION_ADMIN,
            isActive: true,
          },
          data: { isActive: false },
        });

        if (deactivateResult.count === 0) {
          // Another concurrent request has already replaced or deactivated this representative
          const err: any = new Error('ALREADY_REPLACED');
          err.conflict = true;
          throw err;
        }

        // Also ensure any other active representatives on this station are deactivated
        await tx.user.updateMany({
          where: {
            fuelStationId: currentRep.fuelStationId,
            role: UserRole.STATION_ADMIN,
            isActive: true,
          },
          data: { isActive: false },
        });

        // 2. Create new representative
        const newRep = await tx.user.create({
          data: {
            fullName: data.fullName.trim(),
            username: data.username.toLowerCase().trim(),
            email: data.email ? data.email.toLowerCase().trim() : null,
            passwordHash,
            role: UserRole.STATION_ADMIN,
            fuelStationId: currentRep.fuelStationId,
            isActive: true,
          },
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            isActive: true,
            fuelStationId: true,
            createdAt: true,
          },
        });

        // 3. Log audit for replacement inside transaction
        await logAudit({
          userId: req.user!.userId,
          action: 'REPLACE_REPRESENTATIVE',
          entityType: 'User',
          entityId: newRep.id,
          details: {
            stationId: currentRep.fuelStationId,
            stationCode: currentRep.fuelStation?.code,
            stationName: currentRep.fuelStation?.name,
            formerRepresentativeId: currentRep.id,
            formerRepresentativeUsername: currentRep.username,
            newRepresentativeId: newRep.id,
            newRepresentativeUsername: newRep.username,
            reason: data.reason || 'Official station representative replacement',
          },
          ipAddress: req.ip,
          tx,
        });

        return newRep;
      },
      TX_OPTIONS
    );

    res.status(201).json({
      success: true,
      message: `Representative replaced successfully. ${replacementResult.fullName} is now active at ${currentRep.fuelStation?.name}.`,
      representative: replacementResult,
    });
  } catch (error: any) {
    if (error.message === 'ALREADY_REPLACED' && error.conflict) {
      res.status(409).json({
        success: false,
        conflict: true,
        message: 'This station representative has already been replaced or deactivated.',
      });
      return;
    }
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Invalid input' });
      return;
    }
    console.error('Failed to replace representative:', error);
    res.status(500).json({ success: false, message: 'Failed to replace representative', error });
  }
};

/**
 * Reassign representative to another fuel station.
 * Enforces one active representative at destination station with deadlock-free row locking.
 */
export const reassignRepresentative = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = reassignRepresentativeSchema.parse(req.body);

    const rep = await prisma.user.findFirst({
      where: { id, role: UserRole.STATION_ADMIN },
      include: { fuelStation: true },
    });

    if (!rep) {
      res.status(404).json({ success: false, message: 'Station representative not found' });
      return;
    }

    if (rep.fuelStationId === data.newFuelStationId) {
      res.status(400).json({ success: false, message: 'Representative is already assigned to this station' });
      return;
    }

    const targetStation = await prisma.fuelStation.findUnique({
      where: { id: data.newFuelStationId },
    });

    if (!targetStation) {
      res.status(404).json({ success: false, message: 'Target fuel station not found' });
      return;
    }

    await prisma.$transaction(
      async (tx) => {
        // Lock both source and destination stations in deterministic order to prevent deadlocks
        const stationIdsToLock = [rep.fuelStationId, targetStation.id]
          .filter((sid): sid is string => Boolean(sid))
          .sort();

        for (const sid of stationIdsToLock) {
          await tx.$queryRaw`SELECT id FROM fuel_stations WHERE id = ${sid} FOR UPDATE`;
        }

        // Check active conflict at target station
        if (rep.isActive) {
          const activeAtTarget = await tx.user.findFirst({
            where: {
              fuelStationId: targetStation.id,
              role: UserRole.STATION_ADMIN,
              isActive: true,
              id: { not: rep.id },
            },
          });

          if (activeAtTarget && !data.forceReplace) {
            const err: any = new Error('ACTIVE_CONFLICT');
            err.conflict = true;
            err.currentRepresentative = {
              id: activeAtTarget.id,
              fullName: activeAtTarget.fullName,
              username: activeAtTarget.username,
            };
            throw err;
          }

          if (activeAtTarget && data.forceReplace) {
            await tx.user.update({
              where: { id: activeAtTarget.id },
              data: { isActive: false },
            });

            await logAudit({
              userId: req.user!.userId,
              action: 'DEACTIVATE_REPRESENTATIVE',
              entityType: 'User',
              entityId: activeAtTarget.id,
              details: {
                reason: `Deactivated due to reassignment of ${rep.username} to ${targetStation.code}`,
                stationId: targetStation.id,
              },
              ipAddress: req.ip,
              tx,
            });
          }

          await tx.user.update({
            where: { id: rep.id },
            data: { fuelStationId: targetStation.id },
          });

          await logAudit({
            userId: req.user!.userId,
            action: 'REASSIGN_REPRESENTATIVE',
            entityType: 'User',
            entityId: rep.id,
            details: {
              formerStationId: rep.fuelStationId,
              formerStationCode: rep.fuelStation?.code,
              newStationId: targetStation.id,
              newStationCode: targetStation.code,
              reason: data.reason || 'Official station reassignment',
            },
            ipAddress: req.ip,
            tx,
          });
        } else {
          // Inactive representative reassignment
          await tx.user.update({
            where: { id: rep.id },
            data: { fuelStationId: targetStation.id },
          });

          await logAudit({
            userId: req.user!.userId,
            action: 'REASSIGN_REPRESENTATIVE',
            entityType: 'User',
            entityId: rep.id,
            details: {
              formerStationId: rep.fuelStationId,
              formerStationCode: rep.fuelStation?.code,
              newStationId: targetStation.id,
              newStationCode: targetStation.code,
              status: 'INACTIVE',
            },
            ipAddress: req.ip,
            tx,
          });
        }
      },
      TX_OPTIONS
    );

    res.json({
      success: true,
      message: `Representative ${rep.fullName} reassigned to ${targetStation.name}.`,
    });
  } catch (error: any) {
    if (error.message === 'ACTIVE_CONFLICT' && error.conflict) {
      res.status(409).json({
        success: false,
        conflict: true,
        message: `Target station already has active representative: ${error.currentRepresentative.fullName} (@${error.currentRepresentative.username}). Confirm replacement to proceed.`,
        currentRepresentative: error.currentRepresentative,
      });
      return;
    }
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Invalid input' });
      return;
    }
    console.error('Failed to reassign representative:', error);
    res.status(500).json({ success: false, message: 'Failed to reassign representative', error });
  }
};

/**
 * Reset representative password securely.
 * Only Trade Office can perform this action for station representatives.
 * Guarantees zero credential leakage in responses or logs.
 */
export const resetRepresentativePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = resetRepresentativePasswordSchema.parse(req.body);

    // Strictly ensure target user is a STATION_ADMIN (cannot reset other office accounts)
    const rep = await prisma.user.findFirst({
      where: { id, role: UserRole.STATION_ADMIN },
      include: { fuelStation: true },
    });

    if (!rep) {
      res.status(404).json({ success: false, message: 'Station representative not found' });
      return;
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);

    await prisma.$transaction(
      async (tx) => {
        await tx.user.update({
          where: { id: rep.id },
          data: { passwordHash },
        });

        await logAudit({
          userId: req.user!.userId,
          action: 'RESET_REPRESENTATIVE_PASSWORD',
          entityType: 'User',
          entityId: rep.id,
          details: {
            username: rep.username,
            stationId: rep.fuelStationId,
            stationCode: rep.fuelStation?.code,
            isRepresentativeActive: rep.isActive,
          },
          ipAddress: req.ip,
          tx,
        });
      },
      TX_OPTIONS
    );

    res.json({
      success: true,
      message: `Password reset successfully for representative @${rep.username}.`,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Invalid input' });
      return;
    }
    console.error('Failed to reset representative password:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password', error });
  }
};
