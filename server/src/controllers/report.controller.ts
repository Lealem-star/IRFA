import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { EligibilityStatus } from '@prisma/client';

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
          select: { assignments: true, transactions: true },
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
      include: { kebele: true },
      take: 10,
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
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate report', error });
  }
};
