import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { EligibilityStatus, RequestStatus, VerificationResult, ShortageStatus } from '@prisma/client';

export const getDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const role = req.user?.role;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // ==================== AGRICULTURE OFFICE DASHBOARD ====================
    if (role === 'AGRICULTURE_OFFICE') {
      const [
        totalFarmers,
        activeFarmers,
        inactiveFarmers,
        eligibleCount,
        underReviewCount,
        suspendedCount,
        ineligibleCount,
        allocations,
        totalRequests,
        pendingRequests,
        approvedRequestsCount,
        rejectedRequestsCount,
        returnedRequestsCount,
        requestLitersSum,
        approvedLitersSum,
        recentRequests,
        fuelTypes,
        subCities,
      ] = await Promise.all([
        prisma.farmer.count(),
        prisma.farmer.count({ where: { isActive: true } }),
        prisma.farmer.count({ where: { isActive: false } }),
        prisma.farmer.count({ where: { eligibilityStatus: EligibilityStatus.ELIGIBLE } }),
        prisma.farmer.count({ where: { eligibilityStatus: EligibilityStatus.UNDER_REVIEW } }),
        prisma.farmer.count({ where: { eligibilityStatus: EligibilityStatus.SUSPENDED } }),
        prisma.farmer.count({ where: { eligibilityStatus: EligibilityStatus.INELIGIBLE } }),
        prisma.monthlyAllocation.findMany({ where: { month, year } }),
        prisma.fuelRequest.count(),
        prisma.fuelRequest.count({ where: { status: { in: [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW] } } }),
        prisma.fuelRequest.count({ where: { status: { in: [RequestStatus.APPROVED, RequestStatus.PARTIALLY_APPROVED] } } }),
        prisma.fuelRequest.count({ where: { status: RequestStatus.REJECTED } }),
        prisma.fuelRequest.count({ where: { status: RequestStatus.RETURNED } }),
        prisma.fuelRequest.aggregate({ _sum: { totalLitersRequested: true } }),
        prisma.fuelRequest.aggregate({ _sum: { totalLitersApproved: true } }),
        prisma.fuelRequest.findMany({
          take: 6,
          orderBy: { submittedAt: 'desc' },
          include: {
            submittedBy: { select: { id: true, fullName: true, username: true } },
            reviewedBy: { select: { id: true, fullName: true, username: true } },
          },
        }),
        prisma.fuelType.findMany({ where: { isActive: true } }),
        prisma.subCity.findMany({
          include: {
            _count: { select: { farmers: true } },
          },
        }),
      ]);

      const monthlyAllocationTotal = allocations.reduce((acc, a) => acc + Number(a.allocatedLiters), 0);

      const fuelBreakdowns = fuelTypes.map((ft) => {
        const ftAllocs = allocations.filter((a) => a.fuelTypeId === ft.id);
        const allocated = ftAllocs.reduce((sum, a) => sum + Number(a.allocatedLiters), 0);
        const used = ftAllocs.reduce((sum, a) => sum + Number(a.usedLiters), 0);
        return {
          id: ft.id,
          name: ft.name,
          code: ft.code,
          allocated,
          used,
          percentage: allocated > 0 ? Math.round((used / allocated) * 100) : 0,
        };
      });

      const subCityDistribution = subCities.map((sc) => ({
        id: sc.id,
        code: sc.code,
        name: sc.name,
        farmersCount: sc._count.farmers,
      }));

      res.json({
        success: true,
        role: 'agriculture',
        stats: [
          { label: 'Registered farmers', value: totalFarmers.toLocaleString(), note: `${activeFarmers} active, ${inactiveFarmers} inactive`, icon: 'farmer' },
          { label: 'Active farmers', value: activeFarmers.toLocaleString(), note: `${eligibleCount} eligible for quota`, icon: 'check' },
          { label: 'Monthly allocation', value: `${monthlyAllocationTotal.toLocaleString()} L`, note: 'Current month total', icon: 'quota' },
          { label: 'Requests sent to Trade', value: totalRequests.toString(), note: `${pendingRequests} awaiting response`, icon: 'arrow' },
        ],
        farmerMetrics: {
          total: totalFarmers,
          active: activeFarmers,
          inactive: inactiveFarmers,
          eligible: eligibleCount,
          underReview: underReviewCount,
          suspended: suspendedCount,
          ineligible: ineligibleCount,
        },
        requestMetrics: {
          total: totalRequests,
          pending: pendingRequests,
          approved: approvedRequestsCount,
          rejected: rejectedRequestsCount,
          returned: returnedRequestsCount,
          totalLitersRequested: Number(requestLitersSum._sum.totalLitersRequested || 0),
          totalLitersApproved: Number(approvedLitersSum._sum.totalLitersApproved || 0),
        },
        subCityDistribution,
        recentRequests,
        fuelBreakdowns,
      });
      return;
    }

    // ==================== TRADE OFFICE DASHBOARD ====================
    if (role === 'TRADE_OFFICE') {
      const [
        totalStations,
        activeStations,
        stationsWithRepCount,
        activeSubCityAllocations,
        incomingRequests,
        approvedRequests,
        allAuthorizations,
        activeShortagesCount,
        recentShortages,
        recentReviewQueue,
        fuelTypes,
        recentTransactions,
      ] = await Promise.all([
        prisma.fuelStation.count(),
        prisma.fuelStation.count({ where: { isActive: true } }),
        prisma.user.count({
          where: {
            role: 'STATION_ADMIN',
            isActive: true,
            fuelStationId: { not: null },
          },
        }),
        prisma.stationSubCityAssignment.count({ where: { status: 'ACTIVE' } }),
        prisma.fuelRequest.count({ where: { status: { in: [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW] } } }),
        prisma.fuelRequest.count({ where: { status: { in: [RequestStatus.APPROVED, RequestStatus.PARTIALLY_APPROVED] } } }),
        prisma.fuelAuthorization.findMany({
          select: { authorizedLiters: true, consumedLiters: true, remainingLiters: true, fuelTypeId: true },
        }),
        prisma.fuelShortage.count({
          where: { status: { in: [ShortageStatus.REPORTED, ShortageStatus.UNDER_REVIEW, ShortageStatus.CONFIRMED] } },
        }),
        prisma.fuelShortage.findMany({
          where: { status: { in: [ShortageStatus.REPORTED, ShortageStatus.UNDER_REVIEW, ShortageStatus.CONFIRMED] } },
          take: 5,
          orderBy: { reportedAt: 'desc' },
          include: {
            fuelStation: { select: { id: true, code: true, name: true } },
            fuelType: { select: { id: true, name: true } },
            reportedBy: { select: { id: true, fullName: true, role: true } },
          },
        }),
        prisma.fuelRequest.findMany({
          where: { status: { in: [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW] } },
          take: 5,
          orderBy: { submittedAt: 'desc' },
          include: {
            submittedBy: { select: { id: true, fullName: true, username: true } },
          },
        }),
        prisma.fuelType.findMany({ where: { isActive: true } }),
        prisma.fuelTransaction.findMany({
          take: 6,
          orderBy: { transactionDate: 'desc' },
          include: {
            fuelStation: { select: { id: true, name: true, code: true } },
            fuelType: { select: { id: true, name: true } },
            farmer: { select: { id: true, fullName: true, farmerCode: true } },
          },
        }),
      ]);

      const totalAuthorizedLiters = allAuthorizations.reduce((acc, a) => acc + Number(a.authorizedLiters), 0);
      const totalConsumedLiters = allAuthorizations.reduce((acc, a) => acc + Number(a.consumedLiters), 0);
      const totalRemainingLiters = allAuthorizations.reduce((acc, a) => acc + Number(a.remainingLiters), 0);

      // Dispensing by fuel type
      const dispensingByFuelType = fuelTypes.map((ft) => {
        const ftAuths = allAuthorizations.filter((a) => a.fuelTypeId === ft.id);
        const authorized = ftAuths.reduce((sum, a) => sum + Number(a.authorizedLiters), 0);
        const consumed = ftAuths.reduce((sum, a) => sum + Number(a.consumedLiters), 0);
        const remaining = ftAuths.reduce((sum, a) => sum + Number(a.remainingLiters), 0);
        return {
          id: ft.id,
          name: ft.name,
          code: ft.code,
          authorized,
          consumed,
          remaining,
          usageRate: authorized > 0 ? Math.round((consumed / authorized) * 100) : 0,
        };
      });

      res.json({
        success: true,
        role: 'trade',
        stats: [
          { label: 'Incoming requests', value: incomingRequests.toString(), note: 'Awaiting review queue', icon: 'arrow' },
          { label: 'Approved requests', value: approvedRequests.toString(), note: 'Trade verified', icon: 'check' },
          { label: 'Authorized fuel', value: `${totalAuthorizedLiters.toLocaleString()} L`, note: 'Approved total volume', icon: 'quota' },
          { label: 'Stations active', value: `${activeStations} / ${totalStations}`, note: `${activeSubCityAllocations} active Sub-City links`, icon: 'station' },
        ],
        stationMetrics: {
          totalStations,
          activeStations,
          inactiveStations: totalStations - activeStations,
          stationsWithRepresentative: stationsWithRepCount,
          activeSubCityAllocations,
        },
        monitoring: {
          totalAuthorized: totalAuthorizedLiters,
          totalConsumed: totalConsumedLiters,
          totalRemaining: totalRemainingLiters,
          percentageDispensed: totalAuthorizedLiters > 0 ? Math.round((totalConsumedLiters / totalAuthorizedLiters) * 100) : 0,
        },
        shortages: {
          activeCount: activeShortagesCount,
          recent: recentShortages,
        },
        dispensingByFuelType,
        recentRequests: recentReviewQueue,
        recentTransactions,
      });
      return;
    }

    // ==================== STATION ADMIN DASHBOARD (Strict Station Scoping) ====================
    if (role === 'STATION_ADMIN') {
      const stationId = req.user!.fuelStationId;

      if (!stationId) {
        res.json({
          success: true,
          role: 'station',
          stationName: 'Unassigned Representative',
          stats: [
            { label: "Today's transactions", value: '0', note: 'No station assigned', icon: 'hash' },
            { label: 'Fuel dispensed today', value: '0 L', note: 'No station assigned', icon: 'quota' },
            { label: 'Valid farmers', value: '0', note: 'No station assigned', icon: 'check' },
            { label: 'Blocked scans', value: '0', note: 'No station assigned', icon: 'alert' },
          ],
          stationInfo: null,
          recentTransactions: [],
          verificationStats: { total: 0, success: 0, rejected: 0, rejectionReasons: {} },
          activeShortages: [],
        });
        return;
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        stationInfo,
        todayTransactions,
        allTransactionsCount,
        allLitersDispensedAgg,
        todayVerifications,
        todayBlockedScans,
        verificationLogs,
        recentTransactions,
        activeShortages,
      ] = await Promise.all([
        prisma.fuelStation.findUnique({
          where: { id: stationId },
          include: {
            subCityAssignments: {
              where: { status: 'ACTIVE' },
              include: { subCity: { select: { id: true, name: true, code: true } } },
            },
          },
        }),
        prisma.fuelTransaction.findMany({
          where: {
            fuelStationId: stationId,
            transactionDate: { gte: todayStart },
          },
        }),
        prisma.fuelTransaction.count({ where: { fuelStationId: stationId } }),
        prisma.fuelTransaction.aggregate({
          where: { fuelStationId: stationId },
          _sum: { quantityLiters: true, totalAmount: true },
        }),
        prisma.verificationLog.count({
          where: {
            fuelStationId: stationId,
            createdAt: { gte: todayStart },
            result: VerificationResult.SUCCESS,
          },
        }),
        prisma.verificationLog.count({
          where: {
            fuelStationId: stationId,
            createdAt: { gte: todayStart },
            result: VerificationResult.REJECTED,
          },
        }),
        prisma.verificationLog.findMany({
          where: { fuelStationId: stationId },
          select: { result: true, rejectionReason: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        prisma.fuelTransaction.findMany({
          where: { fuelStationId: stationId },
          take: 6,
          orderBy: { transactionDate: 'desc' },
          include: {
            farmer: { select: { id: true, fullName: true, farmerCode: true, phone: true } },
            fuelType: { select: { id: true, name: true, code: true } },
          },
        }),
        prisma.fuelShortage.findMany({
          where: {
            fuelStationId: stationId,
            status: { in: [ShortageStatus.REPORTED, ShortageStatus.UNDER_REVIEW, ShortageStatus.CONFIRMED] },
          },
          include: {
            fuelType: { select: { id: true, name: true, code: true } },
          },
          orderBy: { reportedAt: 'desc' },
        }),
      ]);

      const fuelDispensedToday = todayTransactions.reduce((acc, t) => acc + Number(t.quantityLiters), 0);
      const totalRevenueToday = todayTransactions.reduce((acc, t) => acc + Number(t.totalAmount), 0);

      // Rejection breakdown
      const rejectionReasons: Record<string, number> = {};
      let totalSuccessScans = 0;
      let totalRejectedScans = 0;

      for (const log of verificationLogs) {
        if (log.result === VerificationResult.SUCCESS) {
          totalSuccessScans++;
        } else {
          totalRejectedScans++;
          const reason = log.rejectionReason || 'UNSPECIFIED_ERROR';
          rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
        }
      }

      res.json({
        success: true,
        role: 'station',
        stationName: stationInfo?.name || 'Assigned Station',
        stationInfo: stationInfo ? {
          id: stationInfo.id,
          code: stationInfo.code,
          name: stationInfo.name,
          location: stationInfo.location,
          contactPerson: stationInfo.contactPerson,
          phone: stationInfo.phone,
          isActive: stationInfo.isActive,
          subCitiesCovered: stationInfo.subCityAssignments.map((a) => a.subCity.name),
        } : null,
        stats: [
          { label: "Today's transactions", value: todayTransactions.length.toString(), note: `Total: ${allTransactionsCount} dispensing events`, icon: 'hash' },
          { label: 'Fuel dispensed today', value: `${fuelDispensedToday.toLocaleString()} L`, note: `Lifetime: ${Number(allLitersDispensedAgg._sum.quantityLiters || 0).toLocaleString()} L`, icon: 'quota' },
          { label: 'Valid farmers', value: todayVerifications.toString(), note: 'Verified today', icon: 'check' },
          { label: 'Blocked scans', value: todayBlockedScans.toString(), note: 'Invalid or unauthorized', icon: 'alert' },
        ],
        todayPerformance: {
          transactionsCount: todayTransactions.length,
          dispensedLiters: fuelDispensedToday,
          totalRevenueBirr: totalRevenueToday,
        },
        verificationStats: {
          recentTotal: verificationLogs.length,
          totalSuccess: totalSuccessScans,
          totalRejected: totalRejectedScans,
          rejectionReasons,
        },
        activeShortages,
        recentTransactions,
      });
      return;
    }

    // ==================== SYSTEM ADMIN DASHBOARD (Technical Monitoring Only) ====================
    if (role === 'SYSTEM_ADMIN') {
      const [
        totalUsers,
        activeUsers,
        inactiveUsers,
        pendingActivation,
        usersByRole,
        recentAuditLogs,
        totalAuditLogs,
        securityAlertsCount,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isActive: false } }),
        prisma.user.count({ where: { lastLoginAt: null } }),
        prisma.user.groupBy({
          by: ['role'],
          _count: { id: true },
        }),
        prisma.auditLog.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, username: true, fullName: true, role: true } },
          },
        }),
        prisma.auditLog.count(),
        prisma.auditLog.count({
          where: {
            OR: [
              { action: { contains: 'REJECT' } },
              { action: { contains: 'DENIED' } },
              { action: { contains: 'BLOCK' } },
              { action: { contains: 'DEACTIVATE' } },
            ],
          },
        }),
      ]);

      const roleBreakdown = usersByRole.reduce((acc, curr) => {
        acc[curr.role] = curr._count.id;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        success: true,
        role: 'sysadmin',
        stats: [
          { label: 'User accounts', value: totalUsers.toString(), note: `${activeUsers} active, ${inactiveUsers} inactive`, icon: 'farmer' },
          { label: 'Active accounts', value: activeUsers.toString(), note: 'Operational enabled', icon: 'check' },
          { label: 'Pending first login', value: pendingActivation.toString(), note: 'Awaiting first setup', icon: 'time' },
          { label: 'Security events', value: securityAlertsCount.toString(), note: 'Audit flags recorded', icon: 'alert' },
        ],
        technicalMetrics: {
          totalUsers,
          activeUsers,
          inactiveUsers,
          pendingFirstLogin: pendingActivation,
          usersByRole: roleBreakdown,
          totalAuditLogs,
          securityAlertsCount,
        },
        recentAuditLogs,
        systemHealth: {
          appStatus: 'Operational',
          dbStatus: 'Connected',
          port: process.env.PORT || 5000,
          uptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
          memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        },
      });
      return;
    }

    res.status(403).json({ success: false, message: 'Invalid role for dashboard' });
  } catch (error: any) {
    console.error('Error generating dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve dashboard metrics', error: error.message });
  }
};
