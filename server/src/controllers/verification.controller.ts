import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { verifyQrSchema } from '../validators/dispense.validator.js';
import { VerificationResult, AuthStatus, CardStatus, EligibilityStatus } from '@prisma/client';

export const verifyFarmerForDispensing = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { qrTokenOrCode } = verifyQrSchema.parse(req.body);
    const stationId = req.user!.fuelStationId;

    if (!stationId) {
      res.status(403).json({
        success: false,
        message: 'Security Violation: User is not linked to any active Fuel Station.',
      });
      return;
    }

    // Helper to log rejection attempt
    const logRejection = async (farmerId: string | null, reason: string, statusHttp = 400) => {
      await prisma.verificationLog.create({
        data: {
          fuelStationId: stationId,
          operatorId: req.user!.userId,
          farmerId: farmerId || null,
          scannedToken: qrTokenOrCode,
          result: VerificationResult.REJECTED,
          rejectionReason: reason,
          ipAddress: req.ip,
        },
      });

      res.status(statusHttp).json({
        success: false,
        verified: false,
        rejectionReason: reason,
      });
    };

    // 1. Check if farmer exists by QR Token or Farmer Code
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

    if (!card || !card.farmer) {
      await logRejection(null, 'Farmer record not found. Unrecognized QR identifier.', 404);
      return;
    }

    const { farmer } = card;

    // 2. Is Farmer Active?
    if (!farmer.isActive) {
      await logRejection(farmer.id, `Farmer account is inactive. Reason: ${farmer.suspensionReason || 'Deactivated'}`, 403);
      return;
    }

    // 3. Is Farmer Status ELIGIBLE?
    if (farmer.eligibilityStatus !== EligibilityStatus.ELIGIBLE) {
      await logRejection(farmer.id, `Farmer is not eligible for fuel access. Current status: ${farmer.eligibilityStatus}`, 403);
      return;
    }

    // 4. Is the Farmer Card ACTIVE?
    if (card.status !== CardStatus.ACTIVE) {
      await logRejection(farmer.id, `Farmer Card is not active (Status: ${card.status}). Reason: ${card.deactivationReason || 'Flagged/Inactive'}`, 403);
      return;
    }

    // 5 & 6 & 7. Check Trade Authorization for current date and assigned to THIS Station
    const now = new Date();
    const authorization = await prisma.fuelAuthorization.findFirst({
      where: {
        farmerId: farmer.id,
        status: AuthStatus.ACTIVE,
        validFrom: { lte: now },
        validTo: { gte: now },
        assignments: {
          some: {
            fuelStationId: stationId,
            status: 'ACTIVE',
          },
        },
      },
      include: {
        fuelType: true,
        assignments: {
          where: { fuelStationId: stationId },
          include: { fuelStation: true },
        },
      },
    });

    if (!authorization) {
      // Check if authorized elsewhere or expired
      const otherAuth = await prisma.fuelAuthorization.findFirst({
        where: {
          farmerId: farmer.id,
          status: AuthStatus.ACTIVE,
          validFrom: { lte: now },
          validTo: { gte: now },
        },
        include: {
          assignments: {
            include: { fuelStation: true },
          },
        },
      });

      if (otherAuth && otherAuth.assignments.length > 0) {
        const assignedName = otherAuth.assignments[0].fuelStation.name;
        await logRejection(
          farmer.id,
          `Station Mismatch: Farmer is authorized at ${assignedName}, not this station.`,
          403
        );
        return;
      }

      await logRejection(
        farmer.id,
        'No active Trade fuel authorization found for this period or station.',
        404
      );
      return;
    }

    // 8. Remaining balance check
    if (Number(authorization.remainingLiters) <= 0) {
      await logRejection(
        farmer.id,
        'Fuel quota completely exhausted. 0 Liters remaining for this period.',
        400
      );
      return;
    }

    // All 8 checks passed! Log SUCCESS
    await prisma.verificationLog.create({
      data: {
        fuelStationId: stationId,
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
          subCity: farmer.subCity?.name || farmer.kebele.subCity?.name || farmer.kebele.location?.name || 'Bahir Dar',
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
          stationName: authorization.assignments[0]?.fuelStation.name,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Verification processing failed', error });
  }
};
