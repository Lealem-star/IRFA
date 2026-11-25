export type UserRole =
  | 'AGRICULTURE_OFFICE'
  | 'TRADE_OFFICE'
  | 'STATION_ADMIN'
  | 'SYSTEM_ADMIN';

export type EligibilityStatus = 'ELIGIBLE' | 'UNDER_REVIEW' | 'SUSPENDED' | 'INELIGIBLE';

export type CardStatus = 'ACTIVE' | 'PENDING' | 'LOST' | 'DEACTIVATED';

export type RequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PARTIALLY_APPROVED'
  | 'REJECTED'
  | 'RETURNED';

export type AuthStatus = 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'REVOKED';

export interface User {
  id: string;
  username: string;
  email?: string | null;
  fullName: string;
  avatarUrl?: string | null;
  role: UserRole;
  office?: {
    id: string;
    name: string;
    code: string;
    type: string;
  } | null;
  fuelStation?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface Kebele {
  id: string;
  name: string;
  code: string;
  locationId: string;
  location?: {
    id: string;
    name: string;
    subCity: string;
  };
}

export interface FuelType {
  id: string;
  name: string;
  nameAmharic?: string | null;
  code: string;
  unit: string;
  currentPricePerLiter: number | string;
  isActive: boolean;
}

export interface FuelStation {
  id: string;
  code: string;
  name: string;
  location: string;
  contactPerson?: string | null;
  phone?: string | null;
  licenseNumber?: string | null;
  isActive: boolean;
  _count?: {
    assignments: number;
    transactions: number;
  };
}

export interface FarmerIrrigationProfile {
  id: string;
  landSizeHectares: number | string;
  waterSource: string;
  waterSourceDetail?: string | null;
  pumpFuelType: string;
  pumpHorsepower?: string | null;
  pumpModel?: string | null;
  primaryCrops?: string | null;
  irrigationSeason?: string | null;
}

export interface FarmerCard {
  id: string;
  cardSerialNumber: string;
  qrToken: string;
  status: CardStatus;
  issuedAt: string;
  expiresAt?: string | null;
  deactivatedAt?: string | null;
  deactivationReason?: string | null;
}

export interface Farmer {
  id: string;
  farmerCode: string;
  fullName: string;
  phone: string;
  nationalId?: string | null;
  photoUrl?: string | null;
  kebeleId: string;
  kebele: Kebele;
  eligibilityStatus: EligibilityStatus;
  isActive: boolean;
  suspensionReason?: string | null;
  irrigationProfile?: FarmerIrrigationProfile | null;
  cards?: FarmerCard[];
  allocations?: MonthlyAllocation[];
  createdAt: string;
}

export interface MonthlyAllocation {
  id: string;
  farmerId: string;
  farmer?: Farmer;
  fuelTypeId: string;
  fuelType?: FuelType;
  month: number;
  year: number;
  allocatedLiters: number | string;
  usedLiters: number | string;
  remainingLiters: number | string;
  status: string;
  notes?: string | null;
  createdAt: string;
}

export interface FuelRequestItem {
  id: string;
  fuelRequestId: string;
  farmerId: string;
  farmer: Farmer;
  fuelTypeId: string;
  fuelType: FuelType;
  requestedLiters: number | string;
  approvedLiters: number | string;
  itemStatus: string;
  remarks?: string | null;
}

export interface FuelRequest {
  id: string;
  requestNumber: string;
  periodMonth: number;
  periodYear: number;
  title: string;
  totalFarmersCount: number;
  totalLitersRequested: number | string;
  totalLitersApproved: number | string;
  status: RequestStatus;
  submittedBy: {
    id: string;
    fullName: string;
    username: string;
  };
  submittedAt: string;
  reviewedBy?: {
    id: string;
    fullName: string;
    username: string;
  } | null;
  reviewedAt?: string | null;
  reviewRemarks?: string | null;
  items?: FuelRequestItem[];
}

export interface FuelAuthorization {
  id: string;
  authCode: string;
  fuelRequestId: string;
  fuelRequest?: {
    requestNumber: string;
    periodMonth: number;
    periodYear: number;
  };
  farmerId: string;
  farmer: Farmer;
  fuelTypeId: string;
  fuelType: FuelType;
  authorizedLiters: number | string;
  consumedLiters: number | string;
  remainingLiters: number | string;
  validFrom: string;
  validTo: string;
  status: AuthStatus;
  remarks?: string | null;
  assignments?: {
    id: string;
    fuelStationId: string;
    fuelStation: FuelStation;
    status: string;
  }[];
}

export interface FuelTransaction {
  id: string;
  receiptNumber: string;
  fuelStationId: string;
  fuelStation: FuelStation;
  operatorId: string;
  operator: {
    fullName: string;
    username: string;
  };
  farmerId: string;
  farmer: Farmer;
  fuelAuthorizationId: string;
  fuelTypeId: string;
  fuelType: FuelType;
  quantityLiters: number | string;
  pricePerLiter: number | string;
  totalAmount: number | string;
  transactionDate: string;
  status: string;
  notes?: string | null;
}

export interface VerificationResultData {
  farmer: {
    id: string;
    farmerCode: string;
    fullName: string;
    phone: string;
    photoUrl?: string | null;
    kebele: string;
    subCity: string;
    landSize: number | string;
    waterSource: string;
    pumpFuelType: string;
    pumpHorsepower?: string | null;
  };
  authorization: {
    id: string;
    authCode: string;
    fuelType: string;
    fuelTypeCode: string;
    pricePerLiter: number | string;
    authorizedLiters: number | string;
    consumedLiters: number | string;
    remainingLiters: number | string;
    validFrom: string;
    validTo: string;
    stationName: string;
  };
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  user?: {
    username: string;
    fullName: string;
    role: string;
  } | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  description?: string | null;
}
