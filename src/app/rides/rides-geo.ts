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

export type RideTransportMode = "cng" | "car" | "rickshaw";

export interface FareEstimate {
  mode: RideTransportMode;
  distanceKm: number;
  durationMins: number;
  soloFareBdt: number;
  sharedFareBdt: number;
  savingsBdt: number;
  savingsPercent: number;
  monthlySavingsBdt: number;
  corridorLabel: string;
  mrtHint: string | null;
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

  // Universities
  { id: "uits", label: "UITS", name: "UITS, Dhaka", lat: 23.7786, lng: 90.4269, isQuickHub: true },
  { id: "nsu", label: "NSU", name: "North South University, Dhaka", lat: 23.8137, lng: 90.4255, isQuickHub: true },
  { id: "brac", label: "BRAC University", name: "BRAC University, Dhaka", lat: 23.7781, lng: 90.4017 },
  { id: "iub", label: "IUB", name: "Independent University Bangladesh, Dhaka", lat: 23.8206, lng: 90.4278 },
  { id: "uiu", label: "UIU", name: "United International University, Dhaka", lat: 23.7786, lng: 90.4269 },
  { id: "aiub", label: "AIUB", name: "American International University Bangladesh, Dhaka", lat: 23.8319, lng: 90.4229 },
  { id: "buet", label: "BUET", name: "Bangladesh University of Engineering & Technology, Dhaka", lat: 23.7262, lng: 90.3922 },
  { id: "bracu_annex", label: "BRAC Annex", name: "BRAC University Annex Building, Dhaka", lat: 23.7465, lng: 90.3961 },
  { id: "diu", label: "DIU", name: "Daffodil International University, Dhaka", lat: 23.7332, lng: 90.3570 },
  { id: "sust_dhaka", label: "EWU", name: "East West University, Dhaka", lat: 23.7691, lng: 90.4215 },
  { id: "iubat", label: "IUBAT", name: "IUBAT University, Dhaka", lat: 23.8762, lng: 90.3844 },

  // Extra transit hubs
  { id: "gulshan1", label: "Gulshan 1", name: "Gulshan 1 Circle, Dhaka", lat: 23.7812, lng: 90.4142 },
  { id: "gulshan2", label: "Gulshan 2", name: "Gulshan 2 Circle, Dhaka", lat: 23.7961, lng: 90.4147 },
  { id: "badda", label: "Badda", name: "Badda, Dhaka", lat: 23.7792, lng: 90.4328 },
  { id: "rampura", label: "Rampura", name: "Rampura Bridge, Dhaka", lat: 23.7626, lng: 90.4273 },
  { id: "bashundhara", label: "Bashundhara", name: "Bashundhara R/A, Dhaka", lat: 23.8139, lng: 90.4291 },
  { id: "airport", label: "Airport", name: "Hazrat Shahjalal International Airport, Dhaka", lat: 23.8515, lng: 90.4072 },
  { id: "gazipur", label: "Gazipur", name: "Gazipur Chowrasta, Dhaka", lat: 23.9999, lng: 90.4208 },
  { id: "narayanganj", label: "Narayanganj", name: "Narayanganj, Dhaka", lat: 23.6238, lng: 90.5000 },
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

const MRT_LINE_6_STATIONS: Array<{ name: string; lat: number; lng: number }> = [
  { name: "Uttara", lat: 23.8682, lng: 90.4004 },
  { name: "Mirpur 10", lat: 23.8070, lng: 90.3686 },
  { name: "Agargaon", lat: 23.7784, lng: 90.3797 },
  { name: "Farmgate", lat: 23.7580, lng: 90.3900 },
  { name: "Karwan Bazar", lat: 23.7516, lng: 90.3932 },
  { name: "Shahbagh", lat: 23.7388, lng: 90.3954 },
  { name: "Dhaka University", lat: 23.7317, lng: 90.3957 },
  { name: "Motijheel", lat: 23.7330, lng: 90.4172 },
];

function findNearbyMrtStation(pt: LatLngPoint): string | null {
  let best: string | null = null;
  let bestKm = 2.0;
  for (const st of MRT_LINE_6_STATIONS) {
    const km = computeDistanceKm(pt, st);
    if (km <= bestKm) {
      bestKm = km;
      best = st.name;
    }
  }
  return best;
}

/** Suggest a realistic corridor label + travel fare split in BDT for shared Dhaka commutes. */
export function estimateSharedCommute(
  pickup: LatLngPoint,
  destination: LatLngPoint,
  totalRiders = 2,
  mode: RideTransportMode = "cng"
): FareEstimate {
  // Multiply straight-line distance by ~1.32 Dhaka road detour factor
  const straightKm = computeDistanceKm(pickup, destination);
  const roadKm = Math.max(0.6, Math.round(straightKm * 1.32 * 10) / 10);
  const speedFactor = mode === "rickshaw" ? 4.8 : mode === "car" ? 2.9 : 3.1;
  const durationMins = Math.max(5, Math.round(roadKm * speedFactor + 4));

  const maxSeats = mode === "rickshaw" ? 2 : mode === "cng" ? 3 : 4;
  const riderCount = Math.max(2, Math.min(totalRiders, maxSeats));

  // Mode-specific realistic Dhaka base & per-km rates (rounded cleanly to nearest 5 BDT)
  const rawSolo =
    mode === "car"
      ? 55 + roadKm * 30
      : mode === "rickshaw"
      ? 20 + roadKm * 18
      : 35 + roadKm * 22;
  const minSolo = mode === "rickshaw" ? 30 : mode === "car" ? 80 : 50;
  const soloFareBdt = Math.max(minSolo, Math.round(rawSolo / 5) * 5);
  const sharedFareBdt = Math.max(15, Math.round(soloFareBdt / riderCount / 5) * 5);
  const savingsBdt = Math.max(0, soloFareBdt - sharedFareBdt);
  const savingsPercent = Math.round((savingsBdt / soloFareBdt) * 100);
  const monthlySavingsBdt = savingsBdt * 40; // ~20 round-trip campus commutes/month

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

  const nearStartMrt = findNearbyMrtStation(pickup);
  const nearEndMrt = findNearbyMrtStation(destination);
  const mrtHint =
    nearStartMrt && nearEndMrt && nearStartMrt !== nearEndMrt && roadKm >= 2.2
      ? `Metro Line-6 (${nearStartMrt} → ${nearEndMrt}) is also ~৳20–30 solo`
      : null;

  return {
    mode,
    distanceKm: roadKm,
    durationMins,
    soloFareBdt,
    sharedFareBdt,
    savingsBdt,
    savingsPercent,
    monthlySavingsBdt,
    corridorLabel,
    mrtHint,
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

