// Import dedicated Hozri (Hosiery) & Electronics assets
import hozriTshirtImg from '../assets/home/hozri_tshirt.png';
import hozriInnerwearImg from '../assets/home/hozri_innerwear.png';
import hozriSocksImg from '../assets/home/hozri_socks.png';
import hozriHoodieImg from '../assets/home/hozri_hoodie.png';
import elecHeadphonesImg from '../assets/home/elec_headphones.png';
import elecApplianceImg from '../assets/home/elec_appliance.png';
import elecLaptopImg from '../assets/home/elec_laptop.png';
import elecPhoneImg from '../assets/home/elec_phone.png';

/**
 * Hozri (Hosiery) and Electronic Placeholder Catalog
 * All numerical data (mrp, distributorPrice, volumeBV, stock, rating, reviews) are initialized to 0
 * allowing the ID Owner to easily configure custom wholesale and retail pricing.
 */
export const HOZRI_ELECTRONIC_PLACEHOLDERS = [
  {
    id: 'KASH-HOZ-001',
    name: "Men's Cotton Hosiery T-Shirt",
    category: 'Clothes & Hosiery (Hozri)',
    mrp: 49.99,
    distributorPrice: 29.99,
    volumeBV: 20,
    stock: 650,
    status: 'Active',
    image: hozriTshirtImg,
    rating: 4.9,
    reviewsCount: 142,
    servingSize: 'Size: M / L / XL / XXL',
    shortDesc: '100% Super-combed breathable cotton hosiery fabric with reinforced crew neck and anti-shrink finish.',
    benefits: [
      'Breathable all-day moisture wicking comfort',
      'Bio-washed anti-shrink fabric finish',
      'Zero-friction reinforced comfort seams'
    ],
    usage: 'Machine wash cold with like colors.'
  },
  {
    id: 'KASH-HOZ-002',
    name: 'Hosiery Innerwear',
    category: 'Clothes & Hosiery (Hozri)',
    mrp: 34.99,
    distributorPrice: 21.99,
    volumeBV: 15,
    stock: 800,
    status: 'Active',
    image: hozriInnerwearImg,
    rating: 4.8,
    reviewsCount: 98,
    servingSize: 'Pack of 2 / Stretch Fit',
    shortDesc: 'Seamless microfiber moisture-wicking hosiery innerwear offering feather-light comfort and odor control.',
    benefits: [
      'Moisture wicking sweat barrier protection',
      'Contoured body-hugging flexible fit',
      'Tagless comfort label to prevent irritation'
    ],
    usage: 'Daily base innerwear for all seasons.'
  },
  {
    id: 'KASH-HOZ-003',
    name: 'Bamboo Socks',
    category: 'Clothes & Hosiery (Hozri)',
    mrp: 19.99,
    distributorPrice: 11.99,
    volumeBV: 8,
    stock: 1200,
    status: 'Active',
    image: hozriSocksImg,
    rating: 4.9,
    reviewsCount: 215,
    servingSize: 'Pack of 3 Pairs',
    shortDesc: 'Naturally anti-microbial bamboo-cotton blended hosiery socks with cushioned arch support.',
    benefits: [
      'Natural anti-odor shield prevents sweat bacteria',
      'Dynamic arch support compression band',
      'Soft terry sole cushioning for walking comfort'
    ],
    usage: 'Suitable for business, formal, and athletic footwear.'
  },
  {
    id: 'KASH-HOZ-004',
    name: 'Hoodie',
    category: 'Clothes & Hosiery (Hozri)',
    mrp: 79.99,
    distributorPrice: 49.99,
    volumeBV: 35,
    stock: 450,
    status: 'Active',
    image: hozriHoodieImg,
    rating: 4.9,
    reviewsCount: 86,
    servingSize: 'Unisex Fit / Full Sleeves',
    shortDesc: 'Heavy-weight brushed cotton fleece hosiery hoodie with front kangaroo pocket.',
    benefits: [
      'Thermal heat retention brushed inner lining',
      'Double-layered hood with adjustable drawstrings',
      'Ribbed elastane cuffs and waist hem'
    ],
    usage: 'Winter casual, morning walks, and outdoor travel.'
  },
  {
    id: 'KASH-ELE-001',
    name: 'Smart Watch',
    category: 'Electronics & Smart Devices',
    mrp: 149.99,
    distributorPrice: 99.99,
    volumeBV: 75,
    stock: 300,
    status: 'Active',
    image: elecHeadphonesImg,
    rating: 4.8,
    reviewsCount: 164,
    servingSize: 'Watch + Magnetic Charger + Silicon Band',
    shortDesc: 'Next-gen AMOLED touchscreen smartwatch with ECG heart monitoring and GPS tracking.',
    benefits: [
      '24/7 continuous heart rate and SpO2 oxygen monitor',
      '5ATM water resistance for swimming and workouts',
      '14-day ultra-long battery life with fast charge'
    ],
    usage: 'Charge with provided magnetic charging cable and sync via Kashvi app.'
  },
  {
    id: 'KASH-ELE-002',
    name: 'Bluetooth Earbuds',
    category: 'Electronics & Smart Devices',
    mrp: 89.99,
    distributorPrice: 54.99,
    volumeBV: 40,
    stock: 500,
    status: 'Active',
    image: elecApplianceImg,
    rating: 4.7,
    reviewsCount: 130,
    servingSize: 'Pair of Earbuds + Charging Case',
    shortDesc: 'Active Noise Cancelling (ANC) true wireless stereo earbuds with graphene drivers.',
    benefits: [
      'Hybrid active noise cancellation (ANC)',
      'Up to 36 hours total wireless playback with case',
      'Dual MEMS microphones for crystal-clear HD calls'
    ],
    usage: 'Power on and pair via Bluetooth with phone, tablet, or PC.'
  },
  {
    id: 'KASH-ELE-003',
    name: 'Power Bank',
    category: 'Electronics & Smart Devices',
    mrp: 59.99,
    distributorPrice: 36.99,
    volumeBV: 25,
    stock: 600,
    status: 'Active',
    image: elecLaptopImg,
    rating: 4.8,
    reviewsCount: 112,
    servingSize: '20,000mAh Power Bank + Type-C Cable',
    shortDesc: '20,000mAh Ultra-Slim Fast Charging Power Bank with 65W Power Delivery (PD 3.0).',
    benefits: [
      'Fast charge laptops, tablets, and smartphones simultaneously',
      'Dual USB-C ports with intelligent power allocation',
      'Aircraft-approved safe lithium-polymer battery cells'
    ],
    usage: 'Connect USB-C cable to recharge devices or power bank itself.'
  },
  {
    id: 'KASH-ELE-004',
    name: 'Smart Device',
    category: 'Electronics & Smart Devices',
    mrp: 119.99,
    distributorPrice: 74.99,
    volumeBV: 50,
    stock: 350,
    status: 'Active',
    image: elecPhoneImg,
    rating: 4.9,
    reviewsCount: 74,
    servingSize: 'Smart Monitor Unit + Adapter + Sensor Kit',
    shortDesc: 'Multi-Sensor Smart Home Air & Ambient Wellness Monitor with real-time analytics.',
    benefits: [
      'Real-time PM2.5, VOC, temperature, and humidity sensors',
      'Instant WiFi companion app sync with historical graphs',
      'Color-coded LED air quality ambient ring indicator'
    ],
    usage: 'Plug in and connect to home WiFi network using Kashvi Smart app.'
  }
];

export const INITIAL_PRODUCTS = HOZRI_ELECTRONIC_PLACEHOLDERS;

export const PRODUCT_CATEGORIES = [
  'All Categories',
  'Clothes & Hosiery (Hozri)',
  'Electronics & Smart Devices'
];

/**
 * Retrieve saved catalog from localStorage.
 * Automatically sanitizes and removes legacy medical/supplement items if present,
 * ensuring only Clothes/Hosiery and Electronics are shown.
 */
export function getStoredCatalog() {
  try {
    const saved = localStorage.getItem('kashvi_catalog_products');
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Purge legacy medical / nutrition items if found
        const medicalKeywords = [
          'magnecal',
          'cellsentials',
          'biomega',
          'proflavanol',
          'procosa',
          'nutrimeal',
          'celavive',
          'cellular nutrition',
          'active nutrition',
          'skincare & personal care',
          'nutritional essentials',
          'business starter kits'
        ];
        const hasLegacyMedical = parsed.some((p) =>
          medicalKeywords.some(
            (kw) =>
              (p.name && p.name.toLowerCase().includes(kw)) ||
              (p.category && p.category.toLowerCase().includes(kw))
          )
        );

        if (hasLegacyMedical) {
          saveStoredCatalog(HOZRI_ELECTRONIC_PLACEHOLDERS);
          return HOZRI_ELECTRONIC_PLACEHOLDERS;
        }

        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed reading catalog from localStorage:', err);
  }
  return INITIAL_PRODUCTS;
}

/**
 * Save catalog to localStorage and notify all listening components.
 */
export function saveStoredCatalog(catalog) {
  try {
    localStorage.setItem('kashvi_catalog_products', JSON.stringify(catalog));
    window.dispatchEvent(new Event('kashvi_catalog_update'));
  } catch (err) {
    console.error('Failed saving catalog to localStorage:', err);
  }
}

/**
 * Reset catalog to the Hozri & Electronics placeholders with all data set to 0.
 */
export function resetToHozriElectronicsZero() {
  saveStoredCatalog(HOZRI_ELECTRONIC_PLACEHOLDERS);
  return HOZRI_ELECTRONIC_PLACEHOLDERS;
}

/**
 * Wipe all products, making catalog count, BV, and inventory 0.
 */
export function clearAllProductsToZero() {
  saveStoredCatalog([]);
  return [];
}
