import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { EligibilityStatus, RequestStatus, CardStatus, VerificationResult } from '@prisma/client';

export const getDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const role = req.user?.role;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    if (role === 'AGRICULTURE_OFFICE') {
      const [
        totalFarmers,
        activeFarmers,
        allocations,
        totalRequests,
        pendingRequests,
        recentRequests,
        fuelTypes,
      ] = await Promise.all([
        prisma.farmer.count(),
        prisma.farmer.count({ where: { eligibilityStatus: EligibilityStatus.ELIGIBLE, isActive: true } }),
        prisma.monthlyAllocation.findMany({ where: { month, year } }),
        prisma.fuelRequest.count(),
        prisma.fuelRequest.count({ where: { status: { in: [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW] } } }),
        prisma.fuelRequest.findMany({
          take: 5,
          orderBy: { submittedAt: 'desc' },
          include: { submittedBy: true },
        }),
        prisma.fuelType.findMany({ where: { isActive: true } }),
      ]);

      const monthlyAllocationTotal = allocations.reduce((acc, a) => acc + Number(a.allocatedLiters), 0);

      const fuelBreakdowns = fuelTypes.map((ft) => {
        const ftAllocs = allocations.filter((a) => a.fuelTypeId === ft.id);
        const allocated = ftAllocs.reduce((sum, a) => sum + Number(a.allocatedLiters), 0);
        const used = ftAllocs.reduce((sum, a) => sum + Number(a.usedLiters), 0);
        return {
          name: ft.name,
          allocated,
          used,
          percentage: allocated > 0 ? Math.round((used / allocated) * 100) : 0,
        };
      });

      res.json({
        success: true,
        role: 'agriculture',
        stats: [
          { label: 'Registered farmers', value: totalFarmers.toLocaleString(), note: 'Irrigation beneficiaries', icon: 'farmer' },
          { label: 'Active farmers', value: activeFarmers.toLocaleString(), note: 'Currently eligible', icon: 'check' },
          { label: 'Monthly allocation', value: `${monthlyAllocationTotal.toLocaleString()} L`, note: 'Current month total', icon: 'quota' },
          { label: 'Requests sent to Trade', value: totalRequests.toString(), note: `${pendingRequests} awaiting response`, icon: 'arrow' },
        ],
        recentRequests,
        fuelBreakdowns,
      });
      return;
    }

    if (role === 'TRADE_OFFICE') {
      const [
        incomingRequests,
        approvedRequests,
        allAuthorizations,
        stationAssignments,
        recentReviewQueue,
      ] = await Promise.all([
        prisma.fuelRequest.count({ where: { status: { in: [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW] } } }),
        prisma.fuelRequest.count({ where: { status: { in: [RequestStatus.APPROVED, RequestStatus.PARTIALLY_APPROVED] } } }),
        prisma.fuelAuthorization.findMany({ where: { status: 'ACTIVE' } }),
        prisma.stationAssignment.count({ where: { status: 'ACTIVE' } }),
        prisma.fuelRequest.findMany({
          where: { status: { in: [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW] } },
          take: 5,
          orderBy: { submittedAt: 'desc' },
          include: { submittedBy: true },
        }),
      ]);

      const totalAuthorizedLiters = allAuthorizations.reduce((acc, a) => acc + Number(a.authorizedLiters), 0);
      const totalConsumedLiters = allAuthorizations.reduce((acc, a) => acc + Number(a.consumedLiters), 0);

      res.json({
        success: true,
        role: 'trade',
        stats: [
          { label: 'Incoming requests', value: incomingRequests.toString(), note: 'Awaiting review queue', icon: 'arrow' },
          { label: 'Approved requests', value: approvedRequests.toString(), note: 'Trade verified', icon: 'check' },
          { label: 'Authorized fuel', value: `${totalAuthorizedLiters.toLocaleString()} L`, note: 'Approved total volume', icon: 'quota' },
          { label: 'Stations assigned', value: stationAssignments.toString(), note: 'Active dispensing links', icon: 'station' },
        ],
        recentRequests: recentReviewQueue,
        monitoring: {
          totalAuthorized: totalAuthorizedLiters,
          totalConsumed: totalConsumedLiters,
          percentageDispensed: totalAuthorizedLiters > 0 ? Math.round((totalConsumedLiters / totalAuthorizedLiters) * 100) : 0,
        },
      });
      return;
    }

    if (role === 'STATION_ADMIN') {
      const stationId = req.user!.fuelStationId;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        todayTransactions,
        todayVerifications,
        blockedScans,
        activeStationAuths,
        recentTransactions,
        stationInfo,
      ] = await Promise.all([
        prisma.fuelTransaction.findMany({
          where: {
            fuelStationId: stationId || undefined,
            transactionDate: { gte: todayStart },
          },
        }),
        prisma.verificationLog.count({
          where: {
            fuelStationId: stationId || undefined,
            createdAt: { gte: todayStart },
            result: VerificationResult.SUCCESS,
          },
        }),
        prisma.verificationLog.count({
          where: {
            fuelStationId: stationId || undefined,
            createdAt: { gte: todayStart },
            result: VerificationResult.REJECTED,
          },
        }),
        prisma.stationAssignment.count({
          where: { fuelStationId: stationId || undefined, status: 'ACTIVE' },
        }),
        prisma.fuelTransaction.findMany({
          where: { fuelStationId: stationId || undefined },
          take: 6,
          orderBy: { transactionDate: 'desc' },
          include: {
            farmer: true,
            fuelType: true,
          },
        }),
        stationId ? prisma.fuelStation.findUnique({ where: { id: stationId } }) : null,
      ]);

      const fuelDispensedToday = todayTransactions.reduce((acc, t) => acc + Number(t.quantityLiters), 0);

      res.json({
        success: true,
        role: 'station',
        stationName: stationInfo?.name || 'Assigned Station',
        stats: [
          { label: "Today's transactions", value: todayTransactions.length.toString(), note: 'Completed dispensing', icon: 'hash' },
          { label: 'Fuel dispensed today', value: `${fuelDispensedToday.toLocaleString()} L`, note: 'Dispensed volume', icon: 'quota' },
          { label: 'Valid farmers', value: todayVerifications.toString(), note: 'Verified today', icon: 'check' },
          { label: 'Blocked scans', value: blockedScans.toString(), note: 'Invalid or unauthorized', icon: 'alert' },
        ],
        recentTransactions,
      });
      return;
    }

    if (role === 'SYSTEM_ADMIN') {
      const [totalUsers, activeUsers, pendingActivation, alertCount] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { lastLoginAt: null } }),
        prisma.auditLog.count({ where: { action: { contains: 'REJECT' } } }),
      ]);

      res.json({
        success: true,
        role: 'sysadmin',
        stats: [
          { label: 'User accounts', value: totalUsers.toString(), note: 'All registered accounts', icon: 'farmer' },
          { label: 'Active accounts', value: activeUsers.toString(), note: 'Operational enabled', icon: 'check' },
          { label: 'Pending first login', value: pendingActivation.toString(), note: 'Awaiting first setup', icon: 'time' },
          { label: 'Security events', value: alertCount.toString(), note: 'Audit log flags', icon: 'alert' },
        ],
        systemHealth: {
          appStatus: 'Operational',
          dbStatus: 'Connected',
          port: process.env.PORT || 5000,
        },
      });
      return;
    }

    res.status(403).json({ success: false, message: 'Invalid role for dashboard' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve dashboard metrics', error });
  }
};
