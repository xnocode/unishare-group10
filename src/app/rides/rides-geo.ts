/**
 * Shared Dhaka campus geography, Web Mercator tile projection,
 * and shared-commute fare split helpers for /rides.
 */

export interface CampusLandmark {
  id: string;
  label: string;
  name: string;
  lat: number;
  lng: number;
  isQuickHub?: boolean;
}

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface FareEstimate {
  distanceKm: number;
  durationMins: number;
  soloFareBdt: number;
  sharedFareBdt: number;
  savingsBdt: number;
  savingsPercent: number;
  corridorLabel: string;
}

/** Major University of Dhaka & Dhaka commuter landmarks with accurate GPS coordinates. */
export const DHAKA_CAMPUS_LANDMARKS: CampusLandmark[] = [
  { id: "tsc", label: "TSC, DU", name: "TSC, University of Dhaka", lat: 23.7317, lng: 90.3957, isQuickHub: true },
  { id: "curzon", label: "Curzon Hall", name: "Curzon Hall, University of Dhaka", lat: 23.7275, lng: 90.4025, isQuickHub: true },
  { id: "shahbagh", label: "Shahbagh", name: "Shahbagh, Dhaka", lat: 23.7388, lng: 90.3954 },
  { id: "nilkhet", label: "Nilkhet", name: "Nilkhet More, Dhaka", lat: 23.7335, lng: 90.3868 },
  { id: "sciencelab", label: "Science Lab", name: "Science Lab, Dhaka", lat: 23.7402, lng: 90.3846, isQuickHub: true },
  { id: "dhanmondi32", label: "Dhanmondi 32", name: "Dhanmondi 32, Dhaka", lat: 23.7510, lng: 90.3770, isQuickHub: true },
  { id: "dhanmondi27", label: "Dhanmondi 27", name: "Dhanmondi 27, Dhaka", lat: 23.7550, lng: 90.3720 },
  { id: "kalabagan", label: "Kalabagan", name: "Kalabagan Bus Stand, Dhaka", lat: 23.7463, lng: 90.3806 },
  { id: "farmgate", label: "Farmgate", name: "Farmgate, Dhaka", lat: 23.7580, lng: 90.3900, isQuickHub: true },
  { id: "karwanbazar", label: "Karwan Bazar", name: "Karwan Bazar, Dhaka", lat: 23.7516, lng: 90.3932 },
  { id: "hatirjheel", label: "Hatirjheel", name: "Hatirjheel Promenade, Dhaka", lat: 23.7660, lng: 90.4120 },
  { id: "mohakhali", label: "Mohakhali", name: "Mohakhali DOHS, Dhaka", lat: 23.7780, lng: 90.4040 },
  { id: "banani11", label: "Banani 11", name: "Banani 11, Dhaka", lat: 23.7925, lng: 90.4078 },
  { id: "mirpur10", label: "Mirpur 10", name: "Mirpur 10 Circle, Dhaka", lat: 23.8070, lng: 90.3686, isQuickHub: true },
  { id: "agargaon", label: "Agargaon", name: "Agargaon Metro Station, Dhaka", lat: 23.7784, lng: 90.3797 },
  { id: "motijheel", label: "Motijheel", name: "Motijheel Shapla Chattar, Dhaka", lat: 23.7330, lng: 90.4172 },
  { id: "uttara", label: "Uttara Azampur", name: "Uttara Azampur, Dhaka", lat: 23.8682, lng: 90.4004 },
];

export const QUICK_CAMPUS_DESTINATIONS = DHAKA_CAMPUS_LANDMARKS.filter((lm) => lm.isQuickHub);

/** Vector road geometries (in real lat/lng) used as offline-safe arterial base under OSM tiles. */
export const DHAKA_ARTERIAL_ROADS: Array<{ id: string; primary?: boolean; points: LatLngPoint[] }> = [
  {
    id: "mirpur-road",
    primary: true,
    points: [
      { lat: 23.8070, lng: 90.3686 }, // Mirpur 10
      { lat: 23.7784, lng: 90.3797 }, // Agargaon
      { lat: 23.7550, lng: 90.3720 }, // Dhanmondi 27
      { lat: 23.7510, lng: 90.3770 }, // Dhanmondi 32
      { lat: 23.7402, lng: 90.3846 }, // Science Lab
      { lat: 23.7335, lng: 90.3868 }, // Nilkhet
      { lat: 23.7317, lng: 90.3957 }, // TSC
    ],
  },
  {
    id: "kazi-nazrul-ave",
    primary: true,
    points: [
      { lat: 23.8682, lng: 90.4004 }, // Uttara
      { lat: 23.7925, lng: 90.4078 }, // Banani 11
      { lat: 23.7780, lng: 90.4040 }, // Mohakhali
      { lat: 23.7580, lng: 90.3900 }, // Farmgate
      { lat: 23.7516, lng: 90.3932 }, // Karwan Bazar
      { lat: 23.7388, lng: 90.3954 }, // Shahbagh
      { lat: 23.7317, lng: 90.3957 }, // TSC
      { lat: 23.7275, lng: 90.4025 }, // Curzon Hall
    ],
  },
  {
    id: "satmasjid-east-west",
    points: [
      { lat: 23.7550, lng: 90.3720 }, // Dhanmondi 27
      { lat: 23.7580, lng: 90.3900 }, // Farmgate
      { lat: 23.7660, lng: 90.4120 }, // Hatirjheel
    ],
  },
  {
    id: "shahbagh-motijheel",
    points: [
      { lat: 23.7402, lng: 90.3846 }, // Science Lab
      { lat: 23.7388, lng: 90.3954 }, // Shahbagh
      { lat: 23.7330, lng: 90.4172 }, // Motijheel
    ],
  },
];

export const DHAKA_GEO_FEATURES = {
  dhanmondiLake: [
    { lat: 23.756, lng: 90.374 },
    { lat: 23.749, lng: 90.377 },
    { lat: 23.742, lng: 90.379 },
    { lat: 23.741, lng: 90.375 },
    { lat: 23.750, lng: 90.373 },
  ],
  hatirjheelLake: [
    { lat: 23.769, lng: 90.403 },
    { lat: 23.768, lng: 90.422 },
    { lat: 23.759, lng: 90.424 },
    { lat: 23.759, lng: 90.406 },
  ],
  ramnaGreen: [
    { lat: 23.743, lng: 90.397 },
    { lat: 23.743, lng: 90.406 },
    { lat: 23.730, lng: 90.405 },
    { lat: 23.729, lng: 90.394 },
  ],
};

/** Compute Earth-surface distance in km via Haversine formula. */
export function computeDistanceKm(a: LatLngPoint, b: LatLngPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Match an arbitrary string to the closest known campus landmark if coordinates are missing. */
export function resolveLandmarkByName(query: string): CampusLandmark | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return (
    DHAKA_CAMPUS_LANDMARKS.find(
      (lm) =>
        lm.name.toLowerCase().includes(q) ||
        lm.label.toLowerCase().includes(q) ||
        q.includes(lm.label.toLowerCase())
    ) || null
  );
}

/** Find the closest landmark to a geographic point. */
export function findNearestLandmark(pt: LatLngPoint): CampusLandmark {
  let nearest = DHAKA_CAMPUS_LANDMARKS[0];
  let minDist = Infinity;
  for (const lm of DHAKA_CAMPUS_LANDMARKS) {
    const dist = computeDistanceKm(pt, lm);
    if (dist < minDist) {
      minDist = dist;
      nearest = lm;
    }
  }
  return nearest;
}

/** Suggest a realistic corridor label + travel fare split in BDT for shared Dhaka commutes. */
export function estimateSharedCommute(
  pickup: LatLngPoint,
  destination: LatLngPoint,
  totalRiders = 2
): FareEstimate {
  // Multiply straight-line distance by ~1.32 Dhaka road detour factor
  const straightKm = computeDistanceKm(pickup, destination);
  const roadKm = Math.max(0.6, Math.round(straightKm * 1.32 * 10) / 10);
  const durationMins = Math.max(5, Math.round(roadKm * 3.1 + 4));

  const riderCount = Math.max(2, Math.min(totalRiders, 4));
  // Dhaka CNG / ride-share baseline (~35 BDT base + 22 BDT/km, rounded to nearest 5)
  const rawSolo = 35 + roadKm * 22;
  const soloFareBdt = Math.max(50, Math.round(rawSolo / 5) * 5);
  const sharedFareBdt = Math.max(20, Math.round(soloFareBdt / riderCount / 5) * 5);
  const savingsBdt = Math.max(0, soloFareBdt - sharedFareBdt);
  const savingsPercent = Math.round((savingsBdt / soloFareBdt) * 100);

  // Pick a concise corridor summary from road alignment
  const avgLat = (pickup.lat + destination.lat) / 2;
  const avgLng = (pickup.lng + destination.lng) / 2;
  let corridorLabel = "via Shahbagh & Campus Rd";
  if (avgLng < 90.382) {
    corridorLabel = avgLat > 23.765 ? "via Mirpur Rd & Agargaon" : "via Mirpur Rd & Science Lab";
  } else if (avgLng > 90.402) {
    corridorLabel = avgLat > 23.758 ? "via Hatirjheel & Mohakhali" : "via Shahbagh & Curzon Rd";
  } else if (avgLat > 23.76) {
    corridorLabel = "via Kazi Nazrul Islam Ave";
  }

  return {
    distanceKm: roadKm,
    durationMins,
    soloFareBdt,
    sharedFareBdt,
    savingsBdt,
    savingsPercent,
    corridorLabel,
  };
}

/** Convert (lat, lng) -> world pixels at Web Mercator zoom `z`. */
export function latLngToWorld(lat: number, lng: number, zoom: number): { wx: number; wy: number } {
  const worldSize = 256 * Math.pow(2, zoom);
  const wx = ((lng + 180) / 360) * worldSize;
  const sin = Math.sin((lat * Math.PI) / 180);
  const clampedSin = Math.max(-0.9999, Math.min(0.9999, sin));
  const wy = (0.5 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (4 * Math.PI)) * worldSize;
  return { wx, wy };
}

/** Convert world pixels -> (lat, lng) at Web Mercator zoom `z`. */
export function worldToLatLng(wx: number, wy: number, zoom: number): LatLngPoint {
  const worldSize = 256 * Math.pow(2, zoom);
  const lng = (wx / worldSize) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * wy) / worldSize;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

/** Project (lat, lng) -> pixel coordinates inside a map container of `width` x `height`. */
export function projectToScreen(
  point: LatLngPoint,
  center: LatLngPoint,
  zoom: number,
  width: number,
  height: number
): { x: number; y: number } {
  const cWorld = latLngToWorld(center.lat, center.lng, zoom);
  const pWorld = latLngToWorld(point.lat, point.lng, zoom);
  return {
    x: Math.round((pWorld.wx - (cWorld.wx - width / 2)) * 10) / 10,
    y: Math.round((pWorld.wy - (cWorld.wy - height / 2)) * 10) / 10,
  };
}

/** Reverse-project container screen pixel `(x, y)` -> `(lat, lng)`. */
export function screenToLatLng(
  x: number,
  y: number,
  center: LatLngPoint,
  zoom: number,
  width: number,
  height: number
): LatLngPoint {
  const cWorld = latLngToWorld(center.lat, center.lng, zoom);
  const wx = cWorld.wx - width / 2 + x;
  const wy = cWorld.wy - height / 2 + y;
  return worldToLatLng(wx, wy, zoom);
}

/** Build a smooth quadratic curve between two projected points. */
export function buildCurvedRoutePath(x1: number, y1: number, x2: number, y2: number, curveBias = 0.16): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const mx = (x1 + x2) / 2 - dy * curveBias;
  const my = (y1 + y2) / 2 + dx * curveBias;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/** Calculate appropriate integer OSM zoom & center framing two or more points. */
export function computeFitViewport(
  points: LatLngPoint[],
  width: number,
  height: number
): { center: LatLngPoint; zoom: number } {
  if (points.length === 0) {
    return { center: { lat: 23.748, lng: 90.388 }, zoom: 13 };
  }
  if (points.length === 1) {
    return { center: points[0], zoom: 14 };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const pt of points) {
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    if (pt.lng < minLng) minLng = pt.lng;
    if (pt.lng > maxLng) maxLng = pt.lng;
  }

  const center = {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };

  const padW = Math.max(220, width - 200);
  const padH = Math.max(180, height - 210);

  for (let z = 16; z >= 11; z--) {
    const sw = latLngToWorld(minLat, minLng, z);
    const ne = latLngToWorld(maxLat, maxLng, z);
    const spanX = Math.abs(ne.wx - sw.wx);
    const spanY = Math.abs(sw.wy - ne.wy);
    if (spanX <= padW && spanY <= padH) {
      return { center, zoom: z };
    }
  }

  return { center, zoom: 12 };
}

