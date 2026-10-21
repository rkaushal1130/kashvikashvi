/**
 * Comprehensive Indian & International Commercial Banks Catalog
 * Tailored for RazorpayX, Cashfree, and RBI NEFT/RTGS/IMPS Settlement Rails.
 */

export const INDIAN_BANKS = [
  // Top / Preferred Corporate Banks
  { code: 'HDFC', name: 'HDFC Bank', ifscPrefix: 'HDFC0', category: 'Popular Corporate', popular: true },
  { code: 'ICIC', name: 'ICICI Bank', ifscPrefix: 'ICIC0', category: 'Popular Corporate', popular: true },
  { code: 'SBIN', name: 'State Bank of India (SBI)', ifscPrefix: 'SBIN0', category: 'Popular Corporate', popular: true },
  { code: 'UTIB', name: 'Axis Bank', ifscPrefix: 'UTIB0', category: 'Popular Corporate', popular: true },
  { code: 'KKBK', name: 'Kotak Mahindra Bank', ifscPrefix: 'KKBK0', category: 'Popular Corporate', popular: true },
  { code: 'RATN', name: 'RBL Bank (RazorpayX Float Partner)', ifscPrefix: 'RATN0', category: 'Popular Corporate', popular: true },
  { code: 'PUNB', name: 'Punjab National Bank (PNB)', ifscPrefix: 'PUNB0', category: 'Popular Corporate', popular: true },
  { code: 'BARB', name: 'Bank of Baroda', ifscPrefix: 'BARB0', category: 'Popular Corporate', popular: true },

  // Public Sector Banks
  { code: 'CNRB', name: 'Canara Bank', ifscPrefix: 'CNRB0', category: 'Public Sector Banks' },
  { code: 'UBIN', name: 'Union Bank of India', ifscPrefix: 'UBIN0', category: 'Public Sector Banks' },
  { code: 'BKID', name: 'Bank of India (BOI)', ifscPrefix: 'BKID0', category: 'Public Sector Banks' },
  { code: 'IDIB', name: 'Indian Bank', ifscPrefix: 'IDIB0', category: 'Public Sector Banks' },
  { code: 'CBIN', name: 'Central Bank of India', ifscPrefix: 'CBIN0', category: 'Public Sector Banks' },
  { code: 'IOBA', name: 'Indian Overseas Bank', ifscPrefix: 'IOBA0', category: 'Public Sector Banks' },
  { code: 'UCBA', name: 'UCO Bank', ifscPrefix: 'UCBA0', category: 'Public Sector Banks' },
  { code: 'MAHB', name: 'Bank of Maharashtra', ifscPrefix: 'MAHB0', category: 'Public Sector Banks' },
  { code: 'PSIB', name: 'Punjab & Sind Bank', ifscPrefix: 'PSIB0', category: 'Public Sector Banks' },

  // Private Sector Banks
  { code: 'INDB', name: 'IndusInd Bank', ifscPrefix: 'INDB0', category: 'Private Sector Banks' },
  { code: 'YESB', name: 'Yes Bank', ifscPrefix: 'YESB0', category: 'Private Sector Banks' },
  { code: 'IDFB', name: 'IDFC FIRST Bank', ifscPrefix: 'IDFB0', category: 'Private Sector Banks' },
  { code: 'FDRL', name: 'Federal Bank', ifscPrefix: 'FDRL0', category: 'Private Sector Banks' },
  { code: 'SIBL', name: 'South Indian Bank', ifscPrefix: 'SIBL0', category: 'Private Sector Banks' },
  { code: 'BDBL', name: 'Bandhan Bank', ifscPrefix: 'BDBL0', category: 'Private Sector Banks' },
  { code: 'CIUB', name: 'City Union Bank', ifscPrefix: 'CIUB0', category: 'Private Sector Banks' },
  { code: 'KVBL', name: 'Karur Vysya Bank', ifscPrefix: 'KVBL0', category: 'Private Sector Banks' },
  { code: 'TMBL', name: 'Tamilnad Mercantile Bank', ifscPrefix: 'TMBL0', category: 'Private Sector Banks' },
  { code: 'JAKA', name: 'Jammu & Kashmir Bank', ifscPrefix: 'JAKA0', category: 'Private Sector Banks' },
  { code: 'KARB', name: 'Karnataka Bank', ifscPrefix: 'KARB0', category: 'Private Sector Banks' },
  { code: 'DLXB', name: 'Dhanlaxmi Bank', ifscPrefix: 'DLXB0', category: 'Private Sector Banks' },
  { code: 'CSBK', name: 'CSB Bank', ifscPrefix: 'CSBK0', category: 'Private Sector Banks' },

  // Small Finance & Payments Banks
  { code: 'AUBL', name: 'AU Small Finance Bank', ifscPrefix: 'AUBL0', category: 'Small Finance & Payments Banks' },
  { code: 'ESFB', name: 'Equitas Small Finance Bank', ifscPrefix: 'ESFB0', category: 'Small Finance & Payments Banks' },
  { code: 'UJVN', name: 'Ujjivan Small Finance Bank', ifscPrefix: 'UJVN0', category: 'Small Finance & Payments Banks' },
  { code: 'AIRP', name: 'Airtel Payments Bank', ifscPrefix: 'AIRP0', category: 'Small Finance & Payments Banks' },
  { code: 'IPOS', name: 'India Post Payments Bank', ifscPrefix: 'IPOS0', category: 'Small Finance & Payments Banks' },
  { code: 'PYTM', name: 'Paytm Payments Bank', ifscPrefix: 'PYTM0', category: 'Small Finance & Payments Banks' },

  // International Commercial Banks in India
  { code: 'SCBL', name: 'Standard Chartered Bank', ifscPrefix: 'SCBL0', category: 'Foreign Commercial Banks' },
  { code: 'CITI', name: 'Citibank India', ifscPrefix: 'CITI0', category: 'Foreign Commercial Banks' },
  { code: 'HSBC', name: 'HSBC India', ifscPrefix: 'HSBC0', category: 'Foreign Commercial Banks' },
  { code: 'DBSS', name: 'DBS Bank India', ifscPrefix: 'DBSS0', category: 'Foreign Commercial Banks' },
  { code: 'DEUT', name: 'Deutsche Bank India', ifscPrefix: 'DEUT0', category: 'Foreign Commercial Banks' },
];

export const POPULAR_BANKS = INDIAN_BANKS.filter((b) => b.popular);

export const BANK_CATEGORIES = [
  'Popular Corporate',
  'Private Sector Banks',
  'Public Sector Banks',
  'Small Finance & Payments Banks',
  'Foreign Commercial Banks',
];

export function findBankByCode(code) {
  if (!code) return null;
  return INDIAN_BANKS.find((b) => b.code.toUpperCase() === code.toUpperCase()) || null;
}

export function findBankByName(name) {
  if (!name) return null;
  return (
    INDIAN_BANKS.find((b) => b.name.toLowerCase() === name.toLowerCase()) ||
    INDIAN_BANKS.find((b) => b.name.toLowerCase().includes(name.toLowerCase())) ||
    null
  );
}
