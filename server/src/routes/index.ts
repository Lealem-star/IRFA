import { Router } from 'express';
import { authenticateJWT, requireRole, requireStationScope, disallowAdminOperational } from '../middleware/auth.js';
import { uploadFarmerPhoto, uploadUserAvatar } from '../middleware/upload.js';
import * as authCtrl from '../controllers/auth.controller.js';
import * as farmerCtrl from '../controllers/farmer.controller.js';
import * as allocCtrl from '../controllers/allocation.controller.js';
import * as reqCtrl from '../controllers/request.controller.js';
import * as tradeCtrl from '../controllers/trade.controller.js';
import * as repCtrl from '../controllers/representative.controller.js';
import * as stationAllocCtrl from '../controllers/stationAllocation.controller.js';
import * as verifyCtrl from '../controllers/verification.controller.js';
import * as txCtrl from '../controllers/transaction.controller.js';
import * as reportCtrl from '../controllers/report.controller.js';
import * as shortageCtrl from '../controllers/shortage.controller.js';
import * as sysCtrl from '../controllers/system.controller.js';
import * as dashCtrl from '../controllers/dashboard.controller.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';
import prisma from '../config/db.js';

const router = Router();

// ==================== AUTH ROUTES ====================
router.post('/auth/login', loginRateLimiter(), authCtrl.login);
router.get('/auth/me', authenticateJWT, authCtrl.getMe);
router.put('/auth/profile', authenticateJWT, uploadUserAvatar.single('avatar'), authCtrl.updateProfile);
router.post('/auth/logout', authenticateJWT, authCtrl.logout);
router.post('/auth/change-password', authenticateJWT, authCtrl.changePassword);

// ==================== DASHBOARD ====================
router.get('/dashboard/stats', authenticateJWT, dashCtrl.getDashboardStats);

// ==================== METADATA HELPERS (SubCities, Kebeles, FuelTypes, Stations) ====================
router.get('/meta/sub-cities', authenticateJWT, async (_req, res) => {
  const subCities = await prisma.subCity.findMany({
    include: {
      kebeles: {
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, subCities });
});

router.get('/meta/kebeles', authenticateJWT, async (req, res) => {
  const { subCityId } = req.query;
  const where: any = {};
  if (subCityId) {
    where.subCityId = subCityId as string;
  }
  const kebeles = await prisma.kebele.findMany({
    where,
    include: { location: true, subCity: true },
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
// System Administrator strictly blocked from operational actions; restricted to Agriculture & Trade
router.get('/farmers', authenticateJWT, requireRole('AGRICULTURE_OFFICE', 'TRADE_OFFICE'), farmerCtrl.listFarmers);
router.get('/farmers/photo/:filename', authenticateJWT, disallowAdminOperational, farmerCtrl.getFarmerPhotoByFilename);
router.get('/farmers/:id/photo', authenticateJWT, disallowAdminOperational, farmerCtrl.getFarmerPhoto);
router.get('/farmers/:id', authenticateJWT, requireRole('AGRICULTURE_OFFICE', 'TRADE_OFFICE'), farmerCtrl.getFarmerById);
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
router.get('/allocations', authenticateJWT, requireRole('AGRICULTURE_OFFICE', 'TRADE_OFFICE'), allocCtrl.listAllocations);
router.get('/allocations/summary', authenticateJWT, requireRole('AGRICULTURE_OFFICE', 'TRADE_OFFICE'), allocCtrl.getAllocationSummary);
router.post(
  '/allocations',
  authenticateJWT,
  requireRole('AGRICULTURE_OFFICE'),
  allocCtrl.createAllocation
);

// Fuel Requests Management, Review & Resubmission (Agriculture Office)
router.get('/fuel-requests', authenticateJWT, requireRole('AGRICULTURE_OFFICE', 'TRADE_OFFICE'), reqCtrl.listRequests);
router.get('/fuel-requests/:id', authenticateJWT, requireRole('AGRICULTURE_OFFICE', 'TRADE_OFFICE'), reqCtrl.getRequestById);
router.post(
  '/fuel-requests',
  authenticateJWT,
  requireRole('AGRICULTURE_OFFICE'),
  reqCtrl.createFuelRequest
);
router.post(
  '/fuel-requests/:id/review',
  authenticateJWT,
  requireRole('AGRICULTURE_OFFICE'),
  reqCtrl.reviewFuelRequest
);
router.put(
  '/fuel-requests/:id',
  authenticateJWT,
  requireRole('AGRICULTURE_OFFICE'),
  reqCtrl.updateFuelRequest
);
router.post(
  '/fuel-requests/:id/resubmit',
  authenticateJWT,
  requireRole('AGRICULTURE_OFFICE'),
  reqCtrl.resubmitFuelRequest
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
  requireRole('TRADE_OFFICE', 'AGRICULTURE_OFFICE'),
  tradeCtrl.listAuthorizations
);
router.patch(
  '/trade/authorizations/:id/revoke',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  tradeCtrl.revokeAuthorization
);
router.post(
  '/trade/authorizations/:id/revoke',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  tradeCtrl.revokeAuthorization
);

// Fuel Station Representative Management (Trade Office Authority)
router.get(
  '/trade/representatives',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  repCtrl.listRepresentatives
);
router.post(
  '/trade/representatives',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  repCtrl.createRepresentative
);
router.patch(
  '/trade/representatives/:id/status',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  repCtrl.updateRepresentativeStatus
);
router.post(
  '/trade/representatives/:id/replace',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  repCtrl.replaceRepresentative
);
router.post(
  '/trade/representatives/:id/reassign',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  repCtrl.reassignRepresentative
);
router.post(
  '/trade/representatives/:id/reset-password',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  repCtrl.resetRepresentativePassword
);

// Station–Sub-City Allocation Management (Trade Office Authority)
router.get(
  '/trade/station-allocations',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  stationAllocCtrl.listStationAllocations
);
router.post(
  '/trade/station-allocations',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  stationAllocCtrl.createAllocation
);
router.put(
  '/trade/station-allocations/station/:stationId',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  stationAllocCtrl.setStationAllocations
);
router.patch(
  '/trade/station-allocations/:id/status',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  stationAllocCtrl.updateAllocationStatus
);
router.delete(
  '/trade/station-allocations/:id',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  stationAllocCtrl.deleteAllocation
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
router.get('/reports/overview', authenticateJWT, requireRole('AGRICULTURE_OFFICE', 'TRADE_OFFICE'), reportCtrl.getReportsOverview);
router.get('/reports/agriculture', authenticateJWT, requireRole('AGRICULTURE_OFFICE', 'TRADE_OFFICE'), reportCtrl.getAgricultureReport);
router.get('/reports/trade', authenticateJWT, requireRole('TRADE_OFFICE'), reportCtrl.getTradeReport);
router.get('/reports/station', authenticateJWT, requireRole('STATION_ADMIN', 'TRADE_OFFICE'), reportCtrl.getStationReport);
router.get('/reports/export', authenticateJWT, disallowAdminOperational, reportCtrl.exportReportCsv);

// ==================== FUEL SHORTAGE MANAGEMENT ====================
router.post(
  '/shortages',
  authenticateJWT,
  requireRole('TRADE_OFFICE', 'STATION_ADMIN'),
  shortageCtrl.reportShortage
);
router.get(
  '/shortages',
  authenticateJWT,
  disallowAdminOperational,
  shortageCtrl.listShortages
);
router.get(
  '/shortages/:id',
  authenticateJWT,
  disallowAdminOperational,
  shortageCtrl.getShortageById
);
router.patch(
  '/shortages/:id/review',
  authenticateJWT,
  requireRole('TRADE_OFFICE'),
  shortageCtrl.reviewShortage
);

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
