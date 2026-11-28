# IRFA / DFCS — Phase 8B Step 2B-1: Read-Only Fuel Station Reconciliation Report

**Audit Date:** November 27, 2026 (08:36 AM UTC+3)  
**Database Environment:** TiDB Cloud Serverless (`test` database, server version `8.0.11-TiDB-v8.5.3-serverless`)  
**Audit Scope:** Phase 8B Step 2B-1 — Read-Only Fuel Station Reconciliation Investigation  
**Status:** **INVESTIGATION COMPLETED — 100% READ-ONLY**  

---

## Section A — Executive Summary

A comprehensive read-only investigation was conducted on the fuel station master dataset to reconcile the database's **22 fuel station records** against the official **21-station institutional roster** established by the Bahir Dar City Administration Office of Agriculture and Trade Office stakeholders.

### Key Investigation Discoveries:
1. **Official Station Match (19 Stations):** Stations `BD-ST-04` through `BD-ST-22` match 1:1 with the official Bahir Dar roster definitions across official station names, assigned codes, corporate entities, and locations. All 19 stations are active and have zero operational dependencies (0 transactions, 0 verification logs, 0 users).
2. **Operational Seed Station (`BD-ST-01`):** `BD-ST-01` (currently named *"Tana Energy Fuel Station"*) holds all live pilot transaction activity in the system: 8 transactions (300 L total), 32 verification logs, 2 direct authorization assignments, and the primary active operator account `station`. Geographic and documentary evidence establishes with **HIGH CONFIDENCE** that `BD-ST-01` is the operational surrogate for the official roster station **Ghion Fuel station (ፈለገ ግዮን ነዳጅ ማደያ)** located on Lake Tana Shore Boulevard.
3. **Candidate Seed Station (`BD-ST-02`):** `BD-ST-02` (currently named *"Abay Petroleum Hub"*) at Kebele 02 Ring Road matches the location and profile of the official roster station **Total petroleum, Abay Bus**. It has 0 transactions, 0 verification logs, and 0 user accounts.
4. **Unmatched Prototype Station (`BD-ST-03`):** `BD-ST-03` (*"Tis Abay Agro-Fuel Depot"*) is completely absent from the official 21-station master list. It is an unverified seed prototype depot with **zero transactions, zero verification logs, zero user accounts, zero assignments, and zero shortage reports**.
5. **Roster Normalization Path:** Converting the development database from 22 records to exact 21-station official roster parity requires:
   - Preserving `BD-ST-01`'s primary key, code, user `station`, 8 transactions, and 32 logs while updating its name to *Ghion Fuel station*.
   - Updating `BD-ST-02`'s name to *Total petroleum, Abay Bus*.
   - Safely deleting (or deactivating) unconfirmed prototype station `BD-ST-03`.

---

## Section B — Environment Verification

- **Cluster / Host:** TiDB Cloud Serverless (`gateway01.ap-northeast-1.prod.aws.tidbcloud.com`)
- **Connected Database:** `test`
- **TiDB Engine Version:** `8.0.11-TiDB-v8.5.3-serverless`
- **Environment Status:** Confirmed as the isolated development and automated testing environment. No production infrastructure was contacted or queried.
- **Safety Mode:** All queries executed in this task were strictly read-only (`findMany`, `count`, `groupBy`). Zero `INSERT`, `UPDATE`, `DELETE`, or schema modifications were run.

---

## Section C — Official Roster Reconciliation (All 22 Stations)

The 22 database records were compared against the 21 official stations in `OFFICIAL_STATIONS_MASTER`:

| DB Code | Database Name | Official Roster Match | Location Match | Confidence | Recommended Disposition | Supporting Evidence |
| :---: | :--- | :--- | :--- | :---: | :--- | :--- |
| **`BD-ST-01`** | Tana Energy Fuel Station (Station A) | Ghion Fuel station (ፈለገ ግዮን ነዳጅ ማደያ) | Exact (`Lake Tana Shore Boulevard`) | **HIGH CONFIDENCE** | Retain; update name/company; preserve data | Same street, seed pilot station, 8 txs, 32 logs, user `station` |
| **`BD-ST-02`** | Abay Petroleum Hub (Station B) | Total petroleum, Abay Bus | High (`Kebele 02 Ring Road / Abay Bus`) | **HIGH CONFIDENCE** | Retain; update name/company to Total Abay Bus | Location matches official Abay Bus depot; 0 txs; safe rename |
| **`BD-ST-03`** | Tis Abay Agro-Fuel Depot | **NONE** (Absent from Official 21 Roster) | Non-roster (`Tis Abay Highway Junction`) | **LEGACY / NON-ROSTER** | Delete or Deactivate in future Step 2B-2 | Absent from official list; 0 txs, 0 logs, 0 users, 0 allocations |
| **`BD-ST-04`** | TotalEnergies BAHIRDAR ABAY MADO SERVICE STATION | TotalEnergies BAHIRDAR ABAY MADO SERVICE STATION | Exact (`Abay Mado, Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-05`** | TotalEnergies BAHIRDAR SEBAT AMIT S/S | TotalEnergies BAHIRDAR SEBAT AMIT S/S | Exact (`Sebat Amit, Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-06`** | Total BAHIR DAR | Total BAHIR DAR | Exact (`Central District, Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-07`** | BAHIR DAR NOC 4 Gas Station | BAHIR DAR NOC 4 Gas Station | Exact (`NOC 4 Junction, Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-08`** | Noc gas station bahir dar (ኖክ ነዳጅ ማደያ ባህር ዳር) | Noc gas station bahir dar (ኖክ ነዳጅ ማደያ ባህር ዳር) | Exact (`Main Highway, Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-09`** | Noc Petrol | Noc Petrol | Exact (`Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-10`** | OLA Energy BAHIR DAR AMDE | OLA Energy BAHIR DAR AMDE | Exact (`Amde District, Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-11`** | OLA Energy Sorenie | OLA Energy Sorenie | Exact (`Sorenie District, Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-12`** | Oilibya Bahirdar (old agip) | Oilibya Bahirdar (old agip) | Exact (`Old Agip Area, Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-13`** | Yetebaberut | Yetebaberut | Exact (`Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-14`** | Ella Petroleum | Ella Petroleum | Exact (`Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-15`** | JR petroleum | JR petroleum | Exact (`Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-16`** | Abissiniya petrol | Abissiniya petrol | Exact (`Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-17`** | Bahir Dar African Oil | Bahir Dar African Oil | Exact (`Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-18`** | Delta petroleum | Delta petroleum | Exact (`Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-19`** | Bahir Dar University Fuel Station | Bahir Dar University Fuel Station | Exact (`BDU Main Campus, Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-20`** | Gomeju oil | Gomeju oil | Exact (`Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-21`** | Zemen Oil Ethiopia | Zemen Oil Ethiopia | Exact (`Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |
| **`BD-ST-22`** | Amany Yeshi Gulf Oil (አማኒ የሽ የገልፍ ዘይት አከፋፋይ) | Amany Yeshi Gulf Oil (አማኒ የሽ የገልፍ ዘይት አከፋፋይ) | Exact (`Bahir Dar`) | **CONFIRMED** | Retain As-Is | Matches official definition; seeded in Phase 1 |

---

## Section D — Detailed Dependency Audit (All 22 Stations)

| Station Code | Database ID | Transactions (Count & Volume) | Verification Logs | Assigned Users | Direct Assignments | SubCity Allocations | Shortages | Audit Logs |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`BD-ST-01`** | `32e84b8b-887f-4f16-9055-e339123f61d5` | **8 txs (300.00 L)**<br>• Diesel: 7 txs (260 L)<br>• Benzene: 1 tx (40 L) | **32 logs**<br>(16 Success,<br>16 Rejected) | **1 user**<br>(`station`, active: true) | **2**<br>(`AUTH-00124`,<br>`AUTH-00125`) | 0 | 0 | **54 logs** |
| **`BD-ST-02`** | `d343475f-96d4-494b-899e-426ca60f5afb` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | **14 logs** |
| **`BD-ST-03`** | `205e5df2-6126-4f37-b1da-5707ba7a7a1f` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | **0 logs** |
| **`BD-ST-04`** | `21c1666a-a0ae-4c7e-836d-823041c79cd6` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-05`** | `98485363-f267-4a70-b10d-5776282b677a` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-06`** | `63a66731-117a-40f1-8d96-3206a85c8d78` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-07`** | `dd571ac4-b865-4af1-838c-11deed900bc5` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-08`** | `8736a8e9-74b3-4827-a2ad-4f03886db67c` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-09`** | `70f6d0c9-bf1a-447e-ac95-5453a751a4c8` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-10`** | `41ead1c2-43e6-418d-ac58-23c69252ecee` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-11`** | `b0ab09c1-2a16-42fe-a3c9-3adf42b8e0b7` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-12`** | `f31c3f9c-744c-448c-9c3c-928315f0a1bb` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-13`** | `784534e7-493e-4364-bbcf-5ea087eece7a` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-14`** | `c8ca61c4-b4a8-444a-b50a-f1165bc63259` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-15`** | `7a8c3d7f-aa6a-4952-b88d-cf199df19ea9` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-16`** | `c30b20cb-c19a-4648-8df0-7d15a513c042` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-17`** | `f4007621-e053-4e4b-9e6b-d89f8d55ff56` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-18`** | `43292497-6a5b-4ec6-8d57-19aa827b5fc7` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-19`** | `1168f888-dcff-4fcb-bc08-25c276ad4a54` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-20`** | `8885b5ca-fa6f-44eb-b6b3-67cbe5f97371` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-21`** | `d720bbf1-831e-450f-9f79-ffca5ae4ae10` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |
| **`BD-ST-22`** | `d6dfb889-eb9e-4e4b-84a1-872f0ca85b3b` | 0 txs (0 L) | 0 | 0 | 0 | 0 | 0 | 0 |

---

## Section E — Special Investigation: BD-ST-01

- **Database Record:**
  - ID: `32e84b8b-887f-4f16-9055-e339123f61d5`
  - Code: `BD-ST-01`
  - Name: `Tana Energy Fuel Station (Station A)`
  - Location: `Lake Tana Shore Boulevard, Bahir Dar`
  - License: `BD-FUEL-2024-88`
- **Candidate Official Station:** `Ghion Fuel station (ፈለገ ግዮን ነዳጅ ማደያ)`
  - Official Address: `Lake Tana Shore Boulevard, Bahir Dar` (**100% Exact Match**)
  - Assigned Official Code: `BD-ST-01`
- **Operational Dependencies:**
  - 8 completed fuel transactions (300 Liters, 31,778 ETB).
  - 32 verification logs (16 approved dispenses, 16 quota/boundary rejections).
  - 1 assigned representative: `station` (`STATION_ADMIN`, active: true).
  - 2 direct station assignments (`AUTH-202611-00124` and `AUTH-202611-00125`).
  - 54 audit log entries.
- **Evidence Assessment:**
  The address *"Lake Tana Shore Boulevard, Bahir Dar"* matches the physical location of the well-known Ghion Fuel Station near the lake shore in Bahir Dar. In Phase 0/1, the development team created the prototype name *"Tana Energy Fuel Station"* as a placeholder.
- **Verdict & Recommendation:**
  **HIGH CONFIDENCE.** `BD-ST-01` represents Ghion Fuel Station. Because 8 transactions and 32 logs reference this station's primary key (`32e84b8b-887f-4f16-9055-e339123f61d5`), `BD-ST-01` **must never be deleted or recreated**. The recommended action for a future execution step is an in-place name/company update (`name = 'Ghion Fuel station (ፈለገ ግዮን ነዳጅ ማደያ)'`, `company = 'Ghion'`), preserving all IDs and relationships.

---

## Section F — Special Investigation: BD-ST-02

- **Database Record:**
  - ID: `d343475f-96d4-494b-899e-426ca60f5afb`
  - Code: `BD-ST-02`
  - Name: `Abay Petroleum Hub (Station B)`
  - Location: `Kebele 02 Ring Road, Bahir Dar`
  - License: `BD-FUEL-2024-89`
- **Candidate Official Station:** `Total petroleum, Abay Bus`
  - Official Address: `Kebele 02 Ring Road / Abay Bus Station, Bahir Dar` (**High Geographic Match**)
  - Assigned Official Code: `BD-ST-02`
- **Operational Dependencies:**
  - Transactions: **0**
  - Verification Logs: **0**
  - Assigned Users: **0**
  - Station Assignments: **0**
  - Audit Logs: **14 entries** (from Phase 6 tests where Trade Office reported mock shortages for BD-ST-02 and cleaned them up).
- **Evidence Assessment:**
  The location *"Kebele 02 Ring Road"* corresponds to the Abay Bus depot area where Total Petroleum operates in Bahir Dar. In Phase 1, `BD-ST-02` was reserved for this station.
- **Verdict & Recommendation:**
  **HIGH CONFIDENCE.** `BD-ST-02` is the placeholder for Total Petroleum Abay Bus. Because it has zero transactions and zero users, updating its name in place (`name = 'Total petroleum, Abay Bus'`, `company = 'TotalEnergies'`) in a future step is completely safe and free of relational risk.

---

## Section G — Special Investigation: BD-ST-03

- **Database Record:**
  - ID: `205e5df2-6126-4f37-b1da-5707ba7a7a1f`
  - Code: `BD-ST-03`
  - Name: `Tis Abay Agro-Fuel Depot`
  - Location: `Tis Abay Highway Junction, Bahir Dar`
  - License: `BD-FUEL-2024-90`
- **Official Roster Status:**
  - **COMPLETELY ABSENT.** The official 21-station master list defined by stakeholders contains zero entries for Tis Abay Agro-Fuel Depot.
- **Operational Dependencies:**
  - Transactions: **0**
  - Verification Logs: **0**
  - Assigned Users: **0**
  - Station Assignments: **0**
  - Station-SubCity Allocations: **0**
  - Shortage Reports: **0**
  - Audit Logs: **0**
- **Evidence Assessment:**
  `BD-ST-03` was created during initial Phase 0 prototype scaffolding as a mock rural depot. When the official 21-station list was compiled in Phase 1, no real-world station corresponded to this depot.
- **Verdict & Recommendation:**
  **LEGACY / NON-ROSTER.** `BD-ST-03` is an unverified prototype artifact. Because it has zero attached transactions, zero logs, and zero user accounts, it can be safely **permanently deleted** (or deactivated) in a future authorized step to reduce the database count from 22 to the exact official count of 21.

---

## Section H — BD-ST-04 Through BD-ST-22 Verification

All 19 stations (`BD-ST-04` through `BD-ST-22`) were inserted during Phase 1 based on the official Bahir Dar station roster:
- **Station Codes:** Sequentially assigned `BD-ST-04` through `BD-ST-22`.
- **Names & Companies:** Match the official master list exactly (TotalEnergies: 3, NOC: 3, OLA Energy: 2, Oilibya: 1, YBP: 1, Ella: 1, JR: 1, Abyssinia: 1, African Oil: 1, Delta: 1, BDU: 1, Gomeju: 1, Zemen: 1, Gulf Oil: 1).
- **Activity & Dependencies:** All 19 stations currently have **0 transactions, 0 verification logs, 0 representative users, and 0 shortage reports**.
- **Database ID Stability:** All 19 UUIDs remain stable and untouched since their creation.
- **Verdict:** **CONFIRMED (19/19)**. These 19 stations are legitimate, official station master records ready for operational station representative onboarding and Sub-City allocation.

---

## Section I — Risk Assessment

| Potential Action | Target Record | Risk Analysis | Impact Rating | Mitigating Precaution |
| :--- | :---: | :--- | :---: | :--- |
| **In-Place Rename** | `BD-ST-01` | Updating `name` and `company` while preserving `id` and `code`. Foreign keys reference immutable `id`. 8 txs and 32 logs remain intact. | **LOW** | Preserve `id`, `code`, and account `station`. Do NOT delete and recreate. |
| **In-Place Rename** | `BD-ST-02` | Updating `name` and `company`. Record has 0 transactions and 0 users. | **NEGLIGIBLE** | Update fields in-place via targeted transaction. |
| **Permanent Deletion** | `BD-ST-03` | Deleting the unconfirmed prototype record. Audit verified 0 transactions, 0 logs, 0 users, 0 allocations. | **LOW** | Pre-deletion verification that dependencies remain 0. Full backup before deletion. |
| **Deactivation (Alternative)** | `BD-ST-03` | Setting `isActive = false`. Station remains in DB but hidden from active dropdowns. | **LOW** | Keeps count at 22 instead of 21; requires active filters in all UI views. |
| **Leaving Unresolved** | `BD-ST-01..03` | Keeping fictional/prototype names in station dropdowns, receipt prints, and reports. | **HIGH (User Confusion)** | Harms institutional credibility during pilot launch. |

---

## Section J — Proposed Future Actions (FOR REVIEW ONLY — NOT EXECUTED)

The following actions are proposed for a future, explicitly authorized execution step (Phase 8B Step 2B-2):

| Station Code | Database ID | Proposed Action | Technical Operation | Rationale & Evidence | Required Approval |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **`BD-ST-01`** | `32e84b8b-887f-4f16-9055-e339123f61d5` | **CORRECT IDENTITY** | `UPDATE fuel_stations SET name = 'Ghion Fuel station (ፈለገ ግዮን ነዳጅ ማደያ)', company = 'Ghion' WHERE id = ...` | Matches Lake Tana Shore Blvd location; preserves 8 txs, 32 logs, user `station` | **Project Owner Approval** |
| **`BD-ST-02`** | `d343475f-96d4-494b-899e-426ca60f5afb` | **CORRECT IDENTITY** | `UPDATE fuel_stations SET name = 'Total petroleum, Abay Bus', company = 'TotalEnergies' WHERE id = ...` | Matches Kebele 02 Ring Road / Abay Bus depot; zero dependencies | **Project Owner Approval** |
| **`BD-ST-03`** | `205e5df2-6126-4f37-b1da-5707ba7a7a1f` | **DELETE (or DEACTIVATE)** | `DELETE FROM fuel_stations WHERE id = ...` (Limit 1) | Unverified prototype depot absent from official 21-station roster; 0 dependencies | **Project Owner Approval** |
| **`BD-ST-04` to `BD-ST-22`** | Multiple | **KEEP AS-IS** | None | 19 official stations already match roster definitions | **None (Already Valid)** |

---

## Section K — Database Integrity Verification

Read-only integrity verification confirmed zero mutations occurred during this investigation:

- **FuelStation Model Count:** Before = **22**, After = **22** ($\Delta = 0$).
- **Kebele Model Count:** Before = **45**, After = **45** ($\Delta = 0$).
- **User Model Count:** Before = **4**, After = **4** ($\Delta = 0$).
- **FuelTransaction Model Count:** Before = **8**, After = **8** ($\Delta = 0$).
- **VerificationLog Model Count:** Before = **32**, After = **32** ($\Delta = 0$).
- **Write Operations Executed:** **0**.
- **Schema / Migrations Run:** **None**.

---

## Section L — Final Verdict

### **VERDICT: READY FOR STEP 2B-2 EXECUTION PLANNING**

**Justification:**  
All 22 station records have been exhaustively audited. The operational identity of `BD-ST-01` (Ghion) and candidate identity of `BD-ST-02` (Total Abay Bus) are established with high confidence. The orphan, non-roster status of `BD-ST-03` is proven by zero dependencies and absence from the official roster. All 19 Phase 1 stations are validated. The project has complete, unambiguous evidence to proceed with execution planning for Step 2B-2 once authorized.

---

## STOP CONDITION
This investigation is strictly read-only and is now complete.  
- **No records were renamed, created, or deleted.**  
- **Phase 8B Step 2B-2 has NOT been started.**  
- **Controlled Pilot is NOT AUTHORIZED.**  
- Standing by for your review and instructions.
