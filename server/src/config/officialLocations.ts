export interface OfficialKebeleDef {
  name: string;
  code: string;
}

export interface OfficialSubCityDef {
  code: string;
  name: string;
  kebeles: OfficialKebeleDef[];
}

export const OFFICIAL_SUB_CITIES: OfficialSubCityDef[] = [
  {
    code: 'SC-TANA',
    name: 'ጣና ክፍለ ከተማ',
    kebeles: [
      { name: 'ጨንታ ቀበሌ', code: 'KB-TANA-01' },
      { name: 'ወራሚት ቀበሌ', code: 'KB-TANA-02' },
      { name: 'ጭጫ አታንኩሳ ቀበሌ', code: 'KB-TANA-03' },
      { name: 'ወገልሳ ቀበሌ', code: 'KB-TANA-04' },
      { name: 'ወንዠጣ ቀበሌ', code: 'KB-TANA-05' },
      { name: 'ዘጌ መሪ ማዘጋጃ ቤት', code: 'KB-TANA-06' },
      { name: 'ይጋንዳ ቀበሌ', code: 'KB-TANA-07' },
      { name: 'ኡራ ቀበሌ', code: 'KB-TANA-08' },
      { name: 'ህዳሴ ቀበሌ', code: 'KB-TANA-09' },
      { name: 'ባታ ቀበሌ', code: 'KB-TANA-10' },
      { name: 'ሽምብጥ ቀበሌ', code: 'KB-TANA-11' },
      { name: 'ምድረ ገነት ቀበሌ', code: 'KB-TANA-12' },
      { name: 'ራስአገዝ ቀበሌ', code: 'KB-TANA-13' },
    ],
  },
  {
    code: 'SC-BELAY-ZELEKE',
    name: 'በላይ ዘለቀ ክፍለ ከተማ',
    kebeles: [
      { name: 'ቀበሌ 07', code: 'KB-BZ-01' },
      { name: 'ሀገረሰላም ቀበሌ', code: 'KB-BZ-02' },
      { name: 'ብስራት ቀበሌ', code: 'KB-BZ-03' },
      { name: 'ሰባታሚት ታዳጊ ቀበሌ', code: 'KB-BZ-04' },
      { name: 'ሰባታሚት ዙሪያ ቀበሌ', code: 'KB-BZ-05' },
      { name: 'ጢስ አባይ መሪ ማዘጋጃ ቤት', code: 'KB-BZ-06' },
      { name: 'የግንድ ዘሞቻ ቀበሌ', code: 'KB-BZ-07' },
      { name: 'ዳሰራ ቀበሌ', code: 'KB-BZ-08' },
      { name: 'ማጂ ቀበሌ', code: 'KB-BZ-09' },
      { name: 'ሁለቱ ይጎማ ቀበሌ', code: 'KB-BZ-10' },
    ],
  },
  {
    code: 'SC-DAGMAWI-MENELIK',
    name: 'ዳግማዊ ምኒልክ ክፍለ ከተማ',
    kebeles: [
      { name: 'ሰላም ቀበሌ', code: 'KB-DM-01' },
      { name: 'ምድረ ገነት ቀበሌ', code: 'KB-DM-02' },
      { name: 'አዲስ አምባ ቀበሌ', code: 'KB-DM-03' },
      { name: 'ማርዘነብ ቀበሌ', code: 'KB-DM-04' },
      { name: 'ፍኖተ ቀበሌ', code: 'KB-DM-05' },
      { name: 'አዲስ ዓለም ቀበሌ', code: 'KB-DM-06' },
      { name: 'ሶስቱ ይነሳ ቀበሌ', code: 'KB-DM-07' },
      { name: 'ወርቃምላ አቻድር ቀበሌ', code: 'KB-DM-08' },
      { name: 'ይባብ ቀበሌ', code: 'KB-DM-09' },
      { name: 'ይሎማና ይገንፋት ቀበሌ', code: 'KB-DM-10' },
      { name: 'መሸንቲ ንዑስ ማዘጋጃ ቤት', code: 'KB-DM-11' },
    ],
  },
  {
    code: 'SC-ATSE-TEWODROS',
    name: 'አፄ ቴዎድሮስ ክፍለ ከተማ',
    kebeles: [
      { name: 'ማራኪ ቀበሌ', code: 'KB-AT-01' },
      { name: 'አባይ ራስ ቀበሌ', code: 'KB-AT-02' },
      { name: 'ጤይማ ቀበሌ', code: 'KB-AT-03' },
      { name: 'አዲስ ዓለም ቀበሌ', code: 'KB-AT-04' },
      { name: 'አየር ጤና ቀበሌ', code: 'KB-AT-05' },
      { name: 'ዘንዘልማ ቀበሌ', code: 'KB-AT-06' },
      { name: 'ወረብ ቀበሌ', code: 'KB-AT-07' },
      { name: 'የሞሽት ቀበሌ', code: 'KB-AT-08' },
      { name: 'ተንታ ላጉና ቀበሌ', code: 'KB-AT-09' },
      { name: 'ተንታ ቂርቆስ ቀበሌ', code: 'KB-AT-10' },
      { name: 'ሮቢት ቀበሌ', code: 'KB-AT-11' },
    ],
  },
];
