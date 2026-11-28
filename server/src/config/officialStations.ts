export interface OfficialStationDefinition {
  officialName: string;
  nameAmharic?: string;
  company?: string;
  assignedCode: string;
  location?: string;
  reconciliationStatus: 'MISSING' | 'PENDING_CONFIRMATION' | 'MATCHED';
  candidateExistingCode?: string;
  reconciliationNotes: string;
}

/**
 * Official Bahir Dar 21 Fuel Station Master List & Reconciliation Map
 * As defined by stakeholders for Bahir Dar City Administration DFCS.
 */
export const OFFICIAL_STATIONS_MASTER: OfficialStationDefinition[] = [
  {
    officialName: 'TotalEnergies BAHIRDAR ABAY MADO SERVICE STATION',
    company: 'TotalEnergies',
    assignedCode: 'BD-ST-04',
    location: 'Abay Mado, Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'TotalEnergies BAHIRDAR SEBAT AMIT S/S',
    company: 'TotalEnergies',
    assignedCode: 'BD-ST-05',
    location: 'Sebat Amit, Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'Total BAHIR DAR',
    company: 'TotalEnergies',
    assignedCode: 'BD-ST-06',
    location: 'Central District, Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'Total petroleum, Abay Bus',
    company: 'TotalEnergies',
    assignedCode: 'BD-ST-02',
    location: 'Kebele 02 Ring Road / Abay Bus Station, Bahir Dar',
    reconciliationStatus: 'PENDING_CONFIRMATION',
    candidateExistingCode: 'BD-ST-02',
    reconciliationNotes:
      'Possible match with existing seed station BD-ST-02 (Abay Petroleum Hub). Left unchanged pending human confirmation to prevent duplicate creation.',
  },
  {
    officialName: 'BAHIR DAR NOC 4 Gas Station',
    company: 'NOC',
    assignedCode: 'BD-ST-07',
    location: 'NOC 4 Junction, Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'Noc gas station bahir dar (ኖክ ነዳጅ ማደያ ባህር ዳር)',
    nameAmharic: 'ኖክ ነዳጅ ማደያ ባህር ዳር',
    company: 'NOC',
    assignedCode: 'BD-ST-08',
    location: 'Main Highway, Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'Noc Petrol',
    company: 'NOC',
    assignedCode: 'BD-ST-09',
    location: 'Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'OLA Energy BAHIR DAR AMDE',
    company: 'OLA Energy',
    assignedCode: 'BD-ST-10',
    location: 'Amde District, Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'OLA Energy Sorenie',
    company: 'OLA Energy',
    assignedCode: 'BD-ST-11',
    location: 'Sorenie District, Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'Oilibya Bahirdar (old agip)',
    company: 'Oilibya',
    assignedCode: 'BD-ST-12',
    location: 'Old Agip Area, Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'Yetebaberut',
    company: 'Yetebaberut Beherawi Petroleum (YBP)',
    assignedCode: 'BD-ST-13',
    location: 'Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'Ghion Fuel station (ፈለገ ግዮን ነዳጅ ማደያ)',
    nameAmharic: 'ፈለገ ግዮን ነዳጅ ማደያ',
    company: 'Ghion',
    assignedCode: 'BD-ST-01',
    location: 'Lake Tana Shore Boulevard, Bahir Dar',
    reconciliationStatus: 'PENDING_CONFIRMATION',
    candidateExistingCode: 'BD-ST-01',
    reconciliationNotes:
      'Possible match with pilot station BD-ST-01 (Tana Energy Fuel Station). Left unchanged pending human confirmation to protect 8 live transactions and 32 logs.',
  },
  {
    officialName: 'Ella Petroleum',
    company: 'Ella Petroleum',
    assignedCode: 'BD-ST-14',
    location: 'Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'JR petroleum',
    company: 'JR Petroleum',
    assignedCode: 'BD-ST-15',
    location: 'Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'Abissiniya petrol',
    company: 'Abyssinia Petroleum',
    assignedCode: 'BD-ST-16',
    location: 'Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'Bahir Dar African Oil',
    company: 'African Oil',
    assignedCode: 'BD-ST-17',
    location: 'Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'Delta petroleum',
    company: 'Delta Petroleum',
    assignedCode: 'BD-ST-18',
    location: 'Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'Bahir Dar University Fuel Station',
    company: 'BDU / Institutional',
    assignedCode: 'BD-ST-19',
    location: 'Bahir Dar University Main Campus, Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'Gomeju oil',
    company: 'Gomeju Oil Ethiopia',
    assignedCode: 'BD-ST-20',
    location: 'Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'Zemen Oil Ethiopia',
    company: 'Zemen Oil Ethiopia',
    assignedCode: 'BD-ST-21',
    location: 'Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
  {
    officialName: 'Amany Yeshi Gulf Oil (አማኒ የሽ የገልፍ ዘይት አከፋፋይ)',
    nameAmharic: 'አማኒ የሽ የገልፍ ዘይት አከፋፋይ',
    company: 'Gulf Oil',
    assignedCode: 'BD-ST-22',
    location: 'Bahir Dar',
    reconciliationStatus: 'MISSING',
    reconciliationNotes: 'Genuinely missing from database. Safe insertion as new station.',
  },
];
