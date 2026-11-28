import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { verifyQrSchema } from '../validators/dispense.validator.js';
import { VerificationResult, AuthStatus, CardStatus, EligibilityStatus, AssignmentStatus, AllocationStatus } from '@prisma/client';

export const verifyFarmerForDispensing = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { qrTokenOrCode, fuelTypeId } = verifyQrSchema.parse(req.body);
    const stationId = req.user!.fuelStationId;

    if (!stationId) {
      res.status(403).json({
        success: false,
        verified: false,
        code: 'REPRESENTATIVE_NOT_ASSIGNED',
        rejectionReason: 'Security Violation: User is not linked to any active Fuel Station.',
      });
      return;
    }

    // Helper to log rejection attempt in verification_logs table
    const logRejection = async (farmerId: string | null, reason: string, code: string, statusHttp = 400) => {
      await prisma.verificationLog.create({
        data: {
          fuelStationId: stationId,
          operatorId: req.user!.userId,
          farmerId: farmerId || null,
          scannedToken: qrTokenOrCode,
          result: VerificationResult.REJECTED,
          rejectionReason: `[${code}] ${reason}`.slice(0, 191),
          ipAddress: req.ip,
        },
      });

      res.status(statusHttp).json({
        success: false,
        verified: false,
        code,
        rejectionReason: reason,
      });
    };

    // -------------------------------------------------------------
    // 1. REVALIDATE STATION & REPRESENTATIVE AUTHORIZATION
    // -------------------------------------------------------------
    const operator = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { fuelStation: true },
    });

    if (!operator || !operator.isActive) {
      await logRejection(null, 'Station representative account is deactivated.', 'REPRESENTATIVE_INACTIVE', 403);
      return;
    }

    if (operator.fuelStationId !== stationId) {
      await logRejection(null, 'Representative is not authorized for this fuel station.', 'REPRESENTATIVE_UNAUTHORIZED', 403);
      return;
    }

    const station = operator.fuelStation;
    if (!station || !station.isActive) {
      await logRejection(null, 'Fuel station is currently inactive or deactivated.', 'STATION_INACTIVE', 400);
      return;
    }

    // -------------------------------------------------------------
    // 2. LOOKUP FARMER (QR Token / Serial Number / Farmer Code / National ID)
    // -------------------------------------------------------------
    const card = await prisma.farmerCard.findFirst({
      where: {
        OR: [
          { qrToken: qrTokenOrCode },
          { cardSerialNumber: qrTokenOrCode },
          { farmer: { farmerCode: qrTokenOrCode } },
          { farmer: { nationalId: qrTokenOrCode } },
        ],
      },
      include: {
        farmer: {
          include: {
            subCity: true,
            kebele: { include: { location: true, subCity: true } },
            irrigationProfile: true,
          },
        },
      },
    });

    let farmer: any = card?.farmer;
    if (!farmer) {
      // Fallback: direct farmer code, phone, or nationalId lookup
      farmer = await prisma.farmer.findFirst({
        where: {
          OR: [
            { farmerCode: qrTokenOrCode },
            { nationalId: qrTokenOrCode },
            { phone: qrTokenOrCode },
          ],
        },
        include: {
          subCity: true,
          kebele: { include: { location: true, subCity: true } },
          irrigationProfile: true,
        },
      });
    }

    if (!farmer) {
      await logRejection(null, 'Farmer record not found. Unrecognized QR code or identifier.', 'FARMER_NOT_FOUND', 404);
      return;
    }

    // -------------------------------------------------------------
    // 3. FARMER ACTIVE & ELIGIBILITY STATUS
    // -------------------------------------------------------------
    if (!farmer.isActive) {
      await logRejection(
        farmer.id,
        `Farmer account is inactive. Reason: ${farmer.suspensionReason || 'Deactivated'}`,
        'FARMER_INACTIVE',
        403
      );
      return;
    }

    if (farmer.eligibilityStatus !== EligibilityStatus.ELIGIBLE) {
      await logRejection(
        farmer.id,
        `Farmer is not eligible for fuel access. Current status: ${farmer.eligibilityStatus}`,
        'FARMER_NOT_ELIGIBLE',
        403
      );
      return;
    }

    // -------------------------------------------------------------
    // 4. FARMER CARD STATUS (if resolved via card)
    // -------------------------------------------------------------
    if (card && card.status !== CardStatus.ACTIVE) {
      await logRejection(
        farmer.id,
        `Farmer Card is not active (Status: ${card.status}). Reason: ${card.deactivationReason || 'Flagged/Inactive'}`,
        'CARD_INACTIVE',
        403
      );
      return;
    }

    // -------------------------------------------------------------
    // 5. MONTHLY FUEL AUTHORIZATION & VALIDITY PERIOD
    // -------------------------------------------------------------
    const now = new Date();
    const activeAuthorizations = await prisma.fuelAuthorization.findMany({
      where: {
        farmerId: farmer.id,
        status: AuthStatus.ACTIVE,
      },
      include: {
        fuelType: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeAuthorizations.length === 0) {
      // Check for past or exhausted authorizations to give explicit feedback
      const pastAuth = await prisma.fuelAuthorization.findFirst({
        where: { farmerId: farmer.id },
        orderBy: { createdAt: 'desc' },
      });

      if (pastAuth && pastAuth.status === AuthStatus.REVOKED) {
        await logRejection(
          farmer.id,
          'Fuel authorization has been revoked by the Trade Office.',
          'AUTHORIZATION_REVOKED',
          400
        );
        return;
      }

      if (pastAuth && pastAuth.validTo < now) {
        await logRejection(
          farmer.id,
          'Fuel authorization has expired. Please contact Agriculture Office for monthly renewal.',
          'AUTHORIZATION_EXPIRED',
          400
        );
        return;
      }

      if (pastAuth && pastAuth.status === AuthStatus.EXHAUSTED) {
        await logRejection(
          farmer.id,
          'Monthly fuel quota has been completely consumed (0 Liters remaining).',
          'QUOTA_EXHAUSTED',
          400
        );
        return;
      }

      await logRejection(
        farmer.id,
        'No active monthly fuel authorization found for this period.',
        'NO_ACTIVE_AUTHORIZATION',
        404
      );
      return;
    }

    // Filter by valid period
    const validPeriodAuths = activeAuthorizations.filter((a) => a.validFrom <= now && a.validTo >= now);
    if (validPeriodAuths.length === 0) {
      await logRejection(
        farmer.id,
        'Fuel authorization is not within its valid active period.',
        'AUTHORIZATION_EXPIRED',
        400
      );
      return;
    }

    // -------------------------------------------------------------
    // 6. FUEL TYPE MATCHING
    // -------------------------------------------------------------
    let authorization = validPeriodAuths[0];
    if (fuelTypeId) {
      const matched = validPeriodAuths.find((a) => a.fuelTypeId === fuelTypeId);
      if (!matched) {
        await logRejection(
          farmer.id,
          'Requested fuel type does not match approved authorization.',
          'FUEL_TYPE_MISMATCH',
          400
        );
        return;
      }
      authorization = matched;
    }

    // -------------------------------------------------------------
    // 7. REMAINING QUOTA CHECK
    // -------------------------------------------------------------
    if (Number(authorization.remainingLiters) <= 0) {
      await logRejection(
        farmer.id,
        'Monthly fuel quota has been completely consumed (0 Liters remaining for this period).',
        'QUOTA_EXHAUSTED',
        400
      );
      return;
    }

    // Check applicable monthly allocation quota if one exists
    const authMonth = authorization.validFrom.getMonth() + 1;
    const authYear = authorization.validFrom.getFullYear();
    const monthlyAlloc = await prisma.monthlyAllocation.findFirst({
      where: {
        farmerId: farmer.id,
        fuelTypeId: authorization.fuelTypeId,
        month: authMonth,
        year: authYear,
      },
    });

    if (!monthlyAlloc) {
      await logRejection(
        farmer.id,
        'No active monthly fuel allocation found for this period.',
        'NO_MONTHLY_ALLOCATION',
        400
      );
      return;
    }

    if (monthlyAlloc.status === AllocationStatus.EXHAUSTED || Number(monthlyAlloc.remainingLiters) <= 0) {
      await logRejection(
        farmer.id,
        'Monthly fuel allocation quota has been completely consumed (0 Liters remaining for this period).',
        'MONTHLY_ALLOCATION_EXHAUSTED',
        400
      );
      return;
    }

    if (monthlyAlloc.status !== AllocationStatus.ACTIVE) {
      await logRejection(
        farmer.id,
        `Monthly fuel allocation is not active (status: ${monthlyAlloc.status}).`,
        'ALLOCATION_INACTIVE',
        400
      );
      return;
    }

    // -------------------------------------------------------------
    // 8. MANDATORY STATION-TO-SUB-CITY ALLOCATION ENFORCEMENT
    // -------------------------------------------------------------
    const subCityId = farmer.subCityId || farmer.kebele?.subCityId;
    const subCityName = farmer.subCity?.name || farmer.kebele?.subCity?.name || farmer.kebele?.name || 'registered';

    if (!subCityId) {
      await logRejection(
        farmer.id,
        'Farmer profile is not assigned to a registered Sub-City.',
        'SUBCITY_NOT_ASSIGNED',
        400
      );
      return;
    }

    const activeAllocation = await prisma.stationSubCityAssignment.findFirst({
      where: {
        subCityId,
        fuelStationId: station.id,
        status: AssignmentStatus.ACTIVE,
      },
      include: {
        subCity: true,
        fuelStation: true,
      },
    });

    if (!activeAllocation) {
      await logRejection(
        farmer.id,
        `Station Not Authorized: Station '${station.name}' is not currently authorized by the Trade Office to serve farmers from '${subCityName}' Sub-City. Please direct the farmer to an authorized fuel station for their Sub-City.`,
        'STATION_NOT_ALLOCATED_TO_SUBCITY',
        403
      );
      return;
    }

    // -------------------------------------------------------------
    // 9. VERIFICATION SUCCESS — LOG ATTEMPT WITHOUT DECREMENTING QUOTA
    // -------------------------------------------------------------
    await prisma.verificationLog.create({
      data: {
        fuelStationId: station.id,
        operatorId: req.user!.userId,
        farmerId: farmer.id,
        scannedToken: qrTokenOrCode,
        result: VerificationResult.SUCCESS,
        ipAddress: req.ip,
      },
    });

    res.json({
      success: true,
      verified: true,
      message: 'Farmer identity and fuel authorization verified successfully',
      data: {
        farmer: {
          id: farmer.id,
          farmerCode: farmer.farmerCode,
          fullName: farmer.fullName,
          phone: farmer.phone,
          photoUrl: farmer.photoUrl,
          kebele: farmer.kebele.name,
          subCity: subCityName,
          subCityId,
          landSize: farmer.irrigationProfile?.landSizeHectares,
          waterSource: farmer.irrigationProfile?.waterSource,
          pumpFuelType: farmer.irrigationProfile?.pumpFuelType,
          pumpHorsepower: farmer.irrigationProfile?.pumpHorsepower,
        },
        authorization: {
          id: authorization.id,
          authCode: authorization.authCode,
          fuelType: authorization.fuelType.name,
          fuelTypeCode: authorization.fuelType.code,
          pricePerLiter: authorization.fuelType.currentPricePerLiter,
          authorizedLiters: authorization.authorizedLiters,
          consumedLiters: authorization.consumedLiters,
          remainingLiters: authorization.remainingLiters,
          validFrom: authorization.validFrom,
          validTo: authorization.validTo,
          stationName: station.name,
          stationCode: station.code,
        },
        allocation: {
          id: activeAllocation.id,
          subCityName: activeAllocation.subCity.name,
          stationName: station.name,
          status: activeAllocation.status,
        },
        monthlyAllocation: monthlyAlloc
          ? {
              id: monthlyAlloc.id,
              month: monthlyAlloc.month,
              year: monthlyAlloc.year,
              allocatedLiters: monthlyAlloc.allocatedLiters,
              usedLiters: monthlyAlloc.usedLiters,
              remainingLiters: monthlyAlloc.remainingLiters,
              status: monthlyAlloc.status,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('Verification error:', error);
    res.status(500).json({ success: false, verified: false, message: 'Verification processing failed', error: error?.message });
  }
};
