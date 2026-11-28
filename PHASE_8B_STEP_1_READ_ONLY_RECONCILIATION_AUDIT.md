# IRFA / DFCS — Phase 8B, Step 1: Read-Only Administrative Data Reconciliation Audit

**Audit Date:** November 27, 2026 (08:23 AM UTC+3)  
**Database Environment:** TiDB Cloud Serverless (`test` database, version `8.0.11-TiDB-v8.5.3-serverless`)  
**Audit Mode:** **STRICTLY READ-ONLY** (Zero records created, modified, deleted, or migrated)  
**Milestone:** Phase 8B — Step 1: Administrative Master-Data Audit  
**Status:** **AUDIT COMPLETED — PENDING OWNER APPROVAL FOR STEP 2**  

---

## 1. Executive Summary

In accordance with the Phase 8B charter, a comprehensive, strictly read-only audit of the development database was conducted to reconcile administrative master data, evaluate sample and prototype artifacts, verify institutional alignment, and prepare an evidence-based roadmap for subsequent database normalization.

### Core Audit Discoveries
1. **Official Kebeles (45/45 Matched):** All 45 official Kebeles across the 4 Sub-Cities (ጣና: 13, በላይ ዘለቀ: 10, ዳግማዊ ምኒልክ: 11, አፄ ቴዎድሮስ: 11) exist in the database with 100% exact spelling, correct Sub-City foreign keys, and expected administrative naming.
2. **Legacy Prototype Kebeles (5 Orphaned Records):** Exactly 5 prototype Kebele records (`BD-KEB-01` through `BD-KEB-05`) exist with `subCityId = NULL`. Exhaustive relational inspection confirmed that **zero farmers, zero cards, zero request items, and zero foreign keys** reference any of these 5 records. They are completely safe for removal.
3. **Official Fuel Stations (21 Official Reference vs 22 Database Records):**
   - 19 official stations (`BD-ST-04` through `BD-ST-22`) seeded in Phase 1 exist and are fully intact.
   - 2 seed stations (`BD-ST-01` Tana Energy and `BD-ST-02` Abay Petroleum Hub) represent candidate operational counterparts for `Ghion Fuel Station` and `Total Petroleum Abay Bus`.
   - 1 seed station (`BD-ST-03` Tis Abay Agro-Fuel Depot) is an unverified prototype record with **zero operational activity** (0 transactions, 0 verification logs, 0 representatives) and is absent from the official 21-station institutional roster.
4. **Sample Authorization & Ledger Discrepancies:**
   - **Farmer Abebe Tesfaye (`AUTH-202611-00124`):** Authorized 200 L. Seven recorded transactions total **260 L**. Monthly allocation reflects `usedLiters = 260 L` and `remainingLiters = 0 L`. However, the authorization header table records `consumedLiters = 60 L` and `remainingLiters = 90 L`. This demonstrates that historical prototype test transactions were injected prior to the implementation of atomic transaction-to-authorization synchronization in Phase 4.
   - **Farmer Mulugeta Kebede (`AUTH-202611-00125`):** Authorized 150 L. One transaction of 40 L was executed. Monthly allocation reflects `usedLiters = 40 L`, but the authorization header records `consumedLiters = 0 L` and `remainingLiters = 150 L`.
5. **Sample Farmer Profile Duplications:** Five telephone numbers are shared across multiple farmer codes (e.g. `FR-00133`, `FR-00137`, and `FR-00141` share name "ወርቅነሽ አለሙ" and phone "+251922334455"), reflecting multi-batch seed generation.

---

## 2. Database Baseline Counts

Direct inspection of all 21 Prisma models in the live TiDB database established the current baseline:

| Model / Table | Prisma Model Name | Current Count | Status / Notes |
| :--- | :--- | :---: | :--- |
| **Fuel Station** | `fuelStation` | **22** | 3 seed stations + 19 Phase 1 official stations |
| **User** | `user` | **4** | `admin`, `agriculture`, `trade`, `station` (all ACTIVE) |
| **Sub-City** | `subCity` | **4** | Official 4 Sub-Cities of Bahir Dar |
| **Kebele** | `kebele` | **50** | 45 official + 5 unlinked prototype records |
| **Farmer** | `farmer` | **20** | Sample farmer baseline |
| **Farmer Card** | `farmerCard` | **21** | 19 ACTIVE, 1 PENDING, 1 DEACTIVATED |
| **Irrigation Profile** | `irrigationProfile` | **20** | Land & pump profiles for sample farmers |
| **Fuel Type** | `fuelType` | **2** | `DIESEL` (Diesel) and `BENZENE` (Regular Gasoline) |
| **Fuel Request** | `fuelRequest` | **3** | Baseline requests (`TR-2026-039`, `TR-2026-040`, `TR-2026-041`) |
| **Fuel Request Item** | `fuelRequestItem` | **4** | Request line items attached to baseline requests |
| **Fuel Request History** | `fuelRequestHistory` | **0** | Clean baseline |
| **Fuel Authorization** | `fuelAuthorization` | **2** | `AUTH-202611-00124` and `AUTH-202611-00125` |
| **Monthly Allocation** | `monthlyAllocation` | **5** | November 2026 quotas for pilot farmers |
| **Station Assignment** | `stationAssignment` | **2** | Legacy authorization-to-station mappings |
| **Station-SubCity Assignment**| `stationSubCityAssignment` | **0** | Clean baseline |
| **Fuel Shortage** | `fuelShortage` | **0** | Clean baseline |
| **Fuel Transaction** | `fuelTransaction` | **8** | 8 historical pilot transactions (300 L total on `BD-ST-01`) |
| **Verification Log** | `verificationLog` | **32** | 32 historical scan/verification audits on `BD-ST-01` |
| **Audit Log** | `auditLog` | **322** | System activity, logins, and test trail logs |
| **System Setting** | `systemSetting` | **6** | Default application system configurations |
| **Office** | `office` | **3** | Agriculture, Trade, and Central Administration offices |

---

## 3. Official Sub-City & Kebele Master-Data Reconciliation

The Bahir Dar City Administration institutional reference specifies **4 Sub-Cities** and **45 official Kebeles**.

### Sub-City Inventory
1. **ጣና ክፍለ ከተማ (`SC-TANA`):** ID `0127116f-92da-4606-809d-26a385e25933` (13 Kebeles)
2. **በላይ ዘለቀ ክፍለ ከተማ (`SC-BELAY-ZELEKE`):** ID `82f1ce89-ba88-48e2-ac5d-58f4d990fb11` (10 Kebeles)
3. **ዳግማዊ ምኒልክ ክፍለ ከተማ (`SC-DAGMAWI-MENELIK`):** ID `b27d278c-e32d-4a35-b669-3089f1c0a951` (11 Kebeles)
4. **አፄ ቴዎድሮስ ክፍለ ከተማ (`SC-ATSE-TEWODROS`):** ID `888786bd-4b7a-4b01-91d4-9028740f0d05` (11 Kebeles)

### Complete 45 Official Kebeles Cross-Reference

| # | Official Kebele Name | Sub-City | Database Code | Database ID | Registered Farmers | Reconciliation Status |
| :---: | :--- | :--- | :---: | :--- | :---: | :---: |
| 1 | ጨንታ | ጣና | `KB-TANA-01` | `c9725f7d-2b47-4959-8656-749e7b212f0c` | 0 | **Exact Match** |
| 2 | ወራሚት | ጣና | `KB-TANA-02` | `e2a4beff-2b1b-4395-9ffb-3df8f0ad5624` | 3 | **Exact Match** |
| 3 | ጭጫ አታንኩሳ | ጣና | `KB-TANA-03` | `62551528-6617-494b-a9a5-c3f2a8397a61` | 0 | **Exact Match** |
| 4 | ወገልሳ | ጣና | `KB-TANA-04` | `6d6ee4e2-a083-424a-a9e9-114b740523e1` | 0 | **Exact Match** |
| 5 | ወንዠጣ | ጣና | `KB-TANA-05` | `bb014389-9dbb-4a58-9a67-dffaa6d68b6b` | 0 | **Exact Match** |
| 6 | ዘጌ መሪ ማዘጋጃ ቤት | ጣና | `KB-TANA-06` | `bb5b2a0d-d40b-422d-bb45-a928ba5555e7` | 0 | **Exact Match** |
| 7 | ይጋንዳ | ጣና | `KB-TANA-07` | `b999fa77-d4f1-43e0-827d-99ff2927236e` | 0 | **Exact Match** |
| 8 | ኡራ | ጣና | `KB-TANA-08` | `bf8c2020-272e-4cb8-8c1d-15106579549f` | 0 | **Exact Match** |
| 9 | ህዳሴ | ጣና | `KB-TANA-09` | `fa93c942-0268-45d6-8b0d-b1eeb36e65b9` | 0 | **Exact Match** |
| 10 | ባታ | ጣና | `KB-TANA-10` | `295a0e0e-ce9c-48b4-8e6f-42b781ceb76b` | 3 | **Exact Match** |
| 11 | ሽምብጥ | ጣና | `KB-TANA-11` | `771ad982-f5c7-4348-8ebf-e2747fc32d84` | 1 | **Exact Match** |
| 12 | ምድረ ገነት | ጣና | `KB-TANA-12` | `01aa8f88-4231-4a41-b016-0428d098ee31` | 1 | **Exact Match** |
| 13 | ራስአገዝ | ጣና | `KB-TANA-13` | `a90100d0-aa33-4df5-9118-2e06c33cbf11` | 0 | **Exact Match** |
| 14 | ቀበሌ 07 | በላይ ዘለቀ | `KB-BZ-01` | `29aa6e37-a128-4e8c-8517-809ba8b846e4` | 0 | **Exact Match** |
| 15 | ሀገረሰላም | በላይ ዘለቀ | `KB-BZ-02` | `ba3eb001-c917-4860-930c-7b43c6835063` | 1 | **Exact Match** |
| 16 | ብስራት | በላይ ዘለቀ | `KB-BZ-03` | `432201d1-6d43-43bb-a536-2ee94709cae1` | 0 | **Exact Match** |
| 17 | ሰባታሚት ታዳጊ | በላይ ዘለቀ | `KB-BZ-04` | `da509311-bf1f-4f27-a00d-58ec7c9a444d` | 0 | **Exact Match** |
| 18 | ሰባታሚት ዙሪያ | በላይ ዘለቀ | `KB-BZ-05` | `35e8eb95-a1c1-40ea-9b88-aa822d556ad8` | 0 | **Exact Match** |
| 19 | ጢስ አባይ መሪ ማዘጋጃ ቤት | በላይ ዘለቀ | `KB-BZ-06` | `375d8d38-2e94-434d-8ff7-160fa11283fa` | 0 | **Exact Match** |
| 20 | የግንድ ዘሞቻ | በላይ ዘለቀ | `KB-BZ-07` | `7b9cb2cf-dbda-4bc5-9c8e-d98b950005a9` | 0 | **Exact Match** |
| 21 | ዳሰራ | በላይ ዘለቀ | `KB-BZ-08` | `8c1f9640-c92c-42cb-b467-f316bf8a0329` | 0 | **Exact Match** |
| 22 | ማጂ | በላይ ዘለቀ | `KB-BZ-09` | `da1d8a1c-3435-4309-8d76-55fa167523f4` | 3 | **Exact Match** |
| 23 | ሁለቱ ይጎማ | በላይ ዘለቀ | `KB-BZ-10` | `82b49c01-7fa1-4228-b2a8-0d859733c37a` | 0 | **Exact Match** |
| 24 | ሰላም | ዳግማዊ ምኒልክ | `KB-DM-01` | `0d984ce6-5da9-4171-beeb-248359480fa5` | 0 | **Exact Match** |
| 25 | ምድረ ገነት | ዳግማዊ ምኒልክ | `KB-DM-02` | `56e5f3ad-e22e-43ee-bcf4-6a9eb068305f` | 0 | **Exact Match** |
| 26 | አዲስ አምባ | ዳግማዊ ምኒልክ | `KB-DM-03` | `7be2904e-2826-4ee6-8575-cf6eb3993132` | 0 | **Exact Match** |
| 27 | ማርዘነብ | ዳግማዊ ምኒልክ | `KB-DM-04` | `ca808cb4-3486-4f76-88aa-381c81cf26fc` | 0 | **Exact Match** |
| 28 | ፍኖተ | ዳግማዊ ምኒልክ | `KB-DM-05` | `eb82bc92-be22-4809-ae9f-1033230c1be7` | 0 | **Exact Match** |
| 29 | አዲስ ዓለም | ዳግማዊ ምኒልክ | `KB-DM-06` | `e995f700-6c90-449e-b873-e3802928509c` | 0 | **Exact Match** |
| 30 | ሶስቱ ይነሳ | ዳግማዊ ምኒልክ | `KB-DM-07` | `f6ff8363-2287-43ca-a3ea-e6ef75d1d6a3` | 0 | **Exact Match** |
| 31 | ወርቃምላ አቻድር | ዳግማዊ ምኒልክ | `KB-DM-08` | `10d540ea-9b7e-40be-bd15-77983ea25e98` | 0 | **Exact Match** |
| 32 | ይባብ | ዳግማዊ ምኒልክ | `KB-DM-09` | `a495eeeb-ae37-4d6d-a117-6ffef949bb4e` | 0 | **Exact Match** |
| 33 | ይሎማና ይገንፋት | ዳግማዊ ምኒልክ | `KB-DM-10` | `872e42a9-7c45-42be-b27b-231a4ca140ee` | 0 | **Exact Match** |
| 34 | መሸንቲ ንዑስ ማዘጋጃ ቤት | ዳግማዊ ምኒልክ | `KB-DM-11` | `b49141be-10d5-450a-995b-06041ec12e87` | 0 | **Exact Match** |
| 35 | ማራኪ | አፄ ቴዎድሮስ | `KB-AT-01` | `d121df4c-e87f-4b06-a886-f68808d4be10` | 0 | **Exact Match** |
| 36 | አባይ ራስ | አፄ ቴዎድሮስ | `KB-AT-02` | `2e039401-2e65-4f7f-8ec1-eb5f9ea32f17` | 0 | **Exact Match** |
| 37 | ጤይማ | አፄ ቴዎድሮስ | `KB-AT-03` | `1e95fa50-f8fa-4e0d-bca7-8a4369e801b7` | 0 | **Exact Match** |
| 38 | አዲስ ዓለም | አፄ ቴዎድሮስ | `KB-AT-04` | `66870ae8-1983-4903-b09e-7db4fa8e29a3` | 0 | **Exact Match** |
| 39 | አየር ጤና | አፄ ቴዎድሮስ | `KB-AT-05` | `e97305d2-0692-4919-86c0-a7d0b3e59ba3` | 0 | **Exact Match** |
| 40 | ዘንዘልማ | አፄ ቴዎድሮስ | `KB-AT-06` | `48a27d2c-8ff1-48e0-a4a5-9a8d9a489110` | 2 | **Exact Match** |
| 41 | ወረብ | አፄ ቴዎድሮስ | `KB-AT-07` | `f5997232-a723-45c1-90a4-d130c0082f50` | 0 | **Exact Match** |
| 42 | የሞሽት | አፄ ቴዎድሮስ | `KB-AT-08` | `43224213-9a3b-48ae-a2e6-7ebfa3fa4e01` | 4 | **Exact Match** |
| 43 | ተንታ ላጉና | አፄ ቴዎድሮስ | `KB-AT-09` | `cfbfa767-f58c-4cbe-b4c4-f25979bc3e28` | 0 | **Exact Match** |
| 44 | ተንታ ቂርቆስ | አፄ ቴዎድሮስ | `KB-AT-10` | `25bcbb6d-3172-4b2a-a92c-5290b228b3b3` | 0 | **Exact Match** |
| 45 | ሮቢት | አፄ ቴዎድሮስ | `KB-AT-11` | `d726b216-095a-4e2d-a2f0-7053e1980838` | 2 | **Exact Match** |

---

## 4. Legacy Prototype Kebele Records Analysis

The 5 prototype Kebele records identified in earlier QA sessions were inspected in depth:

| Code | Database ID | Name | SubCity Relationship | Attached Farmers | Dependencies | Official Counterpart Candidate | Confidence |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| `BD-KEB-01` | `ccedee8b-4cb2-411a-bba9-8c7733428341` | Tana Kebele (01) | `subCityId = null` (Orphan) | **0** | **0** | None (Tana is a Sub-City, not a Kebele) | **HIGH** (Safe to Remove) |
| `BD-KEB-02` | `61778c3b-6650-4e53-a8c3-13a880546375` | Zenzelma Kebele (02) | `subCityId = null` (Orphan) | **0** | **0** | `KB-AT-06` (ዘንዘልማ ቀበሌ in አፄ ቴዎድሮስ) | **HIGH** (Safe to Remove) |
| `BD-KEB-03` | `52c67a6d-2d92-4283-9a58-86e75786cd5c` | Shumeta Kebele (03) | `subCityId = null` (Orphan) | **0** | **0** | Historical prototype name; no direct official match | **MEDIUM** (Safe to Remove) |
| `BD-KEB-04` | `86a3caee-42ce-488b-b9db-576f3c113a06` | Weramit Kebele (04) | `subCityId = null` (Orphan) | **0** | **0** | `KB-TANA-02` (ወራሚት ቀበሌ in ጣና) | **HIGH** (Safe to Remove) |
| `BD-KEB-05` | `0ea437bb-9e43-4d7c-87e6-fd3915985d49` | Shimbit Kebele (05) | `subCityId = null` (Orphan) | **0** | **0** | `KB-TANA-11` (ሽምብጥ ቀበሌ in ጣና) | **HIGH** (Safe to Remove) |

### Key Invariant Findings on Legacy Kebeles:
- **Zero Farmer Associations:** All 20 sample farmers in the database are already mapped to official `KB-*` records (`KB-TANA-02`, `KB-TANA-10`, `KB-TANA-11`, `KB-TANA-12`, `KB-BZ-02`, `KB-BZ-09`, `KB-AT-06`, `KB-AT-08`, `KB-AT-11`). Not a single farmer references `BD-KEB-01` through `BD-KEB-05`.
- **Zero Foreign Key Violations:** Because no farmers, cards, requests, or sub-cities link to these 5 rows, removing them in a future cleanup step carries **zero cascading risk**.

---

## 5. Fuel Station Master Data Reconciliation

The database currently holds **22 station records** compared to the official institutional roster of **21 stations**:

### Complete Station Roster Comparison Table

| Station Code | Database ID | Station Name | Company | Location | Users | Txs | Logs | Official 21-Roster Status | Match Confidence | Recommended Step 2 Action |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- | :---: | :--- |
| `BD-ST-01` | `32e84b8b-887f-4f16-9055-e339123f61d5` | Tana Energy Fuel Station (Station A) | N/A | Lake Tana Shore Blvd | 1 (`station`) | 8 | 32 | Candidate for **Ghion Fuel station (ፈለገ ግዮን ነዳጅ ማደያ)** | **HIGH** | **Retain & Update Name/Brand** to official Ghion station; preserve user `station`, 8 txs, and 32 logs. |
| `BD-ST-02` | `d343475f-96d4-494b-899e-426ca60f5afb` | Abay Petroleum Hub (Station B) | N/A | Kebele 02 Ring Road | 0 | 0 | 0 | Candidate for **Total petroleum, Abay Bus** | **HIGH** | **Retain & Rename** to official Total Petroleum Abay Bus. |
| `BD-ST-03` | `205e5df2-6126-4f37-b1da-5707ba7a7a1f` | Tis Abay Agro-Fuel Depot | N/A | Tis Abay Highway Jct | 0 | 0 | 0 | **UNMATCHED** (Not in official 21-station list) | **LOW** | **Remove / Deactivate** in Step 2; 0 transactions, 0 logs, 0 users attached. |
| `BD-ST-04` | `21c1666a-a0ae-4c7e-836d-823041c79cd6` | TotalEnergies BAHIRDAR ABAY MADO SERVICE STATION | TotalEnergies | Abay Mado | 0 | 0 | 0 | Official Roster Item #1 | **MATCHED** | Retain |
| `BD-ST-05` | `98485363-f267-4a70-b10d-5776282b677a` | TotalEnergies BAHIRDAR SEBAT AMIT S/S | TotalEnergies | Sebat Amit | 0 | 0 | 0 | Official Roster Item #2 | **MATCHED** | Retain |
| `BD-ST-06` | `63a66731-117a-40f1-8d96-3206a85c8d78` | Total BAHIR DAR | TotalEnergies | Central District | 0 | 0 | 0 | Official Roster Item #3 | **MATCHED** | Retain |
| `BD-ST-07` | `dd571ac4-b865-4af1-838c-11deed900bc5` | BAHIR DAR NOC 4 Gas Station | NOC | NOC 4 Junction | 0 | 0 | 0 | Official Roster Item #4 | **MATCHED** | Retain |
| `BD-ST-08` | `8736a8e9-74b3-4827-a2ad-4f03886db67c` | Noc gas station bahir dar (ኖክ ነዳጅ ማደያ ባህር ዳር) | NOC | Main Highway | 0 | 0 | 0 | Official Roster Item #5 | **MATCHED** | Retain |
| `BD-ST-09` | `70f6d0c9-bf1a-447e-ac95-5453a751a4c8` | Noc Petrol | NOC | Bahir Dar | 0 | 0 | 0 | Official Roster Item #6 | **MATCHED** | Retain |
| `BD-ST-10` | `41ead1c2-43e6-418d-ac58-23c69252ecee` | OLA Energy BAHIR DAR AMDE | OLA Energy | Amde District | 0 | 0 | 0 | Official Roster Item #7 | **MATCHED** | Retain |
| `BD-ST-11` | `b0ab09c1-2a16-42fe-a3c9-3adf42b8e0b7` | OLA Energy Sorenie | OLA Energy | Sorenie District | 0 | 0 | 0 | Official Roster Item #8 | **MATCHED** | Retain |
| `BD-ST-12` | `f31c3f9c-744c-448c-9c3c-928315f0a1bb` | Oilibya Bahirdar (old agip) | Oilibya | Old Agip Area | 0 | 0 | 0 | Official Roster Item #9 | **MATCHED** | Retain |
| `BD-ST-13` | `784534e7-493e-4364-bbcf-5ea087eece7a` | Yetebaberut | YBP | Bahir Dar | 0 | 0 | 0 | Official Roster Item #10 | **MATCHED** | Retain |
| `BD-ST-14` | `c8ca61c4-b4a8-444a-b50a-f1165bc63259` | Ella Petroleum | Ella Petroleum | Bahir Dar | 0 | 0 | 0 | Official Roster Item #11 | **MATCHED** | Retain |
| `BD-ST-15` | `7a8c3d7f-aa6a-4952-b88d-cf199df19ea9` | JR petroleum | JR Petroleum | Bahir Dar | 0 | 0 | 0 | Official Roster Item #12 | **MATCHED** | Retain |
| `BD-ST-16` | `c30b20cb-c19a-4648-8df0-7d15a513c042` | Abissiniya petrol | Abyssinia Pet | Bahir Dar | 0 | 0 | 0 | Official Roster Item #13 | **MATCHED** | Retain |
| `BD-ST-17` | `f4007621-e053-4e4b-9e6b-d89f8d55ff56` | Bahir Dar African Oil | African Oil | Bahir Dar | 0 | 0 | 0 | Official Roster Item #14 | **MATCHED** | Retain |
| `BD-ST-18` | `43292497-6a5b-4ec6-8d57-19aa827b5fc7` | Delta petroleum | Delta Petroleum | Bahir Dar | 0 | 0 | 0 | Official Roster Item #15 | **MATCHED** | Retain |
| `BD-ST-19` | `1168f888-dcff-4fcb-bc08-25c276ad4a54` | Bahir Dar University Fuel Station | Institutional | BDU Main Campus | 0 | 0 | 0 | Official Roster Item #16 | **MATCHED** | Retain |
| `BD-ST-20` | `8885b5ca-fa6f-44eb-b6b3-67cbe5f97371` | Gomeju oil | Gomeju Oil | Bahir Dar | 0 | 0 | 0 | Official Roster Item #17 | **MATCHED** | Retain |
| `BD-ST-21` | `d720bbf1-831e-450f-9f79-ffca5ae4ae10` | Zemen Oil Ethiopia | Zemen Oil | Bahir Dar | 0 | 0 | 0 | Official Roster Item #18 | **MATCHED** | Retain |
| `BD-ST-22` | `d6dfb889-eb9e-4e4b-84a1-872f0ca85b3b` | Amany Yeshi Gulf Oil (አማኒ የሽ የገልፍ ዘይት አከፋፋይ) | Gulf Oil | Bahir Dar | 0 | 0 | 0 | Official Roster Item #19 | **MATCHED** | Retain |

---

## 6. Sample Authorization and Transaction Ledger Audit

The database contains **2 fuel authorizations** and **8 completed fuel transactions** (all on station `BD-ST-01`).

### Detailed Ledger Inspection

#### Record A: Farmer Abebe Tesfaye (`FR-00124`)
- **Authorization Code:** `AUTH-202611-00124` (ID: `4186cce1-5de7-4694-9c8c-a0a38af6b262`)
- **Fuel Type:** DIESEL
- **Authorized Liters:** `200.00 L`
- **Recorded Authorization Consumed:** `60.00 L`
- **Recorded Authorization Remaining:** `90.00 L`
- **Recorded Authorization Status:** `ACTIVE`
- **Linked Monthly Allocation:** ID `6922eab6-c858-4b0f-bf5e-d76bc88da4b0` (Allocated: 200 L, Used: 260 L, Remaining: 0 L, Status: `ACTIVE`)
- **7 Linked Fuel Transactions:**
  1. `TX-20261123-0001` (2026-11-23): 80 L (104.5 ETB/L)
  2. `TX-20261125-5702` (2026-11-25): 50 L (104.5 ETB/L)
  3. `TX-20261125-5081` (2026-11-25): 20 L (104.5 ETB/L)
  4. `TX-20261125-1872` (2026-11-25): 50 L (104.5 ETB/L)
  5. `TX-20261125-5704` (2026-11-25): 20 L (104.5 ETB/L)
  6. `TX-20261125-9884` (2026-11-25): 20 L (104.5 ETB/L)
  7. `TX-20261125-9282` (2026-11-25): 20 L (104.5 ETB/L)
- **Mathematical Reconciliation:**
  $$\text{Actual Transactions Sum} = 80 + 50 + 20 + 50 + 20 + 20 + 20 = 260.00\text{ L}$$
  $$\text{Overdraw Volume} = 260\text{ L} - 200\text{ L} = +60\text{ L (Overdrawn)}$$
  $$\text{Recorded Header Inconsistency: } 200\text{ L (Auth)} - 60\text{ L (Consumed)} = 140\text{ L} \neq 90\text{ L (Remaining)}$$

#### Record B: Farmer Mulugeta Kebede (`FR-00125`)
- **Authorization Code:** `AUTH-202611-00125` (ID: `933f383e-a89b-466c-9dd6-9e6349cce803`)
- **Fuel Type:** BENZENE
- **Authorized Liters:** `150.00 L`
- **Recorded Authorization Consumed:** `0.00 L`
- **Recorded Authorization Remaining:** `150.00 L`
- **Recorded Authorization Status:** `ACTIVE`
- **Linked Monthly Allocation:** ID `f0b40a88-ecec-40fd-90ba-d8a85f83b23d` (Allocated: 150 L, Used: 40 L, Remaining: 110 L, Status: `ACTIVE`)
- **1 Linked Fuel Transaction:**
  1. `TX-20261123-0002` (2026-11-23): 40 L (115.2 ETB/L)
- **Mathematical Reconciliation:**
  $$\text{Actual Transactions Sum} = 40.00\text{ L}$$
  $$\text{Expected Remaining Liters} = 150\text{ L} - 40\text{ L} = 110.00\text{ L}$$
  $$\text{Recorded Header Delta} = \text{Authorization consumed was recorded as 0 L instead of 40 L.}$$

### Root Cause & Technical Assessment
The discrepancy originated in Phase 0/1 seed data creation:
1. When transactions were seeded or executed during early prototype testing, `MonthlyAllocation.usedLiters` was incremented, but `FuelAuthorization.consumedLiters` and `FuelAuthorization.remainingLiters` were not atomically updated.
2. In Abebe's case, transactions were permitted to accumulate to 260 L because quota enforcement checks were not yet implemented until Phase 4.
3. Neither authorization status was transitioned to `EXHAUSTED`.

---

## 7. Other Master-Data & Sample-Data Anomalies

| Category | Finding Detail | Affected Records | Severity |
| :--- | :--- | :--- | :---: |
| **Duplicate Sample Profiles** | 5 phone numbers are shared across multiple farmer codes | Shared by 14 farmer accounts (e.g. `FR-00133`, `FR-00137`, `FR-00141`) | **MEDIUM** |
| **Duplicate National IDs** | Query identified shared national IDs due to null/empty values | Farmers with blank or default national ID fields | **LOW** |
| **Card Status Anomalies** | 2 farmers have cards not in `ACTIVE` status | `FR-00127` (Kassahun Alemu: card `BD-CARD-2026-00127` is `DEACTIVATED`)<br>`FR-00126` (Hana Worku: card `BD-CARD-2026-00126` is `PENDING`) | **LOW** (Valid operational states) |
| **Legacy Station Assignments** | 2 legacy `StationAssignment` records directly map `BD-ST-01` to authorizations | IDs: `6ab01e00-b2ef-4af5-8d7c-cc3ac5b176ee` and `c4cf9f98-d106-4e9a-be5f-d8df444afb8a` | **MEDIUM** |
| **Missing Station Allocations** | `StationSubCityAssignment` table has 0 records | Stations are not yet allocated to Sub-Cities (by design: clean baseline) | **INFO** |
| **Allocation Overuse** | Monthly allocation used exceeds allocated volume | Farmer Abebe Tesfaye (`usedLiters: 260`, `allocatedLiters: 200`) | **HIGH** |

---

## 8. Backup Inventory Audit

Inspection of `server/backups/` confirmed three historical backups:

| Backup Filename | File Size | Timestamp (UTC) | Table Counts in Metadata | Baseline Assessment |
| :--- | :---: | :---: | :--- | :--- |
| `backup_phase1_2026-11-27T00-21-20-267Z.json` | 134.96 KB | 2026-11-27 00:21:20 | stations: 3, farmers: 20, requests: 3, txs: 8 | Initial 3-station prototype snapshot |
| `backup_phase1_2026-11-27T02-11-51-483Z.json` | 201.15 KB | 2026-11-27 02:11:51 | stations: 22, farmers: 20, requests: 3, txs: 8 | Phase 1 post-seed snapshot |
| `backup_phase8a_2026-11-27T03-38-26-891Z.json` | 236.53 KB | 2026-11-27 03:38:26 | stations: 22, farmers: 20, requests: 3, txs: 8 | Phase 8A safety baseline |

### Backup Recommendation for Step 2:
While `backup_phase8a_2026-11-27T03-38-26-891Z.json` is a complete snapshot, it contains the pre-cleanup state (with the residual request). **A fresh pre-cleanup snapshot (`backup_phase8b_step2_pre_cleanup.json`) MUST be created immediately prior to executing any modifications in Step 2.**

---

## 9. Proposed Step 2 Reconciliation & Cleanup Plan

The following ordered actions are proposed for Phase 8B Step 2. **NO ACTIONS HAVE BEEN EXECUTED.**

```
[Phase 8B Step 2 Execution Sequence]
  │
  ├── 1. Generate Fresh Database Backup (backup_phase8b_step2_pre_cleanup.json)
  │
  ├── 2. Purge 5 Unlinked Prototype Kebeles (BD-KEB-01 through BD-KEB-05)
  │
  ├── 3. Reconcile Seed Fuel Stations to Official 21-Station Roster:
  │      ├── Map BD-ST-01 -> Ghion Fuel station (ፈለገ ግዮን ነዳጅ ማደያ)
  │      ├── Map BD-ST-02 -> Total petroleum, Abay Bus
  │      └── Safe Deactivation / Removal of Unmatched BD-ST-03 (Tis Abay Agro-Fuel Depot)
  │
  ├── 4. Reconcile Sample Ledger & Quotas for Abebe Tesfaye & Mulugeta Kebede:
  │      ├── Synchronize FuelAuthorization headers with transaction ledger
  │      └── Transition fully utilized quotas to EXHAUSTED status
  │
  └── 5. Post-Cleanup Regression Verification & Database Preservation Validation
```

### Action Detail Specifications

#### Action 1: Purge 5 Legacy Prototype Kebeles
- **Target Records:**
  1. `ccedee8b-4cb2-411a-bba9-8c7733428341` (`BD-KEB-01`, Tana Kebele 01)
  2. `61778c3b-6650-4e53-a8c3-13a880546375` (`BD-KEB-02`, Zenzelma Kebele 02)
  3. `52c67a6d-2d92-4283-9a58-86e75786cd5c` (`BD-KEB-03`, Shumeta Kebele 03)
  4. `86a3caee-42ce-488b-b9db-576f3c113a06` (`BD-KEB-04`, Weramit Kebele 04)
  5. `0ea437bb-9e43-4d7c-87e6-fd3915985d49` (`BD-KEB-05`, Shimbit Kebele 05)
- **Dependency Impact:** 0 farmers, 0 cards, 0 requests. Zero cascading risk.
- **Risk Level:** **VERY LOW**
- **Confidence:** **HIGH**

#### Action 2: Station Master-Data Alignment
- **Target A (`BD-ST-01`):** Update name to `"Ghion Fuel station (ፈለገ ግዮን ነዳጅ ማደያ)"`, company to `"Ghion"`. Preserve all transactions, logs, and account `station`.
- **Target B (`BD-ST-02`):** Update name to `"Total petroleum, Abay Bus"`, company to `"TotalEnergies"`.
- **Target C (`BD-ST-03`):** Remove or mark `isActive: false` as unconfirmed prototype depot.
- **Dependency Impact:** `BD-ST-03` has 0 transactions, 0 logs, 0 allocations, 0 users.
- **Risk Level:** **LOW**
- **Confidence:** **HIGH**

#### Action 3: Sample Ledger Normalization
- **Target A (Abebe Tesfaye `AUTH-202611-00124`):**
  - Option 1 (Recommended): Normalize authorization to reflect total transactions consumed: `consumedLiters = 260.00`, `remainingLiters = 0.00`, `status = EXHAUSTED`. Update monthly allocation `status = EXHAUSTED`.
- **Target B (Mulugeta Kebede `AUTH-202611-00125`):**
  - Normalize authorization: `consumedLiters = 40.00`, `remainingLiters = 110.00`, `status = ACTIVE` (matching monthly allocation).
- **Dependency Impact:** Restores mathematical ledger consistency ($Authorized - Consumed = Remaining$) across header and transaction tables.
- **Risk Level:** **LOW**
- **Confidence:** **HIGH**

---

## 10. Items for Project Owner Clarification

Prior to executing Step 2, the following decisions are submitted for approval:
1. **Station BD-ST-03 Disposition:** Does the project owner approve permanent deletion of `BD-ST-03` (Tis Abay Agro-Fuel Depot) to achieve an exact 21-station roster, or should it be retained with `isActive = false`?
2. **Abebe Tesfaye Quota Cap:** In normalizing Abebe's authorization, should `authorizedLiters` be adjusted to 260 L to reflect historical sample transactions, or remain 200 L with an explanation note documenting the 60 L prototype overdraw?

---

## 11. Final Status & Boundaries

- **Audit completed successfully.**
- **No records were created, updated, or deleted.**
- **No schema migrations or tests were executed.**
- **Phase 8B Step 2 is NOT STARTED.**
- **Controlled Pilot is NOT AUTHORIZED.**
