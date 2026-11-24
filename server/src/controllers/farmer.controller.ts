import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { createFarmerSchema, updateFarmerSchema } from '../validators/farmer.validator.js';
import { logAudit } from '../middleware/audit.js';
import { EligibilityStatus, CardStatus, WaterSource } from '@prisma/client';
import crypto from 'crypto';

// Helper to generate next Farmer ID e.g. FR-00130
const generateFarmerCode = async (): Promise<string> => {
  const count = await prisma.farmer.count();
  const nextNum = (count + 125).toString().padStart(5, '0');
  return `FR-${nextNum}`;
};

export const listFarmers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, kebeleId, eligibilityStatus, fuelType, page = '1', limit = '15' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search as string } },
        { farmerCode: { contains: search as string } },
        { phone: { contains: search as string } },
        { nationalId: { contains: search as string } },
      ];
    }

    if (kebeleId) {
      where.kebeleId = kebeleId as string;
    }

    if (eligibilityStatus) {
      where.eligibilityStatus = eligibilityStatus as EligibilityStatus;
    }

    if (fuelType) {
      where.irrigationProfile = {
        pumpFuelType: fuelType as string,
      };
    }

    const [total, farmers] = await Promise.all([
      prisma.farmer.count({ where }),
      prisma.farmer.findMany({
        where,
        skip,
        take,
        include: {
          kebele: {
            include: { location: true },
          },
          irrigationProfile: true,
          cards: {
            where: { status: CardStatus.ACTIVE },
            take: 1,
          },
          allocations: {
            take: 1,
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            include: { fuelType: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      data: farmers,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve farmers', error });
  }
};

export const getFarmerById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const farmer = await prisma.farmer.findFirst({
      where: {
        OR: [{ id }, { farmerCode: id }],
      },
      include: {
        kebele: {
          include: { location: true },
        },
        irrigationProfile: true,
        cards: {
          orderBy: { createdAt: 'desc' },
        },
        allocations: {
          include: { fuelType: true },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        },
        authorizations: {
          include: {
            fuelType: true,
            assignments: {
              include: { fuelStation: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        transactions: {
          include: {
            fuelStation: true,
            fuelType: true,
          },
          orderBy: { transactionDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!farmer) {
      res.status(404).json({ success: false, message: 'Farmer not found' });
      return;
    }

    res.json({ success: true, farmer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve farmer details', error });
  }
};

export const createFarmer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = createFarmerSchema.parse(req.body);

    const photoUrl = req.file ? `/uploads/farmers/${req.file.filename}` : data.photoUrl || null;
    const farmerCode = await generateFarmerCode();
    const cardSerialNumber = `BD-CARD-${new Date().getFullYear()}-${farmerCode.replace('FR-', '')}`;
    const qrToken = `QR-${farmerCode}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    const newFarmer = await prisma.farmer.create({
      data: {
        farmerCode,
        fullName: data.fullName,
        phone: data.phone,
        nationalId: data.nationalId || null,
        photoUrl,
        kebeleId: data.kebeleId,
        eligibilityStatus: EligibilityStatus.ELIGIBLE,
        isActive: true,
        irrigationProfile: {
          create: {
            landSizeHectares: data.landSizeHectares,
            waterSource: data.waterSource as WaterSource,
            waterSourceDetail: data.waterSourceDetail || null,
            pumpFuelType: data.pumpFuelType,
            pumpHorsepower: data.pumpHorsepower || null,
            pumpModel: data.pumpModel || null,
            primaryCrops: data.primaryCrops || null,
            irrigationSeason: data.irrigationSeason || 'Bega / Dry Season 2026',
          },
        },
        cards: {
          create: {
            cardSerialNumber,
            qrToken,
            status: CardStatus.ACTIVE,
            issuedAt: new Date(),
          },
        },
      },
      include: {
        kebele: true,
        irrigationProfile: true,
        cards: true,
      },
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'CREATE_FARMER',
      entityType: 'Farmer',
      entityId: newFarmer.id,
      details: { farmerCode, fullName: data.fullName },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Farmer registered successfully',
      farmer: newFarmer,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to register farmer', error });
  }
};

export const updateFarmer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = updateFarmerSchema.parse(req.body);

    const existing = await prisma.farmer.findUnique({
      where: { id },
      include: { irrigationProfile: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Farmer not found' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // If status changed to suspended, also update card status if needed
      if (data.eligibilityStatus === 'SUSPENDED' && existing.eligibilityStatus !== 'SUSPENDED') {
        await tx.farmerCard.updateMany({
          where: { farmerId: id, status: CardStatus.ACTIVE },
          data: {
            status: CardStatus.DEACTIVATED,
            deactivatedAt: new Date(),
            deactivationReason: data.suspensionReason || 'Farmer suspended by Agriculture Department',
          },
        });
      } else if (data.eligibilityStatus === 'ELIGIBLE' && existing.eligibilityStatus === 'SUSPENDED') {
        await tx.farmerCard.updateMany({
          where: { farmerId: id, status: CardStatus.DEACTIVATED },
          data: {
            status: CardStatus.ACTIVE,
            deactivatedAt: null,
            deactivationReason: null,
          },
        });
      }

      const photoUrl = req.file
        ? `/uploads/farmers/${req.file.filename}`
        : data.photoUrl !== undefined
        ? data.photoUrl
        : existing.photoUrl;

      return tx.farmer.update({
        where: { id },
        data: {
          fullName: data.fullName,
          phone: data.phone,
          nationalId: data.nationalId,
          photoUrl,
          kebeleId: data.kebeleId,
          eligibilityStatus: data.eligibilityStatus as EligibilityStatus,
          isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
          suspensionReason: data.suspensionReason,
          irrigationProfile: {
            upsert: {
              create: {
                landSizeHectares: data.landSizeHectares || 1.0,
                waterSource: (data.waterSource as WaterSource) || WaterSource.LAKE_TANA,
                waterSourceDetail: data.waterSourceDetail,
                pumpFuelType: data.pumpFuelType || 'Diesel',
                pumpHorsepower: data.pumpHorsepower,
                pumpModel: data.pumpModel,
                primaryCrops: data.primaryCrops,
                irrigationSeason: data.irrigationSeason,
              },
              update: {
                landSizeHectares: data.landSizeHectares,
                waterSource: data.waterSource as WaterSource,
                waterSourceDetail: data.waterSourceDetail,
                pumpFuelType: data.pumpFuelType,
                pumpHorsepower: data.pumpHorsepower,
                pumpModel: data.pumpModel,
                primaryCrops: data.primaryCrops,
                irrigationSeason: data.irrigationSeason,
              },
            },
          },
        },
        include: {
          kebele: true,
          irrigationProfile: true,
          cards: true,
        },
      });
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'UPDATE_FARMER',
      entityType: 'Farmer',
      entityId: id,
      details: { changes: data },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Farmer profile updated successfully',
      farmer: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update farmer profile', error });
  }
};

export const issueOrRegenerateCard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { farmerId } = req.params;
    const { reason = 'New or replacement card' } = req.body;

    const farmer = await prisma.farmer.findUnique({
      where: { id: farmerId },
    });

    if (!farmer) {
      res.status(404).json({ success: false, message: 'Farmer not found' });
      return;
    }

    if (farmer.eligibilityStatus !== EligibilityStatus.ELIGIBLE) {
      res.status(400).json({
        success: false,
        message: `Cannot issue card: Farmer status is ${farmer.eligibilityStatus}. Must be ELIGIBLE.`,
      });
      return;
    }

    // Deactivate prior active cards
    await prisma.farmerCard.updateMany({
      where: { farmerId, status: CardStatus.ACTIVE },
      data: {
        status: CardStatus.DEACTIVATED,
        deactivatedAt: new Date(),
        deactivationReason: 'Replaced with newly issued card',
      },
    });

    const cardSerialNumber = `BD-CARD-${new Date().getFullYear()}-${farmer.farmerCode.replace('FR-', '')}-${Date.now().toString().slice(-4)}`;
    const qrToken = `QR-${farmer.farmerCode}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    const newCard = await prisma.farmerCard.create({
      data: {
        farmerId,
        cardSerialNumber,
        qrToken,
        status: CardStatus.ACTIVE,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year validity
      },
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'ISSUE_FARMER_CARD',
      entityType: 'FarmerCard',
      entityId: newCard.id,
      details: { farmerId, serial: cardSerialNumber, reason },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Farmer QR card generated successfully',
      card: newCard,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate card', error });
  }
};

export const bulkImportFarmers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { farmers: list } = req.body;

    if (!Array.isArray(list) || list.length === 0) {
      res.status(400).json({ success: false, message: 'Farmer records array is required.' });
      return;
    }

    const defaultKebele = await prisma.kebele.findFirst();
    if (!defaultKebele) {
      res.status(400).json({ success: false, message: 'No Kebeles configured in the system.' });
      return;
    }

    let createdCount = 0;
    const errors: string[] = [];

    for (const item of list) {
      try {
        const farmerCode = await generateFarmerCode();
        const cardSerialNumber = `BD-CARD-${new Date().getFullYear()}-${farmerCode.replace('FR-', '')}`;
        const qrToken = `QR-${farmerCode}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

        await prisma.farmer.create({
          data: {
            farmerCode,
            fullName: item.fullName || 'Farmer',
            phone: item.phone || '+251 900 000 000',
            nationalId: item.nationalId || null,
            kebeleId: item.kebeleId || defaultKebele.id,
            eligibilityStatus: EligibilityStatus.ELIGIBLE,
            isActive: true,
            irrigationProfile: {
              create: {
                landSizeHectares: parseFloat(item.landSizeHectares) || 2.0,
                waterSource: WaterSource.LAKE_TANA,
                pumpFuelType: item.pumpFuelType || 'Diesel',
                pumpHorsepower: item.pumpHorsepower || '10 HP',
                primaryCrops: item.primaryCrops || 'Vegetables',
                irrigationSeason: 'Bega / Dry Season 2026',
              },
            },
            cards: {
              create: {
                cardSerialNumber,
                qrToken,
                status: CardStatus.ACTIVE,
                issuedAt: new Date(),
              },
            },
          },
        });
        createdCount++;
      } catch (err: any) {
        errors.push(`Error importing ${item.fullName}: ${err.message}`);
      }
    }

    await logAudit({
      userId: req.user?.userId,
      action: 'BULK_IMPORT_FARMERS',
      entityType: 'Farmer',
      details: { importedCount: createdCount, errorsCount: errors.length },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Successfully imported ${createdCount} farmers`,
      createdCount,
      errors,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to import farmers', error });
  }
};

export const uploadFarmerPhoto = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No image file uploaded' });
      return;
    }

    const farmer = await prisma.farmer.findFirst({
      where: { OR: [{ id }, { farmerCode: id }] },
    });

    if (!farmer) {
      res.status(404).json({ success: false, message: 'Farmer not found' });
      return;
    }

    const photoUrl = `/uploads/farmers/${req.file.filename}`;

    const updated = await prisma.farmer.update({
      where: { id: farmer.id },
      data: { photoUrl },
      include: {
        kebele: { include: { location: true } },
        irrigationProfile: true,
        cards: { where: { status: CardStatus.ACTIVE }, take: 1 },
      },
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'UPDATE_FARMER_PHOTO',
      entityType: 'Farmer',
      entityId: farmer.id,
      details: { farmerCode: farmer.farmerCode, photoUrl },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Farmer photo uploaded successfully',
      photoUrl,
      farmer: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to upload photo', error });
  }
};

export const logCardPrint = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { printType = 'SINGLE_BOTH', cardSerialNumber } = req.body;

    const farmer = await prisma.farmer.findFirst({
      where: { OR: [{ id }, { farmerCode: id }] },
      include: { cards: { where: { status: CardStatus.ACTIVE }, take: 1 } },
    });

    if (!farmer) {
      res.status(404).json({ success: false, message: 'Farmer not found' });
      return;
    }

    await logAudit({
      userId: req.user?.userId,
      action: 'PRINT_FARMER_CARD',
      entityType: 'FarmerCard',
      entityId: farmer.cards[0]?.id || farmer.id,
      details: {
        farmerId: farmer.id,
        farmerCode: farmer.farmerCode,
        cardSerialNumber: cardSerialNumber || farmer.cards[0]?.cardSerialNumber,
        printType,
        printedBy: req.user?.username,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Card print logged successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to log card print', error });
  }
};
