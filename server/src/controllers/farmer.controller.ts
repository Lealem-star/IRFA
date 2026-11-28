import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { createFarmerSchema, updateFarmerSchema, normalizeEthiopianPhone } from '../validators/farmer.validator.js';
import { logAudit } from '../middleware/audit.js';
import { EligibilityStatus, CardStatus, WaterSource } from '@prisma/client';
import crypto from 'crypto';

// Helper to generate next Farmer ID e.g. FR-00130, ensuring no collision
const generateFarmerCode = async (): Promise<string> => {
  let nextNum = (await prisma.farmer.count()) + 125;
  let code = `FR-${nextNum.toString().padStart(5, '0')}`;
  while (await prisma.farmer.findUnique({ where: { farmerCode: code } })) {
    nextNum++;
    code = `FR-${nextNum.toString().padStart(5, '0')}`;
  }
  return code;
};

export const listFarmers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, kebeleId, subCityId, eligibilityStatus, fuelType, page = '1', limit = '15' } = req.query;

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

    if (subCityId) {
      where.subCityId = subCityId as string;
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
          subCity: true,
          kebele: {
            include: { location: true, subCity: true },
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
        subCity: true,
        kebele: {
          include: { location: true, subCity: true },
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

    // Verify Kebele exists and strictly belongs to the selected Sub-City
    const kebele = await prisma.kebele.findUnique({
      where: { id: data.kebeleId },
      include: { subCity: true },
    });

    if (!kebele) {
      res.status(400).json({
        success: false,
        code: 'INVALID_KEBELE',
        field: 'kebeleId',
        message: 'Invalid Kebele selected / የተመረጠው ቀበሌ አልተገኘም',
      });
      return;
    }

    if (kebele.subCityId && data.subCityId && kebele.subCityId !== data.subCityId) {
      res.status(400).json({
        success: false,
        code: 'SUB_CITY_MISMATCH',
        field: 'kebeleId',
        message: 'Validation Error: Selected Kebele does not belong to the selected Sub-City / የተመረጠው ቀበሌ ከተመረጠው ክፍለ ከተማ ጋር አይዛመድም',
      });
      return;
    }

    // Phone normalization and uniqueness check
    const normalizedPhone = normalizeEthiopianPhone(data.phone);
    const cleanedPhone = data.phone.trim().replace(/[\s\-\(\)\.]/g, '');
    const existingPhone = await prisma.farmer.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { phone: data.phone.trim() },
          { phone: cleanedPhone },
        ],
      },
    });

    if (existingPhone) {
      res.status(409).json({
        success: false,
        code: 'DUPLICATE_PHONE',
        field: 'phone',
        message: 'A farmer with this phone number is already registered / በዚህ ስልክ ቁጥር የተመዘገበ አርሶ አደር አስቀድሞ አለ',
      });
      return;
    }

    // National ID uniqueness pre-check (if provided)
    if (data.nationalId) {
      const existingNationalId = await prisma.farmer.findFirst({
        where: { nationalId: data.nationalId },
      });

      if (existingNationalId) {
        res.status(409).json({
          success: false,
          code: 'DUPLICATE_NATIONAL_ID',
          field: 'nationalId',
          message: 'A farmer with this National/Kebele ID is already registered / በዚህ መታወቂያ ቁጥር የተመዘገበ አርሶ አደር አስቀድሞ አለ',
        });
        return;
      }
    }

    const normalizedGender =
      data.gender === 'Female' || data.gender === 'FEMALE' || data.gender === 'ሴት' ? 'ሴት' : 'ወንድ';

    const normalizedFuelType =
      data.pumpFuelType === 'Benzene' || data.pumpFuelType === 'ቤንዚል' || data.pumpFuelType === 'ቤንዚን'
        ? 'Benzene'
        : 'Diesel';

    const photoUrl = req.file ? `/uploads/farmers/${req.file.filename}` : data.photoUrl || null;
    const farmerCode = await generateFarmerCode();
    const cardSerialNumber = `BD-CARD-${new Date().getFullYear()}-${farmerCode.replace('FR-', '')}`;
    const qrToken = `QR-${farmerCode}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    const newFarmer = await prisma.farmer.create({
      data: {
        farmerCode,
        fullName: data.fullName,
        gender: normalizedGender,
        phone: normalizedPhone,
        nationalId: data.nationalId, // Guaranteed null or uppercase string by Zod
        photoUrl,
        subCityId: data.subCityId,
        kebeleId: data.kebeleId,
        declaredFuelLiters: data.declaredFuelLiters,
        eligibilityStatus: EligibilityStatus.ELIGIBLE,
        isActive: true,
        irrigationProfile: {
          create: {
            landSizeHectares: data.landSizeHectares,
            waterSource: data.waterSource as WaterSource,
            waterSourceDetail: data.waterSourceDetail || null,
            pumpFuelType: normalizedFuelType,
            pumpHorsepower: data.pumpHorsepower || null,
            pumpModel: data.pumpModel || null,
            primaryCrops: data.primaryCrops,
            declaredFuelLiters: data.declaredFuelLiters,
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
        subCity: true,
        kebele: {
          include: { location: true, subCity: true },
        },
        irrigationProfile: true,
        cards: true,
      },
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'CREATE_FARMER',
      entityType: 'Farmer',
      entityId: newFarmer.id,
      details: { farmerCode, fullName: data.fullName, subCityId: data.subCityId, kebeleId: data.kebeleId },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Farmer registered successfully',
      farmer: newFarmer,
    });
  } catch (error: any) {
    console.error('Farmer registration error:', error);

    // 1. Zod Validation Errors
    if (error.errors && Array.isArray(error.errors)) {
      const firstError = error.errors[0];
      const field = firstError?.path && firstError.path.length > 0 ? String(firstError.path[0]) : undefined;
      res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        field,
        message: firstError?.message || 'Validation failed / የማረጋገጫ ስህተት',
        errors: error.errors,
      });
      return;
    }

    // 2. Prisma P2002 Unique Constraint Violation
    if (error.code === 'P2002') {
      const target = String(error.meta?.target || '');
      if (target.includes('nationalId') || target.includes('national_id')) {
        res.status(409).json({
          success: false,
          code: 'DUPLICATE_NATIONAL_ID',
          field: 'nationalId',
          message: 'A farmer with this National/Kebele ID is already registered / በዚህ መታወቂያ ቁጥር የተመዘገበ አርሶ አደር አስቀድሞ አለ',
        });
        return;
      }
      if (target.includes('phone')) {
        res.status(409).json({
          success: false,
          code: 'DUPLICATE_PHONE',
          field: 'phone',
          message: 'A farmer with this phone number is already registered / በዚህ ስልክ ቁጥር የተመዘገበ አርሶ አደር አስቀድሞ አለ',
        });
        return;
      }
      if (target.includes('farmerCode') || target.includes('farmer_code')) {
        res.status(409).json({
          success: false,
          code: 'DUPLICATE_FARMER_CODE',
          field: 'farmerCode',
          message: 'Farmer code generation collision occurred, please retry / የአርሶ አደር መለያ ተደራራቢ ሆኗል፣ እባክዎ እንደገና ይሞክሩ',
        });
        return;
      }
      res.status(409).json({
        success: false,
        code: 'DUPLICATE_RECORD',
        message: 'A duplicate record already exists in the system / ተደራራቢ መረጃ አስቀድሞ ተመዝግቧል',
      });
      return;
    }

    // 3. Generic Server Error - sanitize and avoid leaking stack traces or internal drivers
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Failed to register farmer / አርሶ አደሩን መመዝገብ አልተቻለም',
    });
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
      res.status(404).json({ success: false, message: 'Farmer not found / አርሶ አደሩ አልተገኘም' });
      return;
    }

    // If phone is being updated, validate uniqueness against other farmers
    let normalizedPhone: string | undefined = undefined;
    if (data.phone) {
      normalizedPhone = normalizeEthiopianPhone(data.phone);
      const cleanedPhone = data.phone.trim().replace(/[\s\-\(\)\.]/g, '');
      const existingPhone = await prisma.farmer.findFirst({
        where: {
          id: { not: id },
          OR: [
            { phone: normalizedPhone },
            { phone: data.phone.trim() },
            { phone: cleanedPhone },
          ],
        },
      });

      if (existingPhone) {
        res.status(409).json({
          success: false,
          code: 'DUPLICATE_PHONE',
          field: 'phone',
          message: 'A farmer with this phone number is already registered / በዚህ ስልክ ቁጥር የተመዘገበ አርሶ አደር አስቀድሞ አለ',
        });
        return;
      }
    }

    // If nationalId is being updated and non-null, validate uniqueness against other farmers
    if (data.nationalId) {
      const existingNationalId = await prisma.farmer.findFirst({
        where: {
          id: { not: id },
          nationalId: data.nationalId,
        },
      });

      if (existingNationalId) {
        res.status(409).json({
          success: false,
          code: 'DUPLICATE_NATIONAL_ID',
          field: 'nationalId',
          message: 'A farmer with this National/Kebele ID is already registered / በዚህ መታወቂያ ቁጥር የተመዘገበ አርሶ አደር አስቀድሞ አለ',
        });
        return;
      }
    }

    const updated = await prisma.$transaction(
      async (tx) => {
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

      // If kebeleId is provided, check if it belongs to subCity
      const effectiveKebeleId = data.kebeleId || existing.kebeleId;
      const effectiveSubCityId = data.subCityId || existing.subCityId;

      if (data.kebeleId) {
        const kb = await tx.kebele.findUnique({ where: { id: data.kebeleId } });
        if (kb?.subCityId && effectiveSubCityId && kb.subCityId !== effectiveSubCityId) {
          throw new Error('Selected Kebele does not belong to the selected Sub-City');
        }
      }

      const photoUrl = req.file
        ? `/uploads/farmers/${req.file.filename}`
        : data.photoUrl !== undefined
        ? data.photoUrl
        : existing.photoUrl;

      const normalizedGender = data.gender
        ? data.gender === 'Female' || data.gender === 'FEMALE' || data.gender === 'ሴት'
          ? 'ሴት'
          : 'ወንድ'
        : existing.gender;

      const normalizedFuelType = data.pumpFuelType
        ? data.pumpFuelType === 'Benzene' || data.pumpFuelType === 'ቤንዚል' || data.pumpFuelType === 'ቤንዚን'
          ? 'Benzene'
          : 'Diesel'
        : undefined;

      return tx.farmer.update({
        where: { id },
        data: {
          fullName: data.fullName,
          gender: normalizedGender,
          phone: normalizedPhone !== undefined ? normalizedPhone : existing.phone,
          nationalId: data.nationalId !== undefined ? data.nationalId : existing.nationalId,
          photoUrl,
          subCityId: data.subCityId || existing.subCityId,
          kebeleId: data.kebeleId || existing.kebeleId,
          declaredFuelLiters: data.declaredFuelLiters !== undefined ? data.declaredFuelLiters : existing.declaredFuelLiters,
          eligibilityStatus: data.eligibilityStatus as EligibilityStatus,
          isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
          suspensionReason: data.suspensionReason,
          irrigationProfile: {
            upsert: {
              create: {
                landSizeHectares: data.landSizeHectares || 1.0,
                waterSource: (data.waterSource as WaterSource) || WaterSource.LAKE_TANA,
                waterSourceDetail: data.waterSourceDetail,
                pumpFuelType: normalizedFuelType || 'Diesel',
                pumpHorsepower: data.pumpHorsepower,
                pumpModel: data.pumpModel,
                primaryCrops: data.primaryCrops,
                declaredFuelLiters: data.declaredFuelLiters,
                irrigationSeason: data.irrigationSeason,
              },
              update: {
                landSizeHectares: data.landSizeHectares,
                waterSource: data.waterSource as WaterSource,
                waterSourceDetail: data.waterSourceDetail,
                pumpFuelType: normalizedFuelType,
                pumpHorsepower: data.pumpHorsepower,
                pumpModel: data.pumpModel,
                primaryCrops: data.primaryCrops,
                declaredFuelLiters: data.declaredFuelLiters,
                irrigationSeason: data.irrigationSeason,
              },
            },
          },
        },
        include: {
          subCity: true,
          kebele: {
            include: { location: true, subCity: true },
          },
          irrigationProfile: true,
          cards: true,
        },
      });
    }, { maxWait: 10000, timeout: 20000 });

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
  } catch (error: any) {
    console.error('Farmer update error:', error);

    // 1. Zod Validation Errors
    if (error.errors && Array.isArray(error.errors)) {
      const firstError = error.errors[0];
      const field = firstError?.path && firstError.path.length > 0 ? String(firstError.path[0]) : undefined;
      res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        field,
        message: firstError?.message || 'Validation failed / የማረጋገጫ ስህተት',
        errors: error.errors,
      });
      return;
    }

    // 2. Prisma P2002 Unique Constraint Violation
    if (error.code === 'P2002') {
      const target = String(error.meta?.target || '');
      if (target.includes('nationalId') || target.includes('national_id')) {
        res.status(409).json({
          success: false,
          code: 'DUPLICATE_NATIONAL_ID',
          field: 'nationalId',
          message: 'A farmer with this National/Kebele ID is already registered / በዚህ መታወቂያ ቁጥር የተመዘገበ አርሶ አደር አስቀድሞ አለ',
        });
        return;
      }
      if (target.includes('phone')) {
        res.status(409).json({
          success: false,
          code: 'DUPLICATE_PHONE',
          field: 'phone',
          message: 'A farmer with this phone number is already registered / በዚህ ስልክ ቁጥር የተመዘገበ አርሶ አደር አስቀድሞ አለ',
        });
        return;
      }
      res.status(409).json({
        success: false,
        code: 'DUPLICATE_RECORD',
        message: 'A duplicate record already exists in the system / ተደራራቢ መረጃ አስቀድሞ ተመዝግቧል',
      });
      return;
    }

    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to update farmer profile / የአርሶ አደር መረጃ ማዘመን አልተቻለም',
    });
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

/**
 * Helper to safely resolve the farmer uploads directory
 */
const getFarmerUploadDir = (): string => {
  const candidates = [
    path.resolve(process.cwd(), 'uploads/farmers'),
    path.resolve(process.cwd(), 'server/uploads/farmers'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
};

/**
 * Helper to safely stream a photo with security headers
 */
const sendSafePhoto = (filePath: string, res: Response): void => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  const contentType = mimeTypes[ext] || 'image/jpeg';

  res.setHeader('Content-Type', contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-transform, max-age=3600');
  res.setHeader('Content-Security-Policy', "default-src 'none'");

  res.sendFile(filePath);
};

/**
 * GET /api/farmers/:id/photo
 * Securely streams a farmer's photo by Farmer ID or Farmer Code
 */
export const getFarmerPhoto = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid farmer identifier.' });
      return;
    }

    const farmer = await prisma.farmer.findFirst({
      where: {
        OR: [{ id }, { farmerCode: id }],
      },
      select: {
        id: true,
        farmerCode: true,
        photoUrl: true,
      },
    });

    if (!farmer) {
      res.status(404).json({ success: false, message: 'Farmer not found.' });
      return;
    }

    if (!farmer.photoUrl) {
      res.status(404).json({ success: false, message: 'Farmer has no photo uploaded.' });
      return;
    }

    const filename = path.basename(farmer.photoUrl);
    const safeFilenameRegex = /^[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp)$/i;
    if (!safeFilenameRegex.test(filename)) {
      res.status(400).json({ success: false, message: 'Invalid photo filename.' });
      return;
    }

    const uploadDir = getFarmerUploadDir();
    const filePath = path.resolve(uploadDir, filename);

    // Path confinement check
    if (!filePath.startsWith(uploadDir)) {
      res.status(400).json({ success: false, message: 'Directory traversal attempt detected.' });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: 'Photo file not found on disk.' });
      return;
    }

    sendSafePhoto(filePath, res);
  } catch (error: any) {
    console.error('Error serving farmer photo by ID:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve farmer photo.', error: error?.message });
  }
};

/**
 * GET /api/farmers/photo/:filename
 * Securely streams a farmer's photo by filename with strict validation
 */
export const getFarmerPhotoByFilename = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    if (!filename || typeof filename !== 'string') {
      res.status(400).json({ success: false, message: 'Filename parameter is required.' });
      return;
    }

    // Strict filename format validation: only alphanumeric, underscore, hyphen, and valid extension
    const safeFilenameRegex = /^[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp)$/i;
    if (!safeFilenameRegex.test(filename)) {
      res.status(400).json({ success: false, message: 'Invalid or malformed photo filename.' });
      return;
    }

    const cleanFilename = path.basename(filename);
    const uploadDir = getFarmerUploadDir();
    const filePath = path.resolve(uploadDir, cleanFilename);

    // Path confinement check
    if (!filePath.startsWith(uploadDir)) {
      res.status(400).json({ success: false, message: 'Directory traversal attempt detected.' });
      return;
    }

    // Ensure photo belongs to a legitimate farmer in the system (no arbitrary file browsing)
    const farmerWithPhoto = await prisma.farmer.findFirst({
      where: {
        photoUrl: { contains: cleanFilename },
      },
      select: { id: true },
    });

    if (!farmerWithPhoto) {
      res.status(404).json({ success: false, message: 'Photo not associated with any registered farmer.' });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: 'Photo file not found on disk.' });
      return;
    }

    sendSafePhoto(filePath, res);
  } catch (error: any) {
    console.error('Error serving farmer photo by filename:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve farmer photo.', error: error?.message });
  }
};
