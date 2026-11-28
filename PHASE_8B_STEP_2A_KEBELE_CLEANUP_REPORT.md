# IRFA / DFCS — Phase 8B Step 2A: Legacy Kebele Fixture Cleanup Report

**Execution Date:** November 27, 2026 (08:30 AM UTC+3)  
**Database Environment:** TiDB Cloud Serverless (`test` database, server version `8.0.11-TiDB-v8.5.3-serverless`)  
**Scope:** Phase 8B Step 2A — Targeted Removal of 5 Obsolete Prototype Kebele Records  
**Status:** **SUCCESSFUL — 100% CLEAN**  
**Execution Authority:** Approved by Project Owner following Phase 8B Step 1 Read-Only Audit  

---

## 1. Executive Summary

Phase 8B Step 2A was executed to normalize the Kebele master dataset by eliminating 5 obsolete, unlinked prototype Kebele records (`BD-KEB-01` through `BD-KEB-05`). 

A fresh pre-cleanup safety backup was captured and verified prior to execution. All 5 records were subjected to strict pre-deletion invariant validation, confirming `subCityId = null`, 0 attached farmers, and 0 operational dependencies. The 5 records were deleted inside an atomic Prisma interactive transaction.

Post-deletion verification confirmed that the live database Kebele count transitioned from **50 to exactly 45**, achieving 100% exact parity with the official Bahir Dar City Administration 45-Kebele institutional roster. All 20 sample farmers remain intact and associated with official `KB-*` Kebeles, and zero collateral mutations occurred across the remaining 19 database models.

---

## 2. Pre-Cleanup Safety Backup

In accordance with safety protocols, a complete snapshot of all operational, administrative, and historical tables was captured and validated immediately before execution:

- **Backup Filename:** `backup_phase8b_step2a_pre_kebele_cleanup_2026-11-27T05-28-53-057Z.json`
- **Location:** `server/backups/backup_phase8b_step2a_pre_kebele_cleanup_2026-11-27T05-28-53-057Z.json`
- **File Size:** 278,071 bytes (271.55 KB)
- **Generation Timestamp:** `2026-11-27T05:28:53.057Z`
- **Validation Outcome:** Validated non-zero file size, verified valid JSON payload, and confirmed readable snapshots of all 17 primary entities (50 Kebeles, 22 Stations, 4 Sub-Cities, 20 Farmers, 21 Cards, 8 Transactions, 32 Logs).

---

## 3. Pre-Deletion Invariant Validation

Immediately prior to deletion, the live database was queried to validate each of the 5 authorized targets against audited invariants:

| Code | Database ID | Name in DB | SubCity Relationship | Attached Farmers | Foreign Key Dependencies | Validation Verdict |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `BD-KEB-01` | `ccedee8b-4cb2-411a-bba9-8c7733428341` | Tana Kebele (01) | `subCityId = NULL` | **0** | **0** | **PASS** |
| `BD-KEB-02` | `61778c3b-6650-4e53-a8c3-13a880546375` | Zenzelma Kebele (02) | `subCityId = NULL` | **0** | **0** | **PASS** |
| `BD-KEB-03` | `52c67a6d-2d92-4283-9a58-86e75786cd5c` | Shumeta Kebele (03) | `subCityId = NULL` | **0** | **0** | **PASS** |
| `BD-KEB-04` | `86a3caee-42ce-488b-b9db-576f3c113a06` | Weramit Kebele (04) | `subCityId = NULL` | **0** | **0** | **PASS** |
| `BD-KEB-05` | `0ea437bb-9e43-4d7c-87e6-fd3915985d49` | Shimbit Kebele (05) | `subCityId = NULL` | **0** | **0** | **PASS** |

All 5 records satisfied 100% of the authorized deletion criteria. Zero unexpected dependencies or active operational links were detected.

---

## 4. Targeted Atomic Deletion Execution

The deletion was executed inside a single atomic Prisma interactive transaction targeting each record by its exact primary key ID and verified code:

```typescript
const deletedResults = await prisma.$transaction(async (tx) => {
  const results = [];
  for (const target of AUTHORIZED_TARGETS) {
    const current = await tx.kebele.findUnique({ where: { id: target.id } });
    if (!current || current.code !== target.code || current.name !== target.expectedName || current.subCityId !== null) {
      throw new Error(`Transaction validation failed for: ${target.code}`);
    }
    const deleted = await tx.kebele.delete({ where: { id: target.id } });
    results.push(deleted);
  }
  return results;
});
```

### Deletion Results:
- `ccedee8b-4cb2-411a-bba9-8c7733428341` (`BD-KEB-01`, Tana Kebele (01)): **DELETED**
- `61778c3b-6650-4e53-a8c3-13a880546375` (`BD-KEB-02`, Zenzelma Kebele (02)): **DELETED**
- `52c67a6d-2d92-4283-9a58-86e75786cd5c` (`BD-KEB-03`, Shumeta Kebele (03)): **DELETED**
- `86a3caee-42ce-488b-b9db-576f3c113a06` (`BD-KEB-04`, Weramit Kebele (04)): **DELETED**
- `0ea437bb-9e43-4d7c-87e6-fd3915985d49` (`BD-KEB-05`, Shimbit Kebele (05)): **DELETED**

---

## 5. Post-Deletion Verification

### A. Target Lookup Invalidation
Direct lookups confirmed all 5 target records no longer exist in the database:
- `BD-KEB-01`: Lookup by ID $\rightarrow$ `null` | Lookup by Code $\rightarrow$ `null`
- `BD-KEB-02`: Lookup by ID $\rightarrow$ `null` | Lookup by Code $\rightarrow$ `null`
- `BD-KEB-03`: Lookup by ID $\rightarrow$ `null` | Lookup by Code $\rightarrow$ `null`
- `BD-KEB-04`: Lookup by ID $\rightarrow$ `null` | Lookup by Code $\rightarrow$ `null`
- `BD-KEB-05`: Lookup by ID $\rightarrow$ `null` | Lookup by Code $\rightarrow$ `null`

### B. Official 45 Kebele & Sub-City Structure
The 4 Sub-Cities and 45 official Kebeles remain 100% intact:
- **ጣና ክፍለ ከተማ (`SC-TANA`):** Exactly 13 official Kebeles (`KB-TANA-01` to `KB-TANA-13`).
- **በላይ ዘለቀ ክፍለ ከተማ (`SC-BELAY-ZELEKE`):** Exactly 10 official Kebeles (`KB-BZ-01` to `KB-BZ-10`).
- **ዳግማዊ ምኒልክ ክፍለ ከተማ (`SC-DAGMAWI-MENELIK`):** Exactly 11 official Kebeles (`KB-DM-01` to `KB-DM-11`).
- **አፄ ቴዎድሮስ ክፍለ ከተማ (`SC-ATSE-TEWODROS`):** Exactly 11 official Kebeles (`KB-AT-01` to `KB-AT-11`).
- **Total Official Kebeles:** **45 / 45** (100% matched to institutional reference).

### C. Farmer Data Preservation
- **Total Farmers in Database:** **20** (unchanged).
- **Orphaned / Unlinked Farmers:** **0**.
- **Attachment:** All 20 farmers remain 100% attached to valid official `KB-*` Kebeles (`KB-TANA-02`, `KB-TANA-10`, `KB-TANA-11`, `KB-TANA-12`, `KB-BZ-02`, `KB-BZ-09`, `KB-AT-06`, `KB-AT-08`, `KB-AT-11`).

---

## 6. Full Database Model Count Comparison

Counts across all 20 queried database models confirm zero collateral mutations:

| Model / Table | Pre-Cleanup Count | Post-Cleanup Count | Delta ($\Delta$) | Expected Delta | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `fuelStation` | 22 | 22 | 0 | 0 | **Preserved** |
| `user` | 4 | 4 | 0 | 0 | **Preserved** |
| `subCity` | 4 | 4 | 0 | 0 | **Preserved** |
| **`kebele`** | **50** | **45** | **-5** | **-5** | **Normalized** |
| `farmer` | 20 | 20 | 0 | 0 | **Preserved** |
| `farmerCard` | 21 | 21 | 0 | 0 | **Preserved** |
| `fuelType` | 2 | 2 | 0 | 0 | **Preserved** |
| `fuelRequest` | 3 | 3 | 0 | 0 | **Preserved** |
| `fuelRequestItem` | 4 | 4 | 0 | 0 | **Preserved** |
| `fuelRequestHistory` | 0 | 0 | 0 | 0 | **Preserved** |
| `fuelAuthorization` | 2 | 2 | 0 | 0 | **Preserved** |
| `monthlyAllocation` | 5 | 5 | 0 | 0 | **Preserved** |
| `stationAssignment` | 2 | 2 | 0 | 0 | **Preserved** |
| `stationSubCityAssignment` | 0 | 0 | 0 | 0 | **Preserved** |
| `fuelShortage` | 0 | 0 | 0 | 0 | **Preserved** |
| `fuelTransaction` | 8 | 8 | 0 | 0 | **Preserved** |
| `verificationLog` | 32 | 32 | 0 | 0 | **Preserved** |
| `auditLog` | 322 | 322 | 0 | 0 | **Preserved** |
| `systemSetting` | 6 | 6 | 0 | 0 | **Preserved** |
| `office` | 3 | 3 | 0 | 0 | **Preserved** |

---

## 7. Scope & Integrity Confirmation

- **Application Source Code:** Zero files modified in `client/src/` or `server/src/`.
- **Database Schema / Migrations:** Zero schema modifications or migrations executed.
- **Unrelated Records:** Zero modifications to farmers, stations, transactions, logs, requests, or users.
- **Phase 8B Step 2B (Station Reconciliation):** **NOT STARTED**.
- **Phase 8B Step 2C (Ledger Reconciliation):** **NOT STARTED**.
- **Controlled Pilot:** **NOT AUTHORIZED**.
