# IRFA — Irrigation Resource & Fuel Authorization System
### Bahir Dar Agriculture Directorate, Amhara Region, Ethiopia
**ባህርዳር ግብርና መምሪያ — የመስኖ አርሶ አደሮች ነዳጅ ፈቃድና ቁጥጥር ሥርዓት**  
*Powered & Developed by Enqopa Technologies PLC*

---

## 1. Overview
The **Irrigation Resource & Fuel Authorization System (IRFA)** is an enterprise web application engineered for the **Bahir Dar Agriculture Directorate** (*ባህርዳር ግብርና መምሪያ*), Amhara Region, Ethiopia. It manages the registration of verified irrigation farmers operating along Lake Tana and the Blue Nile basin, oversees monthly fuel quota allocations (Diesel and Benzene), streamlines inter-office fuel request approvals between the Agriculture Directorate and the Trade & Market Development Office, issues official ISO/IEC 7810 ID-1 wallet-size dual-sided Farmer Digital ID cards with photographs, and provides real-time QR-based verification and atomic fuel dispensing at authorized stations.

---

## 2. Technology Stack

- **Frontend:**
  - React 18, Vite, TypeScript
  - Tailwind CSS (Government portal design tokens matching prototype)
  - React Router DOM v6 (Nested layout, protected role routes)
  - Axios (with authorization bearer interceptors & session handling)
  - Lucide React (Icons)
  - HTML5 QR Code & QRCode library (Dual-mode camera and dynamic identity generation)
- **Backend:**
  - Node.js, Express.js, TypeScript (Modular MVC architecture)
  - JWT Authentication & Secure HTTP-only cookies
  - bcrypt password hashing (10 salt rounds)
  - Role-Based Access Control (RBAC) middleware with station/office sandboxing
  - Zod request validation schemas
  - Centralized error and audit logging
- **Database & Persistence:**
  - MySQL / MariaDB (10.4+)
  - Prisma ORM (Type-safe schema, relational migrations, atomic interactive transactions)

---

## 3. User Roles & Security Boundaries

| Role | Responsibility | Access Scope |
|---|---|---|
| **Agriculture Office** (`AGRICULTURE_OFFICE`) | Farmer registration, land & pump irrigation profiles, monthly fuel quota planning, requests to Trade, card & QR issuance. | Farmer Management, Allocations, Requests, Cards, Reports |
| **Trade Office** (`TRADE_OFFICE`) | Reviewing requests from Agriculture, approving/partial/rejecting quotas, provisioning authorizations, and assigning fuel stations. | Review Queue, Authorizations, Station Mapping, Distribution Reports |
| **Fuel Station Admin** (`STATION_ADMIN`) | Live 8-step QR legality verification and atomic fuel dispensing into approved containers. | QR Camera Scanner, Manual ID Lookup, Dispensing, Receipts, Station Transactions |
| **System Administrator** (`SYSTEM_ADMIN`) | User creation, role assignment, office/station linking, system settings, technical audit logs, system health diagnostics. | **Technical configuration ONLY.** Strictly blocked from operational actions (cannot register farmers, approve requests, or dispense fuel). |

---

## 4. Development Credentials

> [!WARNING]
> **IMPORTANT NOTICE:** These credentials are provided for local development and demonstration evaluation only. All passwords must be changed and hardened before deployment to a production server.

| Office Role | Username | Password | Assigned Scope |
|---|---|---|---|
| **Agriculture Office** | `agriculture` | `demo123` | Bahir Dar Agriculture Department |
| **Trade Office** | `trade` | `demo123` | Bahir Dar Trade & Market Development Office |
| **Fuel Station Operator** | `station` | `demo123` | Tana Energy Station (Station A) |
| **System Administrator** | `admin` | `demo123` | Central City Administration |

---

## 5. Live 8-Step QR Verification Pipeline

When a station operator scans a farmer's card or inputs their Farmer ID, the server evaluates:
1. **Record Existence:** Does this farmer exist in the central database?
2. **Account Active:** Is the farmer account in an active status (`isActive: true`)?
3. **Eligibility:** Is the farmer's status `ELIGIBLE` (not `UNDER_REVIEW`, `SUSPENDED`, or `INELIGIBLE`)?
4. **Card Validity:** Is the physical card active (not reported `LOST` or `DEACTIVATED`)?
5. **Trade Authorization:** Is there an approved Trade authorization for the current period?
6. **Station Assignment:** Is the authorization assigned to **THIS** specific fuel station?
7. **Temporal Validity:** Is today's date within the authorization validity period?
8. **Remaining Quota:** Is the remaining fuel balance greater than 0 Liters?

If any check fails, the transaction is rejected, access is blocked, and an audited rejection record is stored in `verification_logs`. If all checks pass, the operator records the actual volume dispensed within an atomic transaction.

---

## 6. Installation & Quick Start

### Prerequisites
- Node.js (v18+ or v20+)
- MySQL or MariaDB running on `localhost:3306` (e.g., via XAMPP)

### Step 1: Database Setup
Ensure MySQL is running and create the database:
```sql
CREATE DATABASE irfa_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 2: Backend Setup
```bash
cd server
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run build
npm start
```
The backend API will start at `http://localhost:5000`.

### Step 3: Frontend Setup
In a new terminal:
```bash
cd client
npm install
npm run build
npm run dev
```
The React frontend will be accessible at `http://localhost:5173`.

### Step 4: Run Automated Verification Tests
To run the automated end-to-end integration test suite:
```bash
cd server
npx tsx test_e2e.ts
```

---

## 7. Project Structure

```
IRFA/
├── client/                     # React + Vite + TypeScript Frontend
│   ├── src/
│   │   ├── components/         # StatusBadge, StatCard, Sidebar, Topbar
│   │   ├── context/            # AuthContext (JWT session state & role helpers)
│   │   ├── layouts/            # MainLayout (248px navy sidebar + 72px topbar shell)
│   │   ├── pages/
│   │   │   ├── agriculture/    # FarmersPage, FarmerDetailPage, AllocationPage, RequestsPage, FarmerCardsPage
│   │   │   ├── trade/          # IncomingRequestsPage, AuthorizationsPage, StationAssignmentPage
│   │   │   ├── station/        # ScannerPage (WebRTC QR + Dispensing), TransactionsPage
│   │   │   ├── sysadmin/       # UsersPage, SettingsPage, AuditLogsPage, SystemHealthPage
│   │   │   ├── LandingPage.tsx # Public government landing page
│   │   │   ├── LoginPage.tsx   # Sign-in page with demo quick-fills
│   │   │   ├── DashboardPage.tsx # Dynamic role-specific operational dashboards
│   │   │   └── ReportsPage.tsx # Quota vs distribution analytics
│   │   ├── routes/             # AppRoutes (Public & Protected routes)
│   │   ├── services/           # Axios API client
│   │   └── types/              # TypeScript interfaces
│   ├── index.html
│   └── tailwind.config.js
│
├── server/                     # Node.js + Express + TypeScript Backend
│   ├── prisma/
│   │   ├── schema.prisma       # Relational models matching ERD
│   │   └── seed.ts             # Bahir Dar sample data & 4 demo accounts
│   ├── src/
│   │   ├── config/             # Database connection & JWT utilities
│   │   ├── controllers/        # Auth, Farmer, Allocation, Request, Trade, Verification, Dispensing, System, Reports
│   │   ├── middleware/         # JWT auth, RBAC guards, station scoping, error handler, audit logger
│   │   ├── routes/             # RESTful API router endpoints
│   │   ├── validators/         # Zod schemas for input validation
│   │   ├── app.ts              # Express application setup
│   │   └── server.ts           # HTTP server entry point
│   ├── test_e2e.ts             # Automated 25-step verification test suite
│   ├── .env                    # Environment variables
│   └── .env.example
└── README.md
```

---

## 8. License
Developed for the **Bahir Dar City Administration**, Amhara Region, Ethiopia.
