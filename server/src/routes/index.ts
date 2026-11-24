import { Router } from 'express';
import { authenticateJWT, requireRole, requireStationScope, disallowAdminOperational } from '../middleware/auth.js';
import { uploadFarmerPhoto, uploadUserAvatar } from '../middleware/upload.js';
import * as authCtrl from '../controllers/auth.controller.js';
import * as farmerCtrl from '../controllers/farmer.controller.js';
import * as allocCtrl from '../controllers/allocation.controller.js';
import * as reqCtrl from '../controllers/request.controller.js';
import * as tradeCtrl from '../controllers/trade.controller.js';
import * as verifyCtrl from '../controllers/verification.controller.js';
import * as txCtrl from '../controllers/transaction.controller.js';
import * as reportCtrl from '../controllers/report.controller.js';
import * as sysCtrl from '../controllers/system.controller.js';
import * as dashCtrl from '../controllers/dashboard.controller.js';
import prisma from '../config/db.js';

const router = Router();

// ==================== AUTH ROUTES ====================
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', authenticateJWT, authCtrl.getMe);
router.put('/auth/profile', authenticateJWT, uploadUserAvatar.single('avatar'), authCtrl.updateProfile);
router.post('/auth/logout', authenticateJWT, authCtrl.logout);
router.post('/auth/change-password', authenticateJWT, authCtrl.changePassword);

// ==================== DASHBOARD ====================
router.get('/dashboard/stats', authenticateJWT, dashCtrl.getDashboardStats);

// ==================== METADATA HELPERS (Kebeles, FuelTypes, Stations) ====================
router.get('/meta/kebeles', authenticateJWT, async (_req, res) => {
  const kebeles = await prisma.kebele.findMany({
    include: { location: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, kebeles });
});

router.get('/meta/fuel-types', authenticateJWT, async (_req, res) => {
  const fuelTypes = await prisma.fuelType.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, fuelTypes });
});

router.get('/meta/stations', authenticateJWT, tradeCtrl.listFuelStations);

// ==================== AGRICULTURE OFFICE MODULES ====================
// System Administrator strictly blocked from operational actions
router.get('/farmers', authenticateJWT, disallowAdminOperational, farmerCtrl.listFarmers);
router.get('/farmers/:id', authenticateJWT, disallowAdminOperational, farmerCtrl.getFarmerById);
router.post(
  '/farmers',
  authenticateJWT,
  requireRole('AGRICULTURE_OFFICE'),
  uploadFarmerPhoto.single('photo'),
  farmerCtrl.createFarmer
);
router.put(
  '/farmers/:id',
  authenticateJWT,
  requireRole('AGRICULTURE_OFFICE'),
  uploadFarmerPhoto.single('photo'),
  farmerCtrl.updateFarmer
);
router.post(
  '/farmers/:id/photo',
  authenticateJWT,
  requireRole('AGRICULTURE_OFFICE'),
  uploadFarmerPhoto.single('photo'),
  farmerCtrl.uploadFarmerPhoto
);
router.post(
  '/farmers/:id/cards/log-print',
  authenticateJWT,
  requireRole('AGRICULTURE_OFFICE'),
  farmerCtrl.logCardPrint
);
router.post(
  '/farmers/bulk-import',
  authenticateJWT,
  requireRole('AGRICULTURE_OFFICE'),
  farmerCtrl.bulkImportFarmers
);
router.post(
  '/farmers/:farmerId/cards/issue',
  authenticateJWT,
  requireRole('AGRICULTURE_OFFICE'),
  farmerCtrl.issueOrRegenerateCard
);

// Allocations
router.get('/allocations', authenticateJWT, disallowAdminOperational, allocCtrl.listAllocations);
router.get('/allocations/summary', authenticateJWT, disallowAdminOperational, allocCtrl.getAllocationSummary);
router.post(
  '/allocations',
  authenticateJWT,
  requireRole('AGRICULTURE_OFFICE'),
  allocCtrl.createAllocation
);

// Fuel Requests to Trade
router.get('/fuel-requests', authenticateJWT, disallowAdminOperational, reqCtrl.listRequests);
router.get('/fuel-requests/:id', authenticateJWT, disallowAdminOperational, reqCtrl.getRequestById);
router.post(
  '/fuel-requests',
  authenticateJWT,
  requireRole('AGRICULTURE_OFFICE'),
  reqCtrl.createFuelRequest
);

// ==================== TRADE OFFICE MODULES ====================
router.post(
  '/trade/review-request/:id',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  tradeCtrl.reviewRequest
);
router.post(
  '/trade/assign-station',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  tradeCtrl.assignStation
);
router.get(
  '/trade/authorizations',
  authenticateJWT,
  disallowAdminOperational,
  tradeCtrl.listAuthorizations
);

// ==================== FUEL STATION MODULES ====================
router.post(
  '/verification/verify',
  authenticateJWT,
  requireRole('STATION_ADMIN'),
  requireStationScope,
  verifyCtrl.verifyFarmerForDispensing
);
router.post(
  '/transactions/dispense',
  authenticateJWT,
  requireRole('STATION_ADMIN'),
  requireStationScope,
  txCtrl.dispenseFuel
);
router.get('/transactions', authenticateJWT, disallowAdminOperational, txCtrl.listTransactions);

// ==================== REPORTS & MONITORING ====================
router.get('/reports/overview', authenticateJWT, disallowAdminOperational, reportCtrl.getReportsOverview);

// ==================== SYSTEM ADMINISTRATION ====================
// STRICTLY SYSTEM ADMIN ONLY
router.get('/system/users', authenticateJWT, requireRole('SYSTEM_ADMIN'), sysCtrl.listUsers);
router.post('/system/users', authenticateJWT, requireRole('SYSTEM_ADMIN'), sysCtrl.createUser);
router.put('/system/users/:id', authenticateJWT, requireRole('SYSTEM_ADMIN'), sysCtrl.updateUser);
router.post('/system/users/:id/reset-password', authenticateJWT, requireRole('SYSTEM_ADMIN'), sysCtrl.resetUserPassword);
router.get('/system/settings', authenticateJWT, requireRole('SYSTEM_ADMIN'), sysCtrl.listSettings);
router.put('/system/settings', authenticateJWT, requireRole('SYSTEM_ADMIN'), sysCtrl.updateSettings);
router.get('/system/health', authenticateJWT, requireRole('SYSTEM_ADMIN'), sysCtrl.getSystemHealth);
router.get('/system/audit-logs', authenticateJWT, requireRole('SYSTEM_ADMIN'), sysCtrl.listAuditLogs);

export default router;
