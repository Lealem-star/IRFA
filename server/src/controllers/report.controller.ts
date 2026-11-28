import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { EligibilityStatus, RequestStatus, VerificationResult, ShortageStatus } from '@prisma/client';

export const getReportsOverview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { periodMonth, periodYear } = req.query;
    const month = periodMonth ? parseInt(periodMonth as string) : new Date().getMonth() + 1;
    const year = periodYear ? parseInt(periodYear as string) : new Date().getFullYear();

    // 1. Allocation vs Consumption by Fuel Type
    const fuelTypes = await prisma.fuelType.findMany({ where: { isActive: true } });
    const fuelSummary = await Promise.all(
      fuelTypes.map(async (ft) => {
        const allocations = await prisma.monthlyAllocation.findMany({
          where: { fuelTypeId: ft.id, month, year },
        });

        const totalAllocated = allocations.reduce((acc, a) => acc + Number(a.allocatedLiters), 0);
        const totalUsed = allocations.reduce((acc, a) => acc + Number(a.usedLiters), 0);
        const totalRemaining = allocations.reduce((acc, a) => acc + Number(a.remainingLiters), 0);

        return {
          fuelType: ft.name,
          code: ft.code,
          totalAllocated,
          totalUsed,
          totalRemaining,
          usageRate: totalAllocated > 0 ? Math.round((totalUsed / totalAllocated) * 100) : 0,
        };
      })
    );

    // 2. Station Distribution Breakdown
    const stations = await prisma.fuelStation.findMany({
      where: { isActive: true },
      include: {
        transactions: {
          select: { quantityLiters: true, totalAmount: true },
        },
        _count: {
          select: { assignments: true, transactions: true, subCityAssignments: true },
        },
      },
    });

    const stationSummary = stations.map((st) => {
      const dispensedLiters = st.transactions.reduce((acc, t) => acc + Number(t.quantityLiters), 0);
      const totalRevenue = st.transactions.reduce((acc, t) => acc + Number(t.totalAmount), 0);
      return {
        id: st.id,
        name: st.name,
        code: st.code,
        location: st.location,
        assignedFarmers: st._count.assignments,
        subCityAssignmentsCount: st._count.subCityAssignments,
        totalTransactions: st._count.transactions,
        dispensedLiters,
        totalRevenueBirr: totalRevenue,
      };
    });

    // 3. Farmer Eligibility Breakdown
    const [eligibleCount, underReviewCount, suspendedCount, ineligibleCount] = await Promise.all([
      prisma.farmer.count({ where: { eligibilityStatus: EligibilityStatus.ELIGIBLE } }),
      prisma.farmer.count({ where: { eligibilityStatus: EligibilityStatus.UNDER_REVIEW } }),
      prisma.farmer.count({ where: { eligibilityStatus: EligibilityStatus.SUSPENDED } }),
      prisma.farmer.count({ where: { eligibilityStatus: EligibilityStatus.INELIGIBLE } }),
    ]);

    // 4. Suspended Farmers List
    const suspendedFarmers = await prisma.farmer.findMany({
      where: { eligibilityStatus: EligibilityStatus.SUSPENDED },
      include: { kebele: true, subCity: true },
      take: 20,
    });

    res.json({
      success: true,
      period: { month, year },
      fuelSummary,
      stationSummary,
      farmerStats: {
        eligible: eligibleCount,
        underReview: underReviewCount,
        suspended: suspendedCount,
        ineligible: ineligibleCount,
        total: eligibleCount + underReviewCount + suspendedCount + ineligibleCount,
      },
      suspendedFarmers,
    });
  } catch (error: any) {
    console.error('Error in getReportsOverview:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report', error: error.message });
  }
};

export const getAgricultureReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { subCityId } = req.query;
    const whereFarmer: any = {};
    if (subCityId) {
      whereFarmer.subCityId = String(subCityId);
    }

    const [
      farmersByEligibility,
      subCityBreakdown,
      requestsByStatus,
      recentRequests,
      fuelAllocationsTotal,
    ] = await Promise.all([
      prisma.farmer.groupBy({
        by: ['eligibilityStatus'],
        where: whereFarmer,
        _count: { id: true },
      }),
      prisma.subCity.findMany({
        include: {
          kebeles: { select: { id: true, name: true, code: true, _count: { select: { farmers: true } } } },
          _count: { select: { farmers: true } },
        },
      }),
      prisma.fuelRequest.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { totalLitersRequested: true, totalLitersApproved: true },
      }),
      prisma.fuelRequest.findMany({
        take: 15,
        orderBy: { submittedAt: 'desc' },
        include: {
          submittedBy: { select: { id: true, fullName: true, username: true } },
          reviewedBy: { select: { id: true, fullName: true, username: true } },
        },
      }),
      prisma.monthlyAllocation.aggregate({
        _sum: { allocatedLiters: true, usedLiters: true, remainingLiters: true },
      }),
    ]);

    const eligibilityCounts = farmersByEligibility.reduce((acc, curr) => {
      acc[curr.eligibilityStatus] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      reportType: 'AGRICULTURE',
      generatedAt: new Date().toISOString(),
      eligibilityCounts,
      subCityBreakdown: subCityBreakdown.map((sc) => ({
        id: sc.id,
        code: sc.code,
        name: sc.name,
        totalFarmers: sc._count.farmers,
        kebeles: sc.kebeles.map((k) => ({ id: k.id, name: k.name, code: k.code, farmersCount: k._count.farmers })),
      })),
      requestsByStatus: requestsByStatus.map((r) => ({
        status: r.status,
        count: r._count.id,
        totalRequestedLiters: Number(r._sum.totalLitersRequested || 0),
        totalApprovedLiters: Number(r._sum.totalLitersApproved || 0),
      })),
      allocationsSummary: {
        totalAllocated: Number(fuelAllocationsTotal._sum.allocatedLiters || 0),
        totalUsed: Number(fuelAllocationsTotal._sum.usedLiters || 0),
        totalRemaining: Number(fuelAllocationsTotal._sum.remainingLiters || 0),
      },
      recentRequests,
    });
  } catch (error: any) {
    console.error('Error in getAgricultureReport:', error);
    res.status(500).json({ success: false, message: 'Failed to generate agriculture report', error: error.message });
  }
};

export const getTradeReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [
      stations,
      authorizationsSummary,
      activeShortages,
      recentAuthorizations,
    ] = await Promise.all([
      prisma.fuelStation.findMany({
        include: {
          users: {
            where: { role: 'STATION_ADMIN', isActive: true },
            select: { id: true, fullName: true, username: true },
          },
          subCityAssignments: {
            where: { status: 'ACTIVE' },
            include: { subCity: { select: { id: true, name: true, code: true } } },
          },
          transactions: {
            select: { quantityLiters: true, totalAmount: true },
          },
        },
      }),
      prisma.fuelAuthorization.aggregate({
        _sum: { authorizedLiters: true, consumedLiters: true, remainingLiters: true },
        _count: { id: true },
      }),
      prisma.fuelShortage.findMany({
        where: { status: { in: [ShortageStatus.REPORTED, ShortageStatus.UNDER_REVIEW, ShortageStatus.CONFIRMED] } },
        include: {
          fuelStation: { select: { id: true, name: true, code: true } },
          fuelType: { select: { id: true, name: true } },
          reportedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { reportedAt: 'desc' },
      }),
      prisma.fuelAuthorization.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: {
          farmer: { select: { id: true, fullName: true, farmerCode: true } },
          fuelType: { select: { id: true, name: true, code: true } },
        },
      }),
    ]);

    const stationReports = stations.map((st) => {
      const dispensedLiters = st.transactions.reduce((acc, t) => acc + Number(t.quantityLiters), 0);
      const totalRevenue = st.transactions.reduce((acc, t) => acc + Number(t.totalAmount), 0);
      return {
        id: st.id,
        code: st.code,
        name: st.name,
        location: st.location,
        isActive: st.isActive,
        representative: st.users[0] || null,
        subCitiesCovered: st.subCityAssignments.map((a) => a.subCity.name),
        transactionsCount: st.transactions.length,
        dispensedLiters,
        totalRevenueBirr: totalRevenue,
      };
    });

    res.json({
      success: true,
      reportType: 'TRADE',
      generatedAt: new Date().toISOString(),
      stationReports,
      authorizationsSummary: {
        totalAuthorizationsCount: authorizationsSummary._count.id,
        totalAuthorizedLiters: Number(authorizationsSummary._sum.authorizedLiters || 0),
        totalConsumedLiters: Number(authorizationsSummary._sum.consumedLiters || 0),
        totalRemainingLiters: Number(authorizationsSummary._sum.remainingLiters || 0),
      },
      activeShortages,
      recentAuthorizations,
    });
  } catch (error: any) {
    console.error('Error in getTradeReport:', error);
    res.status(500).json({ success: false, message: 'Failed to generate trade report', error: error.message });
  }
};

export const getStationReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let targetStationId: string | undefined;

    if (user.role === 'STATION_ADMIN') {
      if (!user.fuelStationId) {
        res.status(403).json({ success: false, message: 'Forbidden: Station representative is not assigned to a station' });
        return;
      }
      if (req.query.stationId && String(req.query.stationId) !== user.fuelStationId) {
        res.status(403).json({ success: false, message: 'Forbidden: Station representatives cannot access reports of another fuel station' });
        return;
      }
      targetStationId = user.fuelStationId;
    } else {
      targetStationId = req.query.stationId ? String(req.query.stationId) : undefined;
      if (!targetStationId) {
        res.status(400).json({ success: false, message: 'stationId query parameter is required for non-station users' });
        return;
      }
    }

    const [station, transactions, verificationLogs, shortages] = await Promise.all([
      prisma.fuelStation.findUnique({
        where: { id: targetStationId },
        include: {
          subCityAssignments: {
            where: { status: 'ACTIVE' },
            include: { subCity: { select: { id: true, name: true, code: true } } },
          },
        },
      }),
      prisma.fuelTransaction.findMany({
        where: { fuelStationId: targetStationId },
        include: {
          farmer: { select: { id: true, fullName: true, farmerCode: true } },
          fuelType: { select: { id: true, name: true, code: true } },
        },
        orderBy: { transactionDate: 'desc' },
      }),
      prisma.verificationLog.findMany({
        where: { fuelStationId: targetStationId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.fuelShortage.findMany({
        where: { fuelStationId: targetStationId },
        include: {
          fuelType: { select: { id: true, name: true, code: true } },
        },
        orderBy: { reportedAt: 'desc' },
      }),
    ]);

    if (!station) {
      res.status(404).json({ success: false, message: 'Fuel station not found' });
      return;
    }

    const totalDispensedLiters = transactions.reduce((acc, t) => acc + Number(t.quantityLiters), 0);
    const totalRevenueBirr = transactions.reduce((acc, t) => acc + Number(t.totalAmount), 0);

    const verificationSummary = {
      total: verificationLogs.length,
      successCount: verificationLogs.filter((v) => v.result === VerificationResult.SUCCESS).length,
      rejectedCount: verificationLogs.filter((v) => v.result === VerificationResult.REJECTED).length,
      rejectionBreakdown: verificationLogs.reduce((acc, v) => {
        if (v.result === VerificationResult.REJECTED) {
          const reason = v.rejectionReason || 'UNKNOWN';
          acc[reason] = (acc[reason] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
    };

    res.json({
      success: true,
      reportType: 'STATION',
      station: {
        id: station.id,
        code: station.code,
        name: station.name,
        location: station.location,
        isActive: station.isActive,
        subCitiesCovered: station.subCityAssignments.map((a) => a.subCity.name),
      },
      summary: {
        totalTransactions: transactions.length,
        totalDispensedLiters,
        totalRevenueBirr,
      },
      verificationSummary,
      shortages,
      recentTransactions: transactions.slice(0, 50),
    });
  } catch (error: any) {
    console.error('Error in getStationReport:', error);
    res.status(500).json({ success: false, message: 'Failed to generate station report', error: error.message });
  }
};

/**
 * SEC-05: CSV Formula Injection Protection
 * Neutralizes formula triggers (=, +, -, @, \t, \r) and escapes quotes per RFC 4180.
 */
export const sanitizeCsvCell = (val: any): string => {
  if (val === null || val === undefined) {
    return '""';
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : '0';
  }
  if (typeof val === 'boolean') {
    return val ? 'YES' : 'NO';
  }
  const str = String(val);
  // Check if raw string or trimmed string begins with formula trigger or tab/carriage return
  const isFormula = /^[=+\-@\t\r]/.test(str) || /^[=+\-@]/.test(str.trimStart());
  const safeStr = isFormula ? `'${str}` : str;
  return `"${safeStr.replace(/"/g, '""')}"`;
};

export const exportReportCsv = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { type = 'overview', periodMonth, periodYear, stationId } = req.query;

    if (user.role === 'STATION_ADMIN') {
      if (type !== 'station') {
        res.status(403).json({ success: false, message: 'Forbidden: Station representatives may only export station transaction reports' });
        return;
      }
      if (!user.fuelStationId) {
        res.status(403).json({ success: false, message: 'Forbidden: Station representative is not assigned to a station' });
        return;
      }
      if (stationId && String(stationId) !== user.fuelStationId) {
        res.status(403).json({ success: false, message: 'Forbidden: Station representatives cannot export records of another fuel station' });
        return;
      }
    } else if (user.role === 'AGRICULTURE_OFFICE') {
      if (type === 'trade') {
        res.status(403).json({ success: false, message: 'Forbidden: Agriculture Office cannot export Trade Office reports' });
        return;
      }
    }

    const month = periodMonth ? parseInt(periodMonth as string) : new Date().getMonth() + 1;
    const year = periodYear ? parseInt(periodYear as string) : new Date().getFullYear();

    let csvContent = '';
    let fileName = `irfa_report_${type}_${month}_${year}.csv`;

    if (type === 'agriculture') {
      const farmers = await prisma.farmer.findMany({
        include: { subCity: true, kebele: true },
        orderBy: { farmerCode: 'asc' },
      });
      const headers = ['Farmer Code', 'Full Name', 'Phone', 'Sub-City', 'Kebele', 'Eligibility Status', 'Active'];
      const rows = farmers.map((f) => [
        sanitizeCsvCell(f.farmerCode),
        sanitizeCsvCell(f.fullName),
        sanitizeCsvCell(f.phone),
        sanitizeCsvCell(f.subCity?.name || ''),
        sanitizeCsvCell(f.kebele?.name || ''),
        sanitizeCsvCell(f.eligibilityStatus),
        sanitizeCsvCell(f.isActive),
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    } else if (type === 'trade') {
      const stations = await prisma.fuelStation.findMany({
        include: {
          subCityAssignments: { where: { status: 'ACTIVE' }, include: { subCity: true } },
          users: { where: { role: 'STATION_ADMIN', isActive: true }, select: { fullName: true } },
          transactions: { select: { quantityLiters: true, totalAmount: true } },
        },
        orderBy: { code: 'asc' },
      });
      const headers = ['Station Code', 'Station Name', 'Location', 'Active Representative', 'Sub-Cities Covered', 'Total Transactions', 'Dispensed Volume (L)', 'Total Revenue (ETB)'];
      const rows = stations.map((st) => {
        const liters = st.transactions.reduce((acc, t) => acc + Number(t.quantityLiters), 0);
        const revenue = st.transactions.reduce((acc, t) => acc + Number(t.totalAmount), 0);
        const subCities = st.subCityAssignments.map((a) => a.subCity.name).join('; ');
        const rep = st.users[0]?.fullName || 'UNASSIGNED';
        return [
          sanitizeCsvCell(st.code),
          sanitizeCsvCell(st.name),
          sanitizeCsvCell(st.location),
          sanitizeCsvCell(rep),
          sanitizeCsvCell(subCities),
          sanitizeCsvCell(st.transactions.length),
          sanitizeCsvCell(liters),
          sanitizeCsvCell(revenue),
        ];
      });
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    } else if (type === 'station') {
      let targetStationId: string | undefined;
      if (user.role === 'STATION_ADMIN') {
        targetStationId = user.fuelStationId || undefined;
      } else if (stationId) {
        targetStationId = String(stationId);
      }
      if (!targetStationId) {
        res.status(400).json({ success: false, message: 'Station ID required for station CSV export' });
        return;
      }
      const transactions = await prisma.fuelTransaction.findMany({
        where: { fuelStationId: targetStationId },
        include: {
          farmer: { select: { farmerCode: true, fullName: true } },
          fuelType: { select: { name: true } },
          fuelStation: { select: { name: true, code: true } },
        },
        orderBy: { transactionDate: 'desc' },
      });
      const headers = ['Receipt Number', 'Station Code', 'Farmer Code', 'Farmer Name', 'Fuel Type', 'Quantity (L)', 'Price/Liter', 'Total Amount (ETB)', 'Transaction Date', 'Status'];
      const rows = transactions.map((t) => [
        sanitizeCsvCell(t.receiptNumber),
        sanitizeCsvCell(t.fuelStation.code),
        sanitizeCsvCell(t.farmer.farmerCode),
        sanitizeCsvCell(t.farmer.fullName),
        sanitizeCsvCell(t.fuelType.name),
        sanitizeCsvCell(Number(t.quantityLiters)),
        sanitizeCsvCell(Number(t.pricePerLiter)),
        sanitizeCsvCell(Number(t.totalAmount)),
        sanitizeCsvCell(t.transactionDate.toISOString()),
        sanitizeCsvCell(t.status),
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    } else {
      // Default: overview
      const stations = await prisma.fuelStation.findMany({
        where: { isActive: true },
        include: {
          transactions: { select: { quantityLiters: true, totalAmount: true } },
          _count: { select: { assignments: true, transactions: true } },
        },
        orderBy: { code: 'asc' },
      });
      const headers = ['Station Name', 'Station Code', 'Location', 'Assigned Farmers', 'Total Transactions', 'Dispensed Volume (L)', 'Total Revenue (ETB)'];
      const rows = stations.map((st) => [
        sanitizeCsvCell(st.name),
        sanitizeCsvCell(st.code),
        sanitizeCsvCell(st.location),
        sanitizeCsvCell(st._count.assignments),
        sanitizeCsvCell(st._count.transactions),
        sanitizeCsvCell(st.transactions.reduce((acc, t) => acc + Number(t.quantityLiters), 0)),
        sanitizeCsvCell(st.transactions.reduce((acc, t) => acc + Number(t.totalAmount), 0)),
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(csvContent);
  } catch (error: any) {
    console.error('Error in exportReportCsv:', error);
    res.status(500).json({ success: false, message: 'Failed to export CSV report', error: error.message });
  }
};
