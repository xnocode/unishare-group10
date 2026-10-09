export interface MarketplaceItem {
  id: string;
  name: string;
  category: string;
  price: number;
  deposit: number;
  area: string;
  owner: string;
  initials: string;
  image: string;
  available: boolean;
  description: string;
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
];

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

