/**
 * Utility to set document.title prior to window.print() so the browser's
 * default "Save as PDF" filename reflects the farmer's name and ID.
 */

export const sanitizeFileName = (str: string): string => {
  return str.replace(/[/\\?%*:|"<>]/g, '').trim();
};

export const printWithTitle = (customTitle: string): void => {
  const originalTitle = document.title;
  const safeTitle = sanitizeFileName(customTitle);

  // Set document title so the browser uses it as default PDF filename
  document.title = safeTitle;

  const restoreTitle = () => {
    document.title = originalTitle;
    window.removeEventListener('afterprint', restoreTitle);
  };

  // Modern browsers fire afterprint when dialog is printed or cancelled
  window.addEventListener('afterprint', restoreTitle);

  // Trigger print dialog
  window.print();

  // Fallback in case afterprint does not fire
  setTimeout(() => {
    document.title = originalTitle;
  }, 2500);
};

export const printFarmerCardDocument = (
  farmer: { fullName: string; farmerCode: string },
  side: 'front' | 'back' | 'both' = 'front'
): void => {
  const sideLabel = side === 'both' ? 'Front-Back' : side === 'front' ? 'Front' : 'Back';
  const title = `${farmer.fullName} (${farmer.farmerCode}) - Digital Fuel Card - ${sideLabel}`;
  printWithTitle(title);
};

export const printBatchCardsDocument = (count: number, side: 'front' | 'back' = 'front'): void => {
  const dateStr = new Date().toISOString().slice(0, 10);
  const sideLabel = side === 'front' ? 'Front' : 'Back';
  const title = `Farmer Cards Batch (${count} Farmers) - ${sideLabel} - ${dateStr}`;
  printWithTitle(title);
};

export const printReceiptDocument = (
  receiptNumber: string,
  farmerName?: string,
  farmerCode?: string
): void => {
  const farmerPart = farmerName ? ` - ${farmerName}` : farmerCode ? ` - ${farmerCode}` : '';
  const title = `Fuel Dispense Receipt - ${receiptNumber}${farmerPart}`;
  printWithTitle(title);
};
