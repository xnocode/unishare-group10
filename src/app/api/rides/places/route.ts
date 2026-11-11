import { NextRequest, NextResponse } from "next/server";

interface CleanPlace {
  id: string;
  label: string;
  name: string;
  lat: number;
  lng: number;
  type?: string;
  isQuickHub?: boolean;
}

// In-memory cache for recent OSM Nominatim queries to ensure instantaneous response and avoid rate limits
const placesCache = new Map<string, { places: CleanPlace[]; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Curated default recommendations when user has not typed anything
const DEFAULT_RECOMMENDED_PLACES: CleanPlace[] = [
  { id: "uits", label: "UITS", name: "UITS (University of Information Technology & Sciences), Dhaka", lat: 23.7786, lng: 90.4269, isQuickHub: true, type: "university" },
  { id: "tsc", label: "TSC, DU", name: "TSC, University of Dhaka", lat: 23.7317, lng: 90.3957, isQuickHub: true, type: "university" },
  { id: "curzon", label: "Curzon Hall", name: "Curzon Hall, University of Dhaka", lat: 23.7275, lng: 90.4025, isQuickHub: true, type: "university" },
  { id: "nsu", label: "NSU", name: "North South University, Bashundhara, Dhaka", lat: 23.8137, lng: 90.4255, isQuickHub: true, type: "university" },
  { id: "brac", label: "BRAC University", name: "BRAC University, Merul Badda, Dhaka", lat: 23.7781, lng: 90.4017, isQuickHub: true, type: "university" },
  { id: "uiu", label: "UIU", name: "United International University, Madani Ave, Dhaka", lat: 23.7977, lng: 90.4497, isQuickHub: true, type: "university" },
  { id: "buet", label: "BUET", name: "BUET Campus, Palashi, Dhaka", lat: 23.7262, lng: 90.3922, isQuickHub: true, type: "university" },
  { id: "aiub", label: "AIUB", name: "AIUB, Kuratoli, Dhaka", lat: 23.8319, lng: 90.4229, isQuickHub: true, type: "university" },
  { id: "dhanmondi32", label: "Dhanmondi 32", name: "Dhanmondi 32, Mirpur Rd, Dhaka", lat: 23.7510, lng: 90.3770, isQuickHub: true, type: "transit" },
  { id: "farmgate", label: "Farmgate", name: "Farmgate Bus Terminal & Metro, Dhaka", lat: 23.7580, lng: 90.3900, isQuickHub: true, type: "transit" },
  { id: "sciencelab", label: "Science Lab", name: "Science Lab More, Dhaka", lat: 23.7402, lng: 90.3846, isQuickHub: true, type: "transit" },
  { id: "mirpur10", label: "Mirpur 10", name: "Mirpur 10 Circle & Metro, Dhaka", lat: 23.8070, lng: 90.3686, isQuickHub: true, type: "transit" },
  { id: "banani11", label: "Banani 11", name: "Banani Road 11, Dhaka", lat: 23.7925, lng: 90.4078, isQuickHub: true, type: "transit" },
  { id: "uttara", label: "Uttara Azampur", name: "Uttara Azampur Bus Stand, Dhaka", lat: 23.8682, lng: 90.4004, isQuickHub: true, type: "transit" },
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim().toLowerCase();

    // 1. If empty or 1 character, return smart recommended hubs
    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        recommended: true,
        places: DEFAULT_RECOMMENDED_PLACES,
      });
    }

    // 2. Check in-memory cache
    const cached = placesCache.get(query);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        places: cached.places,
      });
    }

    // 3. Match against known default recommendations first
    const localMatches = DEFAULT_RECOMMENDED_PLACES.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.label.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query)
    );

    // 4. Query live OpenStreetMap Nominatim for any location in Bangladesh
    let osmResults: CleanPlace[] = [];
    try {
      const searchUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
        query + " Dhaka"
      )}&countrycodes=bd&limit=7&addressdetails=1`;

      const response = await fetch(searchUrl, {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "UniShare-StudentCommute/1.0",
        },
        signal: AbortSignal.timeout(3500),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          osmResults = data
            .map((item: { place_id: number; lat: string; lon: string; display_name: string; name?: string; address?: Record<string, string> }) => {
              const lat = parseFloat(item.lat);
              const lng = parseFloat(item.lon);
              if (isNaN(lat) || isNaN(lng)) return null;

              const addr = item.address || {};
              const shortName = item.name || addr.road || addr.suburb || addr.quarter || addr.neighbourhood || item.display_name.split(",")[0];
              const area = addr.suburb || addr.city_district || addr.quarter || addr.neighbourhood || addr.city || "Dhaka";
              const label = shortName.trim();
              const formattedName = `${shortName}, ${area}`.replace(/, Dhaka, Dhaka/g, ", Dhaka");

              return {
                id: `osm-${item.place_id}`,
                label,
                name: formattedName,
                lat,
                lng,
                type: "address",
              } as CleanPlace;
            })
            .filter((p): p is CleanPlace => p !== null);
        }
      }
    } catch {
      // If OSM call times out, gracefully use local matches
    }

    // Combine local matches and OSM results, eliminating duplicates
    const seenIds = new Set<string>();
    const combined: CleanPlace[] = [];

    for (const item of [...localMatches, ...osmResults]) {
      const key = `${Math.round(item.lat * 1000)},${Math.round(item.lng * 1000)}`;
      if (!seenIds.has(key)) {
        seenIds.add(key);
        combined.push(item);
      }
    }

    // Cache the resolved result
    placesCache.set(query, { places: combined.slice(0, 8), timestamp: Date.now() });

    return NextResponse.json({
      success: true,
      places: combined.slice(0, 8),
    });
  } catch (error) {
    console.error("GET /api/rides/places error:", error);
    return NextResponse.json({ success: false, error: "Failed to search places" }, { status: 500 });
  }
}
