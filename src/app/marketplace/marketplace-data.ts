export interface MarketplaceItem {
  id: string;
  name: string;
  category: string;
  price: number;
  deposit: number;
  area: string;
  owner: string;
  ownerEmail?: string;
  initials: string;
  image: string;
  available: boolean;
  condition?: string;
  maxRentalDays?: number;
  accessories?: string;
  description: string;
}

export interface MyProductRecord {
  id: string;
  name: string;
  category: string;
  condition: string;
  state: 'active' | 'paused' | 'draft';
  isRentedOut?: boolean;
  rate: number;
  deposit: number;
  area?: string;
  maxRentalDays?: number;
  description?: string;
  image: string;
  note: string;
  availText: string;
  owner: string;
}

export const CATEGORY_IMAGE_MAP: Record<string, string> = {
  Calculators: '/images/landing/calculator.jpeg',
  Footballs: '/images/landing/football.jpeg',
  'Laptop chargers': '/images/landing/laptop-charger.jpeg',
  'Phone chargers': '/images/landing/phone-charger.jpeg',
  Earphones: '/images/landing/earphones.jpeg',
  AirPods: '/images/landing/airpods.jpeg',
  Cameras: '/images/products/product-1.jpeg',
  'Study essentials': '/images/products/product-2.jpeg',
  'Camera accessories': '/images/products/product-3.jpeg',
  'Travel essentials': '/images/products/product-4.jpeg',
};

export const PRESET_PRODUCT_PHOTOS = [
  { label: 'Scientific Calculator', url: '/images/landing/calculator.jpeg' },
  { label: 'DSLR Camera', url: '/images/products/product-1.jpeg' },
  { label: 'Laptop Charger', url: '/images/landing/laptop-charger.jpeg' },
  { label: 'Phone Charger', url: '/images/landing/phone-charger.jpeg' },
  { label: 'AirPods Case', url: '/images/landing/airpods.jpeg' },
  { label: 'Wired Earphones', url: '/images/landing/earphones.jpeg' },
  { label: 'Match Football', url: '/images/landing/football.jpeg' },
  { label: 'Study Lamp', url: '/images/products/product-2.jpeg' },
  { label: 'Camera Tripod', url: '/images/products/product-3.jpeg' },
  { label: 'Campus Backpack', url: '/images/products/product-4.jpeg' },
];

export function getDefaultImageForCategory(category: string): string {
  return CATEGORY_IMAGE_MAP[category] || '/images/landing/calculator.jpeg';
}

export interface UserProfile {
  name: string;
  email: string;
  initials: string;
  university: string;
  verified: boolean;
  department?: string;
  studentId?: string;
  tokenBalance?: number;
}

export const DEFAULT_ITEMS: MarketplaceItem[] = [
  {
    id: '1',
    name: 'Scientific calculator',
    category: 'Calculators',
    price: 40,
    deposit: 100,
    area: 'Science Library',
    owner: 'Nafis Ahmed',
    initials: 'NA',
    image: '/images/landing/calculator.jpeg',
    available: true,
    maxRentalDays: 7,
    description: 'Casio fx-991EX ClassWiz. Ideal for engineering, physics, and calculus exams.',
  },
  {
    id: '2',
    name: 'Match-day football',
    category: 'Footballs',
    price: 60,
    deposit: 100,
    area: 'DU Central Field',
    owner: 'Sakib Hasan',
    initials: 'SH',
    image: '/images/landing/football.jpeg',
    available: true,
    maxRentalDays: 3,
    description: 'FIFA standard size 5 match ball. Excellent grip, pumped and ready for match-day.',
  },
  {
    id: '3',
    name: 'Laptop charger · 65W',
    category: 'Laptop chargers',
    price: 50,
    deposit: 100,
    area: 'TSC',
    owner: 'Maliha Islam',
    initials: 'MI',
    image: '/images/landing/laptop-charger.jpeg',
    available: true,
    maxRentalDays: 7,
    description: 'Type-C 65W fast charger compatible with MacBook, Dell XPS, HP, Asus and Lenovo.',
  },
  {
    id: '4',
    name: 'AirPods with charging case',
    category: 'AirPods',
    price: 80,
    deposit: 150,
    area: 'Arts Building',
    owner: 'Rafiul Karim',
    initials: 'RK',
    image: '/images/landing/airpods.jpeg',
    available: true,
    maxRentalDays: 5,
    description: 'Noise-cancelling wireless earbuds with sanitized silicone tips and full charge.',
  },
  {
    id: '5',
    name: 'Phone charger · 45W',
    category: 'Phone chargers',
    price: 25,
    deposit: 50,
    area: 'Curzon Hall',
    owner: 'Nusrat Jahan',
    initials: 'NJ',
    image: '/images/landing/phone-charger.jpeg',
    available: true,
    maxRentalDays: 7,
    description: 'Fast dual-port USB-C & USB-A wall adapter with braided charging cable.',
  },
  {
    id: '6',
    name: 'Wired earphones',
    category: 'Earphones',
    price: 20,
    deposit: 50,
    area: 'Central Library',
    owner: 'Tanvir Ahmed',
    initials: 'TA',
    image: '/images/landing/earphones.jpeg',
    available: true,
    maxRentalDays: 14,
    description: '3.5mm jack with built-in mic. Crisp audio for online lectures and quiet study halls.',
  },
];

export const CATEGORIES = [
  'All items',
  'Calculators',
  'Footballs',
  'Laptop chargers',
  'Phone chargers',
  'Earphones',
  'AirPods',
  'Cameras',
  'Study essentials',
];

export const ITEM_CONDITIONS = ['Like new', 'Good', 'Fair'] as const;

export const PICKUP_AREAS = [
  'Science Library',
  'DU Central Field',
  'TSC',
  'Arts Building',
  'Curzon Hall',
  'Central Library',
  'Shahidullah Hall',
  'Mokarram Bhaban',
];

export function getItemById(id: string): MarketplaceItem | undefined {
  if (!id) return undefined;
  const direct = DEFAULT_ITEMS.find((item) => item.id === id);
  if (direct) return direct;

  const normalized = id.toLowerCase().replace(/[^a-z0-9]/g, '');
  return DEFAULT_ITEMS.find((item) => {
    const itemNorm = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return itemNorm.includes(normalized) || normalized.includes(itemNorm);
  });
}

export function upsertMarketplaceItem(item: MarketplaceItem) {
  if (typeof window === 'undefined') return;
  let current: MarketplaceItem[] = DEFAULT_ITEMS;
  try {
    const raw = window.localStorage.getItem('unishare_marketplace_items');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) current = parsed as MarketplaceItem[];
    }
  } catch {}
  const exists = current.some((x) => x.id === item.id);
  const next = exists
    ? current.map((x) => (x.id === item.id ? item : x))
    : [item, ...current];
  window.localStorage.setItem('unishare_marketplace_items', JSON.stringify(next));
  window.dispatchEvent(new Event('unishare-storage'));
}

export function removeMarketplaceItem(id: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem('unishare_marketplace_items');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const next = (parsed as MarketplaceItem[]).filter((x) => x.id !== id);
    window.localStorage.setItem('unishare_marketplace_items', JSON.stringify(next));
    window.dispatchEvent(new Event('unishare-storage'));
  } catch {}
}

