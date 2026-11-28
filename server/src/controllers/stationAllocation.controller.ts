import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import {
  createStationAllocationSchema,
  updateStationAllocationsSchema,
  updateAllocationStatusSchema,
} from '../validators/stationAllocation.validator.js';
import { logAudit } from '../middleware/audit.js';
import { AssignmentStatus, UserRole } from '@prisma/client';

const TX_OPTIONS = {
  maxWait: 10000,
  timeout: 30000,
};

/**
 * List all stations, sub-cities, allocations, and overview metrics.
 */
export const listStationAllocations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, subCityId, stationId, status } = req.query;

    const [stations, subCities, rawAllocations] = await Promise.all([
      prisma.fuelStation.findMany({
        include: {
          users: {
            where: { role: UserRole.STATION_ADMIN, isActive: true },
            select: { id: true, fullName: true, username: true, email: true },
          },
          subCityAssignments: {
            include: {
              subCity: {
                select: { id: true, code: true, name: true, nameAmharic: true },
              },
              assignedBy: {
                select: { id: true, fullName: true, username: true },
              },
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
      }),
      prisma.subCity.findMany({
        include: {
          stationAssignments: {
            where: { status: AssignmentStatus.ACTIVE },
            include: {
              fuelStation: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  nameAmharic: true,
                  company: true,
                  location: true,
                  isActive: true,
                },
              },
            },
          },
          _count: {
            select: {
              farmers: true,
              kebeles: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.stationSubCityAssignment.findMany({
        include: {
          fuelStation: {
            select: { id: true, code: true, name: true, nameAmharic: true, company: true, isActive: true },
          },
          subCity: {
            select: { id: true, code: true, name: true, nameAmharic: true },
          },
          assignedBy: {
            select: { id: true, fullName: true, username: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Compute metrics
    const totalActiveStations = stations.filter((s) => s.isActive).length;
    const totalSubCities = subCities.length;
    const totalActiveAllocations = rawAllocations.filter((a) => a.status === AssignmentStatus.ACTIVE).length;

    const stationsWithNoAllocation = stations.filter(
      (s) => s.isActive && !s.subCityAssignments.some((a) => a.status === AssignmentStatus.ACTIVE)
    ).length;

    const subCitiesWithNoStations = subCities.filter(
      (sc) => sc.stationAssignments.length === 0
    ).length;

    // Format stations with their active/historical allocations
    const formattedStations = stations.map((st) => {
      const activeAllocations = st.subCityAssignments.filter((a) => a.status === AssignmentStatus.ACTIVE);
      const activeRep = st.users[0] || null;

      return {
        id: st.id,
        code: st.code,
        name: st.name,
        nameAmharic: st.nameAmharic,
        company: st.company,
        location: st.location,
        phone: st.phone,
        isActive: st.isActive,
        activeRepresentative: activeRep,
        activeSubCities: activeAllocations.map((a) => a.subCity),
        allocations: st.subCityAssignments,
        allocationCount: activeAllocations.length,
        hasAllocation: activeAllocations.length > 0,
      };
    });

    // Format sub-cities
    const formattedSubCities = subCities.map((sc) => ({
      id: sc.id,
      code: sc.code,
      name: sc.name,
      nameAmharic: sc.nameAmharic,
      farmerCount: sc._count.farmers,
      kebeleCount: sc._count.kebeles,
      stationCount: sc.stationAssignments.length,
      authorizedStations: sc.stationAssignments.map((a) => a.fuelStation),
    }));

    const responsePayload = {
      metrics: {
        totalActiveStations,
        totalSubCities,
        totalActiveAllocations,
        stationsWithNoAllocation,
        subCitiesWithNoStations,
      },
      stations: formattedStations,
      subCities: formattedSubCities,
      allocations: rawAllocations,
      byStation: formattedStations,
      bySubCity: formattedSubCities,
    };

    res.json({
      success: true,
      ...responsePayload,
      data: responsePayload,
    });
  } catch (error) {
    console.error('Failed to list station allocations:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve allocations', error });
  }
};

/**
 * Create a new station-to-Sub-City allocation.
 */
export const createAllocation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = createStationAllocationSchema.parse(req.body);

    const station = await prisma.fuelStation.findUnique({
      where: { id: data.fuelStationId },
    });

    if (!station) {
      res.status(404).json({ success: false, message: 'Fuel station not found' });
      return;
    }

    if (!station.isActive) {
      res.status(400).json({
        success: false,
        code: 'STATION_INACTIVE',
        message: `Cannot allocate inactive fuel station '${station.name}'. Activate the station first.`,
      });
      return;
    }

    const subCity = await prisma.subCity.findUnique({
      where: { id: data.subCityId },
    });

    if (!subCity) {
      res.status(404).json({ success: false, message: 'Sub-City not found' });
      return;
    }

    // Check existing allocation
    const existing = await prisma.stationSubCityAssignment.findUnique({
      where: {
        subCityId_fuelStationId: {
          subCityId: data.subCityId,
          fuelStationId: data.fuelStationId,
        },
      },
    });

    if (existing && existing.status === AssignmentStatus.ACTIVE) {
      res.status(409).json({
        success: false,
        code: 'ALLOCATION_EXISTS',
        message: `Station '${station.name}' is already actively allocated to Sub-City '${subCity.name}'.`,
      });
      return;
    }

    const result = await prisma.$transaction(
      async (tx) => {
        // Lock station row
        await tx.$queryRaw`SELECT id FROM fuel_stations WHERE id = ${station.id} FOR UPDATE`;

        let assignment;
        if (existing) {
          // Reactivate previously revoked assignment
          assignment = await tx.stationSubCityAssignment.update({
            where: { id: existing.id },
            data: {
              status: AssignmentStatus.ACTIVE,
              assignedById: req.user!.userId,
              assignedAt: new Date(),
              notes: data.notes || existing.notes,
            },
            include: { fuelStation: true, subCity: true },
          });

          await logAudit({
            userId: req.user!.userId,
            action: 'REACTIVATE_STATION_ALLOCATION',
            entityType: 'StationSubCityAssignment',
            entityId: assignment.id,
            details: {
              stationId: station.id,
              stationCode: station.code,
              stationName: station.name,
              subCityId: subCity.id,
              subCityName: subCity.name,
              notes: data.notes || null,
            },
            ipAddress: req.ip,
            tx,
          });
        } else {
          // Create new allocation
          assignment = await tx.stationSubCityAssignment.create({
            data: {
              fuelStationId: station.id,
              subCityId: subCity.id,
              assignedById: req.user!.userId,
              status: AssignmentStatus.ACTIVE,
              notes: data.notes || null,
            },
            include: { fuelStation: true, subCity: true },
          });

          await logAudit({
            userId: req.user!.userId,
            action: 'CREATE_STATION_ALLOCATION',
            entityType: 'StationSubCityAssignment',
            entityId: assignment.id,
            details: {
              stationId: station.id,
              stationCode: station.code,
              stationName: station.name,
              subCityId: subCity.id,
              subCityName: subCity.name,
              notes: data.notes || null,
            },
            ipAddress: req.ip,
            tx,
          });
        }

        return assignment;
      },
      TX_OPTIONS
    );

    res.status(201).json({
      success: true,
      message: `Station '${station.name}' successfully allocated to Sub-City '${subCity.name}'.`,
      allocation: result,
      data: result,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Invalid input' });
      return;
    }
    console.error('Failed to create allocation:', error);
    res.status(500).json({ success: false, message: 'Failed to create allocation', error });
  }
};

/**
 * Synchronize the full set of allocated Sub-Cities for a specific station.
 * Allows allocating a station to 1..4 Sub-Cities or clearing all allocations.
 */
export const setStationAllocations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { stationId } = req.params;
    const data = updateStationAllocationsSchema.parse(req.body);

    const station = await prisma.fuelStation.findUnique({
      where: { id: stationId },
    });

    if (!station) {
      res.status(404).json({ success: false, message: 'Fuel station not found' });
      return;
    }

    if (!station.isActive && data.subCityIds.length > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot allocate inactive fuel station '${station.name}'. Activate the station first.`,
      });
      return;
    }

    // Verify all requested Sub-City IDs exist
    if (data.subCityIds.length > 0) {
      const validSubCities = await prisma.subCity.findMany({
        where: { id: { in: data.subCityIds } },
      });
      if (validSubCities.length !== data.subCityIds.length) {
        res.status(400).json({ success: false, message: 'One or more selected Sub-City IDs are invalid' });
        return;
      }
    }

    await prisma.$transaction(
      async (tx) => {
        // Lock station row
        await tx.$queryRaw`SELECT id FROM fuel_stations WHERE id = ${station.id} FOR UPDATE`;

        const currentAssignments = await tx.stationSubCityAssignment.findMany({
          where: { fuelStationId: station.id },
        });

        const targetSubCitySet = new Set(data.subCityIds);

        // 1. Remove assignments for sub-cities no longer in the target set
        const assignmentsToRemove = currentAssignments.filter((a) => !targetSubCitySet.has(a.subCityId));
        if (assignmentsToRemove.length > 0) {
          await tx.stationSubCityAssignment.deleteMany({
            where: {
              id: { in: assignmentsToRemove.map((a) => a.id) },
            },
          });
        }

        // 2. Add or activate assignments for sub-cities in target set
        const existingSubCityIds = new Set(currentAssignments.map((a) => a.subCityId));
        for (const scId of data.subCityIds) {
          if (!existingSubCityIds.has(scId)) {
            await tx.stationSubCityAssignment.create({
              data: {
                fuelStationId: station.id,
                subCityId: scId,
                assignedById: req.user!.userId,
                status: AssignmentStatus.ACTIVE,
                notes: data.notes || null,
              },
            });
          } else {
            // If was revoked, reactivate
            await tx.stationSubCityAssignment.updateMany({
              where: {
                fuelStationId: station.id,
                subCityId: scId,
                status: AssignmentStatus.REVOKED,
              },
              data: {
                status: AssignmentStatus.ACTIVE,
                assignedById: req.user!.userId,
                assignedAt: new Date(),
              },
            });
          }
        }

        await logAudit({
          userId: req.user!.userId,
          action: 'UPDATE_STATION_ALLOCATIONS',
          entityType: 'FuelStation',
          entityId: station.id,
          details: {
            stationId: station.id,
            stationCode: station.code,
            allocatedSubCityCount: data.subCityIds.length,
            allocatedSubCityIds: data.subCityIds,
            removedAllocationCount: assignmentsToRemove.length,
            notes: data.notes || null,
          },
          ipAddress: req.ip,
          tx,
        });
      },
      TX_OPTIONS
    );

    res.json({
      success: true,
      message: `Station '${station.name}' allocation updated to ${data.subCityIds.length} Sub-Cities.`,
      data: {
        stationId: station.id,
        activeSubCities: data.subCityIds,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Invalid input' });
      return;
    }
    console.error('Failed to set station allocations:', error);
    res.status(500).json({ success: false, message: 'Failed to update station allocations', error });
  }
};

/**
 * Toggle allocation status (ACTIVE / REVOKED).
 */
export const updateAllocationStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = updateAllocationStatusSchema.parse(req.body);

    const assignment = await prisma.stationSubCityAssignment.findUnique({
      where: { id },
      include: { fuelStation: true, subCity: true },
    });

    if (!assignment) {
      res.status(404).json({ success: false, message: 'Allocation not found' });
      return;
    }

    if (data.status === AssignmentStatus.ACTIVE && !assignment.fuelStation.isActive) {
      res.status(400).json({
        success: false,
        message: `Cannot activate allocation for inactive station '${assignment.fuelStation.name}'.`,
      });
      return;
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        const res = await tx.stationSubCityAssignment.update({
          where: { id },
          data: {
            status: data.status as AssignmentStatus,
            notes: data.notes || assignment.notes,
          },
        });

        await logAudit({
          userId: req.user!.userId,
          action: data.status === AssignmentStatus.ACTIVE ? 'ACTIVATE_STATION_ALLOCATION' : 'REVOKE_STATION_ALLOCATION',
          entityType: 'StationSubCityAssignment',
          entityId: assignment.id,
          details: {
            stationId: assignment.fuelStationId,
            stationCode: assignment.fuelStation.code,
            subCityId: assignment.subCityId,
            subCityName: assignment.subCity.name,
            newStatus: data.status,
            notes: data.notes || null,
          },
          ipAddress: req.ip,
          tx,
        });

        return res;
      },
      TX_OPTIONS
    );

    res.json({
      success: true,
      message: `Allocation status updated to ${data.status}.`,
      allocation: updated,
      data: updated,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Invalid input' });
      return;
    }
    console.error('Failed to update allocation status:', error);
    res.status(500).json({ success: false, message: 'Failed to update allocation status', error });
  }
};

/**
 * Remove an allocation completely.
 */
export const deleteAllocation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const assignment = await prisma.stationSubCityAssignment.findUnique({
      where: { id },
      include: { fuelStation: true, subCity: true },
    });

    if (!assignment) {
      res.status(404).json({ success: false, message: 'Allocation not found' });
      return;
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.stationSubCityAssignment.delete({
          where: { id },
        });

        await logAudit({
          userId: req.user!.userId,
          action: 'REMOVE_STATION_ALLOCATION',
          entityType: 'StationSubCityAssignment',
          entityId: assignment.id,
          details: {
            stationId: assignment.fuelStationId,
            stationCode: assignment.fuelStation.code,
            subCityId: assignment.subCityId,
            subCityName: assignment.subCity.name,
          },
          ipAddress: req.ip,
          tx,
        });
      },
      TX_OPTIONS
    );

    res.json({
      success: true,
      message: `Allocation for station '${assignment.fuelStation.name}' to Sub-City '${assignment.subCity.name}' removed.`,
      data: { id: assignment.id },
    });
  } catch (error) {
    console.error('Failed to remove allocation:', error);
    res.status(500).json({ success: false, message: 'Failed to remove allocation', error });
  }
};
