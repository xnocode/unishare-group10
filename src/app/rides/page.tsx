"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { TrainFront, Wallet } from "lucide-react";
import AppNavbar from "../components/AppNavbar";
import {
  getUserScopedKey,
  saveClientUser,
  useCurrentUser,
  useRequireAuth,
} from "../lib/user-client";
import CampusRouteMap, { MapPeerItem, resolvePeerPoint } from "./CampusRouteMap";
import {
  computeFitViewport,
  DHAKA_CAMPUS_LANDMARKS as DHAKA_CANVAS_LANDMARKS,
  estimateSharedCommute,
  findNearestLandmark,
  LatLngPoint,
  QUICK_CAMPUS_DESTINATIONS,
  resolveLandmarkByName,
  type RideTransportMode,
} from "./rides-geo";
import "./rides.css";

interface GoogleLatLng {
  lat: () => number;
  lng: () => number;
}

interface GoogleMapMouseEvent {
  latLng: GoogleLatLng;
}

interface GooglePlaceResult {
  name?: string;
  formatted_address?: string;
  geometry?: { location?: GoogleLatLng };
}

interface GoogleDirectionsResult {
  routes?: Array<{
    summary?: string;
    legs?: Array<{
      distance?: { text?: string };
      duration?: { text?: string };
    }>;
  }>;
}

interface GoogleMapsInstance {
  panTo: (coords: { lat: number; lng: number }) => void;
  setCenter: (coords: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number | undefined;
  fitBounds: (bounds: unknown, padding?: number | Record<string, number>) => void;
  addListener: (event: string, cb: (e: GoogleMapMouseEvent) => void) => void;
}

interface GoogleMarkerInstance {
  setPosition: (coords: { lat: number; lng: number }) => void;
  setMap: (map: GoogleMapsInstance | null) => void;
  addListener: (event: string, cb: (e: GoogleMapMouseEvent) => void) => void;
}

interface GoogleInfoWindowInstance {
  open: (opts: { map: GoogleMapsInstance; anchor?: GoogleMarkerInstance }) => void;
  close: () => void;
  setContent: (content: string) => void;
}

interface GoogleDirectionsRendererInstance {
  setDirections: (res: GoogleDirectionsResult) => void;
}

interface GoogleGeocoderInstance {
  geocode: (
    req: { location: { lat: number; lng: number } },
    cb: (results: Array<{ formatted_address: string }> | null, status: string) => void
  ) => void;
}

interface GoogleAutocompleteInstance {
  addListener: (event: string, cb: () => void) => void;
  getPlace: () => GooglePlaceResult;
}

export interface MatchedPartner {
  id: string;
  userId: string;
  fullName: string;
  avatarInitials: string;
  university: string;
  department: string;
  verificationBadge: string;
  verified: boolean;
  isAvailable: boolean;
  isExplorer?: boolean;
  isRecommendedPartner?: boolean;
  recommendationBadge?: string | null;
  corridorMatch?: boolean;
  origin: string;
  approxPickupDistance: string;
  pickupDistanceKm: number | null;
  destination: string;
  destinationCompatibility: string;
  compatibilityScore: number;
  destinationDistanceKm?: number | null;
  originCoords: { lat: number; lng: number } | null;
  destCoords: { lat: number; lng: number } | null;
  departureTime: string;
  genderPreferenceRule: string;
  notes: string | null;
  createdAt: string;
}

export interface PlaceSuggestion {
  id: string;
  label: string;
  name: string;
  lat: number;
  lng: number;
  type?: string;
  isQuickHub?: boolean;
}

interface GoogleMapsNamespace {
  maps: {
    Map: new (el: HTMLElement, opts: Record<string, unknown>) => GoogleMapsInstance;
    Marker: new (opts: Record<string, unknown>) => GoogleMarkerInstance;
    InfoWindow?: new (opts?: Record<string, unknown>) => GoogleInfoWindowInstance;
    Geocoder: new () => GoogleGeocoderInstance;
    Point: new (x: number, y: number) => unknown;
    LatLngBounds: new () => { extend: (pt: { lat: number; lng: number }) => void };
    SymbolPath: { CIRCLE: unknown };
    DirectionsRenderer: new (opts: Record<string, unknown>) => GoogleDirectionsRendererInstance;
    DirectionsService: new () => {
      route: (
        req: Record<string, unknown>,
        cb: (result: GoogleDirectionsResult | null, status: string) => void
      ) => void;
    };
    TravelMode: { DRIVING: string };
    places?: {
      Autocomplete: new (
        input: HTMLInputElement,
        opts: Record<string, unknown>
      ) => GoogleAutocompleteInstance;
    };
  };
}

// Declare global Google Maps object for TypeScript
declare global {
  interface Window {
    google?: GoogleMapsNamespace;
    gm_authFailure?: () => void;
  }
}

// Clean light Google Maps theme matching UniShare palette
const GOOGLE_MAPS_LIGHT_STYLES = [
  { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
  { featureType: "all", elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 2 }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#cbd5e1" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f8faf9" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ visibility: "simplified" }, { color: "#eef5f3" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#dcefd9" }] },
  { featureType: "poi.school", elementType: "geometry", stylers: [{ color: "#e3f0ec" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e2e8f0" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#cbd5e1" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#eef2f6" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c5e3ed" }] },
];

interface RideMatchRequestItem {
  id: string;
  status: string;
  receiverId?: string;
  senderId?: string;
  message?: string | null;
  conversationId?: string | null;
  senderAvatarInitials?: string;
  senderName?: string;
  senderDepartment?: string;
  receiverAvatarInitials?: string;
  receiverName?: string;
  verificationBadge?: string;
}

interface RideActiveConversationSummary {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerAvatarInitials: string;
  partnerBadge: string;
  meetingLocation?: string | null;
  meetingConfirmed?: boolean;
  lastMessage?: { text: string; createdAt: string } | null;
}

interface RideConversationMessage {
  id: string;
  text: string;
  messageType?: string;
  locationName?: string | null;
  senderId?: string;
  senderName?: string;
  isSelf?: boolean;
  createdAt: string;
}

interface RideConversationDetail {
  id?: string;
  partnerName?: string;
  partnerAvatarInitials?: string;
  partnerBadge?: string;
  partnerDepartment?: string;
  meetingLocation?: string | null;
  meetingConfirmed?: boolean;
  messages?: RideConversationMessage[];
}

export default function RideSharingPage() {
  // -----------------------------------------------------------
  // 1. User & State
  // -----------------------------------------------------------
  const { resolvedUser: currentUser, isDemoUser } = useCurrentUser();
  const isAuthenticated = useRequireAuth("/rides");

  // Journey Coordinates & Text
  const [pickup, setPickup] = useState("Dhanmondi 27, Dhaka");
  const [destination, setDestination] = useState("TSC, University of Dhaka");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number }>({
    lat: 23.7550,
    lng: 90.3720,
  });
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number }>({
    lat: 23.7317,
    lng: 90.3957,
  });

  // Gender Preference (defaults to saved Account Settings preference until changed in-session)
  const [genderOverride, setGenderOverride] = useState<"no_preference" | "women_only" | "men_only" | null>(null);
  const setGenderPreference = setGenderOverride;
  const genderPreference =
    genderOverride ?? currentUser?.preferences?.defaultRidePreference ?? "no_preference";

  // Map Picking Mode: "none" | "pickup" | "destination"
  const [mapPickMode, setMapPickMode] = useState<"none" | "pickup" | "destination">("none");
  const mapPickModeRef = useRef<"none" | "pickup" | "destination">("none");
  useEffect(() => {
    mapPickModeRef.current = mapPickMode;
  }, [mapPickMode]);

  // Live GPS Tracking
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  // Autocomplete UI & Dynamic Place Suggestions
  const [showPickupAutocomplete, setShowPickupAutocomplete] = useState(false);
  const [showDestAutocomplete, setShowDestAutocomplete] = useState(false);
  const [pickupPlaces, setPickupPlaces] = useState<PlaceSuggestion[]>([]);
  const [destPlaces, setDestPlaces] = useState<PlaceSuggestion[]>([]);
  const [isLoadingPickupPlaces, setIsLoadingPickupPlaces] = useState(false);
  const [isLoadingDestPlaces, setIsLoadingDestPlaces] = useState(false);
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  // Search Submission & Live Matching State
  const [isSearching, setIsSearching] = useState(false);
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<MatchedPartner[]>([]);
  const [activeCampusRiders, setActiveCampusRiders] = useState<MatchedPartner[]>([]);
  const [isLoadingActiveRiders, setIsLoadingActiveRiders] = useState(true);
  const [myActiveJourney, setMyActiveJourney] = useState<{
    id: string;
    origin: string;
    destination: string;
    createdAt?: string;
  } | null>(null);
  const [dbUserVerified, setDbUserVerified] = useState<boolean | null>(null);
  const [isUpdatingBroadcast, setIsUpdatingBroadcast] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
  const [connectedPartnerIds, setConnectedPartnerIds] = useState<string[]>([]);
  const [isRegisteringRoute, setIsRegisteringRoute] = useState(false);
  const [routeRegisteredSuccess, setRouteRegisteredSuccess] = useState(false);
  const [isSendingGroupInvite, setIsSendingGroupInvite] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // References for Real-Time SSE Stream & Custom Map Markers
  const eventSourceRef = useRef<EventSource | null>(null);
  const partnerMarkersRef = useRef<GoogleMarkerInstance[]>([]);
  const infoWindowRef = useRef<GoogleInfoWindowInstance | null>(null);

  // Connection Requests & Private Coordination Chat State
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [requestsTab, setRequestsTab] = useState<"incoming" | "outgoing" | "chats">("incoming");
  const [incomingRequests, setIncomingRequests] = useState<RideMatchRequestItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<RideMatchRequestItem[]>([]);
  const [activeConversations, setActiveConversations] = useState<RideActiveConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<RideConversationDetail | null>(null);
  const [chatMessages, setChatMessages] = useState<RideConversationMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [showSplitFareBar, setShowSplitFareBar] = useState(false);
  const [splitFareAmount, setSplitFareAmount] = useState<string>("70");
  const [isPayingSplitFare, setIsPayingSplitFare] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Cost-saving optimizer controls (transport mode + split group count)
  const [transportMode, setTransportMode] = useState<RideTransportMode>("cng");
  const [riderGroupSize, setRiderGroupSize] = useState<2 | 3 | 4>(2);

  // Consent-Based Live GPS Tracking State
  const [rawTrackingSession, setTrackingSession] = useState<{
    id: string;
    conversationId: string;
    journeyStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
    myConsent: boolean;
    partnerConsent: boolean;
    bothConsented: boolean;
    mySharing: boolean;
    partnerSharing: boolean;
    destinationLat?: number | null;
    destinationLng?: number | null;
    destinationName?: string | null;
    proximityThresholdMeters?: number;
    myArrived?: boolean;
    myArrivedAt?: string | null;
    partnerArrived?: boolean;
    partnerArrivedAt?: string | null;
    bothArrived?: boolean;
    partner: { id: string; fullName: string; badge: string };
    partnerLocation: {
      lat: number;
      lng: number;
      accuracy?: number;
      heading?: number;
      speed?: number;
      updatedAt: string;
      freshnessSeconds: number | null;
      isStale: boolean;
    } | null;
    connectionStatus: "NOT_STARTED" | "AWAITING_CONSENT" | "LIVE" | "STALE" | "PAUSED" | "COMPLETED";
    browserLimitationNotice: string;
  } | null>(null);

  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false);
  const [isUpdatingTrackingAction, setIsUpdatingTrackingAction] = useState(false);
  const [rawPartnerDistanceMeters, setPartnerDistanceMeters] = useState<number | null>(null);
  const trackingSession = activeConversationId ? rawTrackingSession : null;
  const partnerDistanceMeters = activeConversationId ? rawPartnerDistanceMeters : null;
  const [myLiveCoords, setMyLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
  const trackingSessionRef = useRef(trackingSession);
  const myLiveCoordsRef = useRef(myLiveCoords);
  const pickupCoordsRef = useRef(pickupCoords);
  useEffect(() => {
    trackingSessionRef.current = trackingSession;
  }, [trackingSession]);
  useEffect(() => {
    myLiveCoordsRef.current = myLiveCoords;
  }, [myLiveCoords]);
  useEffect(() => {
    pickupCoordsRef.current = pickupCoords;
  }, [pickupCoords]);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [gpsErrorState, setGpsErrorState] = useState<string | null>(null);
  const [isConfirmingArrival, setIsConfirmingArrival] = useState(false);
  const [proximityRadius, setProximityRadius] = useState<number>(100);

  // Review & Safety Reporting State ("How was your ride?")
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewReported, setReviewReported] = useState(false);
  const [reviewCategory, setReviewCategory] = useState("INAPPROPRIATE_BEHAVIOR");
  const [reviewDetails, setReviewDetails] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // References for Live Tracking Watcher & Markers
  const trackingWatchIdRef = useRef<number | null>(null);
  const partnerLiveMarkerRef = useRef<GoogleMarkerInstance | null>(null);
  const myLiveTrackingMarkerRef = useRef<GoogleMarkerInstance | null>(null);
  const trackingEventSourceRef = useRef<EventSource | null>(null);

  // Mobile View Toggle ("sidebar" | "map")
  const [mobileTab, setMobileTab] = useState<"sidebar" | "map">("sidebar");

  // Route Info State (Distance & Estimated Duration)
  const [routeInfo, setRouteInfo] = useState<{
    distanceText: string;
    durationText: string;
    summary: string;
  }>({
    distanceText: "6.4 km",
    durationText: "~18 mins",
    summary: "via Mirpur Rd & Shahbagh",
  });

  // Google Maps SDK Live Instance References
  const googleMapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GoogleMapsInstance | null>(null);
  const pickupMarkerRef = useRef<GoogleMarkerInstance | null>(null);
  const destMarkerRef = useRef<GoogleMarkerInstance | null>(null);
  const gpsMarkerRef = useRef<GoogleMarkerInstance | null>(null);
  const directionsRendererRef = useRef<GoogleDirectionsRendererInstance | null>(null);
  const geocoderRef = useRef<GoogleGeocoderInstance | null>(null);
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false);
  const [mapCenter, setMapCenter] = useState<LatLngPoint>({ lat: 23.744, lng: 90.386 });
  const [mapZoom, setMapZoom] = useState<number>(13);
  const [mapViewport, setMapViewport] = useState<{ width: number; height: number }>({ width: 840, height: 640 });
  const [inspectedPartnerId, setInspectedPartnerId] = useState<string | null>(null);

  const effectiveRiderCount =
    selectedPartnerIds.length >= 1
      ? Math.min(4, 1 + selectedPartnerIds.length)
      : riderGroupSize;

  const fareEstimate = useMemo(
    () => estimateSharedCommute(pickupCoords, destCoords, effectiveRiderCount, transportMode),
    [pickupCoords, destCoords, effectiveRiderCount, transportMode]
  );

  const hydratedConnectedPartnerIds = useMemo(() => {
    const ids = new Set<string>(connectedPartnerIds);
    const activeReceiverUserIds = new Set(
      outgoingRequests
        .filter((r) => (r.status === "PENDING" || r.status === "ACCEPTED") && r.receiverId)
        .map((r) => r.receiverId as string)
    );
    for (const peer of [...activeCampusRiders, ...searchResults]) {
      if (activeReceiverUserIds.has(peer.userId)) {
        ids.add(peer.id);
      }
    }
    return Array.from(ids);
  }, [connectedPartnerIds, outgoingRequests, activeCampusRiders, searchResults]);

  const mapPeers = useMemo(() => {
    if (hasSubmittedSearch && searchResults.length > 0) {
      const matchedIds = new Set(searchResults.map((p) => p.id));
      const matchedAnnotated = searchResults.map((p) => ({ ...p, corridorMatch: true }));
      const nearbyOthers = activeCampusRiders
        .filter((p) => !matchedIds.has(p.id))
        .map((p) => ({ ...p, corridorMatch: false }));
      return [...matchedAnnotated, ...nearbyOthers];
    }
    return activeCampusRiders;
  }, [hasSubmittedSearch, searchResults, activeCampusRiders]);

  const focusRouteOnMap = useCallback(
    (a: LatLngPoint, b: LatLngPoint) => {
      if (mapInstanceRef.current && window.google?.maps?.LatLngBounds) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(a);
        bounds.extend(b);
        mapInstanceRef.current.fitBounds(bounds, 80);
      } else {
        const fit = computeFitViewport([a, b], mapViewport.width, mapViewport.height);
        setMapCenter(fit.center);
        setMapZoom(fit.zoom);
      }
    },
    [mapViewport.width, mapViewport.height]
  );

  // -----------------------------------------------------------
  // Dynamic Location Autocomplete & Search (OSM Nominatim API)
  // -----------------------------------------------------------
  useEffect(() => {
    const q = pickup.trim();
    const timer = setTimeout(async () => {
      setIsLoadingPickupPlaces(true);
      try {
        const res = await fetch(`/api/rides/places?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.places)) {
          setPickupPlaces(data.places);
        }
      } catch {
        // Fallback gracefully
      } finally {
        setIsLoadingPickupPlaces(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [pickup]);

  useEffect(() => {
    const q = destination.trim();
    const timer = setTimeout(async () => {
      setIsLoadingDestPlaces(true);
      try {
        const res = await fetch(`/api/rides/places?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.places)) {
          setDestPlaces(data.places);
        }
      } catch {
        // Fallback gracefully
      } finally {
        setIsLoadingDestPlaces(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [destination]);

  // Toast feedback helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  }, []);

  // Reverse Geocode Helper
  const reverseGeocode = useCallback(
    (coords: { lat: number; lng: number }, isPickup: boolean) => {
      if (!geocoderRef.current) {
        // Canvas fallback: use Nominatim OSM reverse geocoding (free, no key needed)
        const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}&zoom=16&addressdetails=1`;
        fetch(nominatimUrl, { headers: { "Accept-Language": "en" } })
          .then((res) => res.json())
          .then((data) => {
            let resolved = "";
            if (data && data.address) {
              const a = data.address;
              // Build a readable address: road/neighbourhood + city
              const parts: string[] = [];
              const street = a.road || a.pedestrian || a.footway || "";
              const sub = a.suburb || a.neighbourhood || a.city_district || a.quarter || "";
              const city = a.city || a.town || a.village || "";
              if (street) parts.push(street);
              else if (sub) parts.push(sub);
              if (city && city !== street && city !== sub) parts.push(city);
              resolved = parts.join(", ");
            }
            if (!resolved) {
              resolved = data?.display_name?.split(",").slice(0, 2).join(",").trim() || "";
            }
            // If still empty, fall back to nearest landmark
            if (!resolved) {
              const nearest = DHAKA_CANVAS_LANDMARKS.reduce((prev, curr) => {
                const d1 = Math.hypot(prev.lat - coords.lat, prev.lng - coords.lng);
                const d2 = Math.hypot(curr.lat - coords.lat, curr.lng - coords.lng);
                return d1 < d2 ? prev : curr;
              });
              resolved = nearest.name;
            }
            if (isPickup) {
              setPickup(resolved);
              showToast(`📍 Pickup set: ${resolved.split(",")[0]}`);
            } else {
              setDestination(resolved);
              showToast(`🎯 Destination set: ${resolved.split(",")[0]}`);
            }
          })
          .catch(() => {
            // Network error – fall back to nearest campus landmark
            const nearest = DHAKA_CANVAS_LANDMARKS.reduce((prev, curr) => {
              const d1 = Math.hypot(prev.lat - coords.lat, prev.lng - coords.lng);
              const d2 = Math.hypot(curr.lat - coords.lat, curr.lng - coords.lng);
              return d1 < d2 ? prev : curr;
            });
            if (isPickup) {
              setPickup(nearest.name);
              showToast(`📍 Pickup set: ${nearest.name}`);
            } else {
              setDestination(nearest.name);
              showToast(`🎯 Destination set: ${nearest.name}`);
            }
          });
        return;
      }

      geocoderRef.current.geocode({ location: coords }, (results, status) => {
        let resolved = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
        if (status === "OK" && results?.[0]) {
          resolved = results[0].formatted_address.replace(", Bangladesh", "");
        }
        if (isPickup) {
          setPickup(resolved);
          showToast(`📍 Pickup set: ${resolved.split(",")[0]}`);
        } else {
          setDestination(resolved);
          showToast(`🎯 Destination set: ${resolved.split(",")[0]}`);
        }
      });
    },
    [showToast]
  );

  // -----------------------------------------------------------
  // 2. Google Maps JavaScript API Loading
  // -----------------------------------------------------------
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // Check if already loaded
    if (window.google?.maps) {
      const t = setTimeout(() => setIsGoogleMapsReady(true), 0);
      return () => clearTimeout(t);
    }

    if (!apiKey) {
      // No key configured yet -> will use interactive canvas
      return;
    }

    // Dynamically inject Google Maps SDK script
    const scriptId = "google-maps-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setIsGoogleMapsReady(true);
      };
      script.onerror = () => {
        console.warn("Google Maps SDK failed to load. Using fallback map mode.");
      };
      document.head.appendChild(script);
    }
  }, []);

  // -----------------------------------------------------------
  // 3. Initialize Google Maps & Event Listeners
  // -----------------------------------------------------------
  useEffect(() => {
    if (!isGoogleMapsReady || !googleMapDivRef.current || mapInstanceRef.current) return;
    const gmaps = window.google?.maps;
    if (!gmaps) return;

    try {
      const centerCoords = { lat: 23.7430, lng: 90.3840 }; // Center of Dhaka Central
      const map = new gmaps.Map(googleMapDivRef.current, {
        center: centerCoords,
        zoom: 13,
        styles: GOOGLE_MAPS_LIGHT_STYLES,
        disableDefaultUI: true,
        zoomControl: false,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });

      mapInstanceRef.current = map;
      geocoderRef.current = new gmaps.Geocoder();

      // Directions Renderer
      const directionsRenderer = new gmaps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: "#0d6b63", // UniShare Teal
          strokeWeight: 5,
          strokeOpacity: 0.85,
        },
      });
      directionsRendererRef.current = directionsRenderer;

      // Pickup Marker (Green Pin A)
      pickupMarkerRef.current = new gmaps.Marker({
        position: pickupCoords,
        map,
        title: "Pickup Spot",
        label: { text: "A", color: "#ffffff", fontWeight: "bold" },
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
          fillColor: "#1e8e3e",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 1.6,
          anchor: new gmaps.Point(12, 22),
          labelOrigin: new gmaps.Point(12, 9),
        },
        draggable: true,
      });

      // Destination Marker (Red Pin B)
      destMarkerRef.current = new gmaps.Marker({
        position: destCoords,
        map,
        title: "Destination",
        label: { text: "B", color: "#ffffff", fontWeight: "bold" },
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
          fillColor: "#d93025",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 1.6,
          anchor: new gmaps.Point(12, 22),
          labelOrigin: new gmaps.Point(12, 9),
        },
        draggable: true,
      });

      // Allow dragging markers to update location
      pickupMarkerRef.current.addListener("dragend", (e: GoogleMapMouseEvent) => {
        if (!e?.latLng) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setPickupCoords({ lat, lng });
        reverseGeocode({ lat, lng }, true);
      });

      destMarkerRef.current.addListener("dragend", (e: GoogleMapMouseEvent) => {
        if (!e?.latLng) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setDestCoords({ lat, lng });
        reverseGeocode({ lat, lng }, false);
      });

      // Click on Map to Select Pickup or Destination
      map.addListener("click", (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        if (mapPickModeRef.current === "pickup") {
          setPickupCoords({ lat, lng });
          if (pickupMarkerRef.current) pickupMarkerRef.current.setPosition({ lat, lng });
          reverseGeocode({ lat, lng }, true);
          setMapPickMode("none");
        } else if (mapPickModeRef.current === "destination") {
          setDestCoords({ lat, lng });
          if (destMarkerRef.current) destMarkerRef.current.setPosition({ lat, lng });
          reverseGeocode({ lat, lng }, false);
          setMapPickMode("none");
        } else {
          // Default click sets destination
          setDestCoords({ lat, lng });
          if (destMarkerRef.current) destMarkerRef.current.setPosition({ lat, lng });
          reverseGeocode({ lat, lng }, false);
        }
      });

      // Bind Google Places Autocomplete on destination input
      if (window.google?.maps?.places?.Autocomplete && destInputRef.current) {
        const destAuto = new window.google.maps.places.Autocomplete(destInputRef.current, {
          componentRestrictions: { country: "bd" },
          fields: ["formatted_address", "geometry", "name"],
        });

        destAuto.addListener("place_changed", () => {
          const place = destAuto.getPlace();
          if (place.geometry?.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const name = place.name || place.formatted_address || "Selected Destination";
            setDestination(name);
            setDestCoords({ lat, lng });
            if (destMarkerRef.current) destMarkerRef.current.setPosition({ lat, lng });
            map.panTo({ lat, lng });
            showToast(`🎯 Destination set: ${name}`);
          }
        });
      }

      // Bind Google Places Autocomplete on pickup input
      if (window.google?.maps?.places?.Autocomplete && pickupInputRef.current) {
        const pickupAuto = new window.google.maps.places.Autocomplete(pickupInputRef.current, {
          componentRestrictions: { country: "bd" },
          fields: ["formatted_address", "geometry", "name"],
        });

        pickupAuto.addListener("place_changed", () => {
          const place = pickupAuto.getPlace();
          if (place.geometry?.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const name = place.name || place.formatted_address || "Selected Pickup";
            setPickup(name);
            setPickupCoords({ lat, lng });
            if (pickupMarkerRef.current) pickupMarkerRef.current.setPosition({ lat, lng });
            map.panTo({ lat, lng });
            showToast(`📍 Pickup set: ${name}`);
          }
        });
      }
    } catch (err) {
      console.error("Google Maps initialization error:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGoogleMapsReady, showToast, reverseGeocode]);

  // -----------------------------------------------------------
  // 4. Draw Route via Google Routes / DirectionsService
  // -----------------------------------------------------------
  useEffect(() => {
    if (!pickupCoords || !destCoords) return;

    // Update marker positions
    if (pickupMarkerRef.current) pickupMarkerRef.current.setPosition(pickupCoords);
    if (destMarkerRef.current) destMarkerRef.current.setPosition(destCoords);

    // Call Google Routes API
    const directionsRenderer = directionsRendererRef.current;
    const gmaps = window.google?.maps;
    if (isGoogleMapsReady && gmaps?.DirectionsService && directionsRenderer) {
      const directionsService = new gmaps.DirectionsService();
      directionsService.route(
        {
          origin: pickupCoords,
          destination: destCoords,
          travelMode: gmaps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK" && result?.routes?.[0]?.legs?.[0]) {
            directionsRenderer.setDirections(result);
            const leg = result.routes[0].legs[0];
            setRouteInfo({
              distanceText: leg.distance?.text || "6.4 km",
              durationText: leg.duration?.text ? `~${leg.duration.text}` : "~18 mins",
              summary: result.routes[0].summary ? `via ${result.routes[0].summary}` : "via Mirpur Rd",
            });
          }
        }
      );
    } else {
      // Calculate realistic Dhaka road corridor & duration using true Haversine geometry
      const est = estimateSharedCommute(pickupCoords, destCoords);
      setRouteInfo({
        distanceText: `${est.distanceKm.toFixed(1)} km`,
        durationText: `~${est.durationMins} mins`,
        summary: est.corridorLabel,
      });
    }
  }, [pickupCoords, destCoords, isGoogleMapsReady]);

  // -----------------------------------------------------------
  // 5. GPS Current Location Detector
  // -----------------------------------------------------------
  const handleUseCurrentLocation = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      showToast("⚠️ Geolocation is not supported in this browser.");
      return;
    }

    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGps(false);
        const { latitude, longitude, accuracy } = pos.coords;
        const currentCoord = { lat: latitude, lng: longitude };

        setGpsCoords({ lat: latitude, lng: longitude, accuracy });
        setPickupCoords(currentCoord);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(currentCoord);
          mapInstanceRef.current.setZoom(15);

          // Add or update GPS Blue Marker
          const gmaps = window.google?.maps;
          if (!gpsMarkerRef.current && gmaps) {
            gpsMarkerRef.current = new gmaps.Marker({
              position: currentCoord,
              map: mapInstanceRef.current,
              title: "Your GPS Location",
              icon: {
                path: gmaps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#1a73e8",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2.5,
              },
            });
          } else if (gpsMarkerRef.current) {
            gpsMarkerRef.current.setPosition(currentCoord);
          }
        } else {
          setMapCenter(currentCoord);
          setMapZoom(14);
        }

        reverseGeocode(currentCoord, true);
        showToast("📍 Real-time GPS location detected!");
      },
      (err) => {
        setIsLocatingGps(false);
        console.warn("GPS error:", err);
        showToast("📍 Using saved campus hub (GPS permission unavailable).");
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  // Zoom controls for both Google Maps & Interactive Campus Map
  const handleZoom = (delta: number) => {
    if (mapInstanceRef.current) {
      const currentZoom = mapInstanceRef.current.getZoom() || 13;
      mapInstanceRef.current.setZoom(currentZoom + delta);
    } else {
      setMapZoom((prev) => Math.max(11, Math.min(17, prev + (delta > 0 ? 1 : -1))));
    }
  };

  // Consistent auth header helper (keeps multi-session & demo requests cleanly authenticated alongside cookies)
  const currentUserEmail = currentUser.email.trim();
  const getRideAuthHeaders = useCallback((): Record<string, string> => {
    return currentUserEmail ? { "x-user-email": currentUserEmail } : {};
  }, [currentUserEmail]);

  // Report active search presence to server so other students see active explorers on campus map
  const reportRidesPresence = useCallback(
    (coords: { lat: number; lng: number }, pickupName?: string, destName?: string) => {
      fetch("/api/rides/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRideAuthHeaders() },
        body: JSON.stringify({
          lat: coords.lat,
          lng: coords.lng,
          pickupLocation: pickupName || pickup,
          destinationLocation: destName || destination,
          destinationLat: destCoords.lat,
          destinationLng: destCoords.lng,
          genderPreference,
        }),
      }).catch(() => {});
    },
    [pickup, destination, destCoords, genderPreference, getRideAuthHeaders]
  );

  // Load active campus riders & self live status right away (polls every 5s so friends appear live)
  const fetchActiveCampusRiders = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams({
        browse: "active",
        destination: destination.trim(),
        origin: pickup.trim(),
        genderPreference,
        destLat: String(destCoords.lat),
        destLng: String(destCoords.lng),
        originLat: String(pickupCoords.lat),
        originLng: String(pickupCoords.lng),
      });

      const res = await fetch(`/api/rides?${queryParams.toString()}`, {
        headers: getRideAuthHeaders(),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && Array.isArray(data.partners)) {
        setActiveCampusRiders(data.partners);
        if (typeof data.currentUserVerified === "boolean") {
          setDbUserVerified(data.currentUserVerified);
        }
        setMyActiveJourney(data.myActiveJourney || null);
      }
    } catch {
      // Quietly handle transient network interruption on background map discovery
    } finally {
      setIsLoadingActiveRiders(false);
    }
  }, [destination, pickup, genderPreference, destCoords, pickupCoords, getRideAuthHeaders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchActiveCampusRiders();
    }, 150);

    // Poll active commuters every 5 seconds so new logins from different locations appear live
    const pollInterval = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) {
        fetchActiveCampusRiders();
      }
    }, 5000);

    const handleFocusRefresh = () => {
      fetchActiveCampusRiders();
    };
    window.addEventListener("focus", handleFocusRefresh);

    return () => {
      clearTimeout(timer);
      clearInterval(pollInterval);
      window.removeEventListener("focus", handleFocusRefresh);
    };
  }, [fetchActiveCampusRiders]);

  // Resolve typed pickup/destination text to exact coordinates before searching or going live
  const resolveTypedPoint = useCallback(
    async (
      queryText: string,
      cachedList: PlaceSuggestion[],
      currentPoint: { lat: number; lng: number }
    ): Promise<{ lat: number; lng: number }> => {
      const q = queryText.trim().toLowerCase();
      if (!q) return currentPoint;

      const exactCached = cachedList.find(
        (p) => p.name.toLowerCase() === q || p.label.toLowerCase() === q
      );
      if (exactCached) return { lat: exactCached.lat, lng: exactCached.lng };

      const landmarkMatch = resolveLandmarkByName(queryText);
      if (landmarkMatch) return { lat: landmarkMatch.lat, lng: landmarkMatch.lng };

      try {
        const res = await fetch(`/api/rides/places?q=${encodeURIComponent(queryText.trim())}`);
        const data = await res.json().catch(() => null);
        if (data?.success && Array.isArray(data.places) && data.places.length > 0) {
          return { lat: data.places[0].lat, lng: data.places[0].lng };
        }
      } catch {
        // Fallback cleanly to currentPoint
      }
      return currentPoint;
    },
    []
  );

  // Publish or update the user's active live route so peers see them on the map
  const publishLiveRoute = useCallback(
    async (options?: {
      silent?: boolean;
      overrideGender?: "no_preference" | "women_only" | "men_only";
      resolvedOriginCoords?: { lat: number; lng: number };
      resolvedDestCoords?: { lat: number; lng: number };
    }) => {
      const originText = pickup.trim();
      const destText = destination.trim();
      const activePref = options?.overrideGender || genderPreference;

      if (originText.length < 2 || destText.length < 2) {
        if (!options?.silent) showToast("⚠️ Please select both a pickup location and a destination.");
        return false;
      }

      if (originText.toLowerCase() === destText.toLowerCase()) {
        if (!options?.silent) showToast("⚠️ Pickup and destination cannot be the same location.");
        return false;
      }

      if (!options?.silent) setIsRegisteringRoute(true);
      try {
        const effectiveOrigin =
          options?.resolvedOriginCoords ||
          (await resolveTypedPoint(originText, pickupPlaces, pickupCoords));
        const effectiveDest =
          options?.resolvedDestCoords ||
          (await resolveTypedPoint(destText, destPlaces, destCoords));

        if (!options?.resolvedOriginCoords) setPickupCoords(effectiveOrigin);
        if (!options?.resolvedDestCoords) setDestCoords(effectiveDest);

        const res = await fetch("/api/rides", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getRideAuthHeaders(),
          },
          body: JSON.stringify({
            origin: originText,
            destination: destText,
            originLat: effectiveOrigin.lat,
            originLng: effectiveOrigin.lng,
            destinationLat: effectiveDest.lat,
            destinationLng: effectiveDest.lng,
            genderPreference: activePref,
            notes: `Heading from ${originText.split(",")[0]} towards ${destText.split(",")[0]}. Split fare ~৳${fareEstimate.sharedFareBdt}/person.`,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          if (res.status === 403) {
            setDbUserVerified(false);
          }
          if (!options?.silent) {
            showToast(`⚠️ ${data?.error || "Could not go live on map"}`);
          }
          return false;
        }

        if (data.journey) {
          setMyActiveJourney({
            id: data.journey.id,
            origin: data.journey.origin,
            destination: data.journey.destination,
            createdAt: data.journey.createdAt,
          });
        }
        setDbUserVerified(true);
        setRouteRegisteredSuccess(true);
        fetchActiveCampusRiders();
        if (!options?.silent) {
          showToast("🟢 You are now LIVE on the campus map! Peers can see your route.");
        }
        return true;
      } catch (err) {
        console.error("Register route error:", err);
        if (!options?.silent) {
          showToast("⚠️ Network error while publishing live route.");
        }
        return false;
      } finally {
        if (!options?.silent) setIsRegisteringRoute(false);
      }
    },
    [pickup, destination, genderPreference, pickupCoords, destCoords, pickupPlaces, destPlaces, fareEstimate.sharedFareBdt, resolveTypedPoint, getRideAuthHeaders, fetchActiveCampusRiders, showToast]
  );

  const handlePauseLiveRoute = async () => {
    if (!myActiveJourney) return;
    setIsUpdatingBroadcast(true);
    try {
      const res = await fetch(`/api/rides/${myActiveJourney.id}`, {
        method: "DELETE",
        headers: getRideAuthHeaders(),
      });
      if (res.ok) {
        setMyActiveJourney(null);
        setRouteRegisteredSuccess(false);
        fetchActiveCampusRiders();
        showToast("⏸️ Live route sharing paused.");
      } else {
        const data = await res.json().catch(() => null);
        showToast(`⚠️ ${data?.error || "Could not pause live route."}`);
      }
    } catch {
      showToast("⚠️ Network error while pausing live route.");
    } finally {
      setIsUpdatingBroadcast(false);
    }
  };

  // -----------------------------------------------------------
  // 6. Real Live Travel Partners Search & Matching Handlers
  // -----------------------------------------------------------
  const handleFindPartners = async (overrideGender?: "no_preference" | "women_only" | "men_only") => {
    const activePref = overrideGender || genderPreference;
    if (overrideGender) {
      setGenderPreference(overrideGender);
    }

    if (!pickup.trim()) {
      showToast("⚠️ Please select a pickup location.");
      pickupInputRef.current?.focus();
      return;
    }
    if (!destination.trim()) {
      showToast("⚠️ Please select your destination.");
      destInputRef.current?.focus();
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setHasSubmittedSearch(true);
    setRouteRegisteredSuccess(false);

    const [resolvedOrigin, resolvedDest] = await Promise.all([
      resolveTypedPoint(pickup, pickupPlaces, pickupCoords),
      resolveTypedPoint(destination, destPlaces, destCoords),
    ]);
    setPickupCoords(resolvedOrigin);
    setDestCoords(resolvedDest);
    focusRouteOnMap(resolvedOrigin, resolvedDest);

    // Automatically broadcast current verified user's live route so friends from other locations see them too
    void publishLiveRoute({
      silent: true,
      overrideGender: activePref,
      resolvedOriginCoords: resolvedOrigin,
      resolvedDestCoords: resolvedDest,
    });

    try {
      const queryParams = new URLSearchParams({
        destination: destination.trim(),
        origin: pickup.trim(),
        genderPreference: activePref,
        destLat: String(resolvedDest.lat),
        destLng: String(resolvedDest.lng),
        originLat: String(resolvedOrigin.lat),
        originLng: String(resolvedOrigin.lng),
      });

      const res = await fetch(`/api/rides?${queryParams.toString()}`, {
        headers: getRideAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSearchError(data.error || "Failed to search for travel companions. Please try again.");
        setSearchResults([]);
        showToast(`⚠️ ${data.error || "Search error"}`);
      } else {
        const partners = Array.isArray(data.partners) ? data.partners : [];
        setSearchResults(partners);
        if (typeof data.currentUserVerified === "boolean") {
          setDbUserVerified(data.currentUserVerified);
        }
        if (data.myActiveJourney) {
          setMyActiveJourney(data.myActiveJourney);
        }
        if (partners.length > 0) {
          showToast(`🎯 Found ${partners.length} verified travel companion(s)!`);
        } else {
          showToast("ℹ️ No matching partners yet — your route is live for peers.");
        }
      }
    } catch (err) {
      console.error("Live companion search error:", err);
      setSearchError("Network connection error. Please ensure the server is running and try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Register Current Student Journey as Active Route
  const handleRegisterRoute = async () => {
    await publishLiveRoute({ silent: false });
  };

  // Multi-Partner Selection Handlers
  const togglePartnerSelection = (partnerId: string) => {
    setSelectedPartnerIds((prev) =>
      prev.includes(partnerId)
        ? prev.filter((id) => id !== partnerId)
        : [...prev, partnerId]
    );
  };

  // Send Multi-Partner Travel Request
  const handleSendGroupInvitations = async () => {
    if (selectedPartnerIds.length === 0) return;
    setIsSendingGroupInvite(true);
    try {
      const selectedPartners = searchResults.filter((p) => selectedPartnerIds.includes(p.id));
      const targetUserIds = selectedPartners.map((p) => p.userId);

      const res = await fetch("/api/rides/match", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRideAuthHeaders() },
        body: JSON.stringify({
          partnerIds: targetUserIds,
          message: `Heading to ${destination.split(",")[0]}, let's travel together!`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(`⚠️ ${data.error || "Failed to send travel invitations"}`);
      } else {
        setConnectedPartnerIds((prev) => Array.from(new Set([...prev, ...selectedPartnerIds])));
        showToast(`🤝 Travel requests sent to ${data.count} verified peer${data.count > 1 ? "s" : ""}!`);
      }
    } catch (err) {
      console.error("Group invite error:", err);
      showToast("⚠️ Network error sending invitations.");
    } finally {
      setIsSendingGroupInvite(false);
    }
  };

  // Connect with a single Travel Partner via persistent /api/rides/match invitation
  const handleConnectPartner = async (partner: Pick<MatchedPartner, "id" | "userId" | "fullName" | "destination">) => {
    if (hydratedConnectedPartnerIds.includes(partner.id)) {
      showToast(`✓ Invitation already sent to ${partner.fullName}. Check Requests to message.`);
      return;
    }

    try {
      const res = await fetch("/api/rides/match", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRideAuthHeaders() },
        body: JSON.stringify({
          partnerIds: [partner.userId],
          message: `Heading towards ${partner.destination.split(",")[0]} — want to share a ride and split the fare?`,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        showToast(`⚠️ ${data?.error || "Could not send travel invitation"}`);
        return;
      }
      setConnectedPartnerIds((prev) => Array.from(new Set([...prev, partner.id])));
      showToast(`🤝 Travel request sent to ${partner.fullName}!`);
    } catch {
      showToast("⚠️ Network error sending travel request.");
    }
  };

  // Snap current route planner to an active peer's route corridor to split costs
  const handleAdoptPeerRoute = (partner: Pick<MatchedPartner, "id" | "fullName" | "origin" | "destination" | "originCoords" | "destCoords">) => {
    const nextOrigin = resolvePeerPoint(partner.originCoords, partner.origin, pickupCoords, 1);
    const nextDest = resolvePeerPoint(partner.destCoords, partner.destination, destCoords, 2);
    setPickup(partner.origin);
    setPickupCoords(nextOrigin);
    setDestination(partner.destination);
    setDestCoords(nextDest);
    setSelectedPartnerIds((prev) => Array.from(new Set([...prev, partner.id])));
    focusRouteOnMap(nextOrigin, nextDest);
    showToast(`💰 Matched ${partner.fullName.split(" ")[0]}'s route to split fare!`);
  };

  // -----------------------------------------------------------
  // Real-Time SSE Live Matching Connection
  // -----------------------------------------------------------
  useEffect(() => {
    if (!hasSubmittedSearch || !destination.trim() || destination.trim().length < 2) {
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const streamParams = new URLSearchParams({
      destination: destination.trim(),
      origin: pickup.trim(),
      genderPreference,
      destLat: String(destCoords.lat),
      destLng: String(destCoords.lng),
      originLat: String(pickupCoords.lat),
      originLng: String(pickupCoords.lng),
    });

    const es = new EventSource(`/api/rides/stream?${streamParams.toString()}`);
    eventSourceRef.current = es;

    es.addEventListener("connected", () => {
      // Live SSE stream established
    });

    es.addEventListener("matches", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data.partners)) {
          setSearchResults(data.partners);
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    });

    es.onerror = () => {
      // Transient SSE error; browser EventSource retries automatically
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [hasSubmittedSearch, destination, pickup, genderPreference, destCoords, pickupCoords]);

  // -----------------------------------------------------------
  // Google Maps: Render Eligible Travel Partners on Map
  // -----------------------------------------------------------
  useEffect(() => {
    if (!isGoogleMapsReady || !mapInstanceRef.current || !window.google?.maps) {
      return;
    }

    // Clean up prior markers
    partnerMarkersRef.current.forEach((m) => m.setMap(null));
    partnerMarkersRef.current = [];

    if (!infoWindowRef.current && window.google.maps.InfoWindow) {
      infoWindowRef.current = new window.google.maps.InfoWindow();
    }

    const gmaps = window.google.maps;

    mapPeers.forEach((partner) => {
      // Find coordinate for partner
      let coord = partner.originCoords;
      if (!coord) {
        const matchedLm = DHAKA_CANVAS_LANDMARKS.find((lm) =>
          partner.origin.toLowerCase().includes(lm.name.toLowerCase().split(",")[0])
        );
        if (matchedLm) {
          coord = { lat: matchedLm.lat, lng: matchedLm.lng };
        } else {
          coord = {
            lat: pickupCoords.lat + 0.005,
            lng: pickupCoords.lng + 0.005,
          };
        }
      }

      const isSelected = selectedPartnerIds.includes(partner.id);

      const marker = new gmaps.Marker({
        position: coord,
        map: mapInstanceRef.current,
        title: `${partner.fullName} (${partner.verificationBadge})`,
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
          fillColor: isSelected ? "#0d6b63" : "#0284c7",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: isSelected ? 1.6 : 1.35,
          anchor: new gmaps.Point(12, 24),
        },
      });

      marker.addListener("click", () => {
        if (infoWindowRef.current && mapInstanceRef.current) {
          const content = `
            <div style="font-family: inherit; padding: 6px 8px; max-width: 240px;">
              <div style="font-weight: 800; color: #161b1a; font-size: 13.5px; margin-bottom: 2px;">${partner.fullName}</div>
              <div style="font-size: 11px; color: #0d6b63; font-weight: 700; margin-bottom: 6px;">${partner.verificationBadge}</div>
              <div style="font-size: 11.5px; color: #334155; line-height: 1.45;">
                <div>📍 Pickup: <b>${partner.approxPickupDistance}</b></div>
                <div>🎯 Destination: <b>${partner.destination.split(",")[0]}</b></div>
                <div style="color: #16a34a; font-weight: 700; font-size: 10.5px; margin-top: 2px;">✓ ${partner.destinationCompatibility}</div>
              </div>
            </div>
          `;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open({ map: mapInstanceRef.current, anchor: marker });
        }
        togglePartnerSelection(partner.id);
      });

      partnerMarkersRef.current.push(marker);
    });
  }, [mapPeers, isGoogleMapsReady, selectedPartnerIds, pickupCoords]);

  // -----------------------------------------------------------
  // Connection Requests & Private Messaging Handlers
  // -----------------------------------------------------------
  const fetchConnectionRequests = useCallback(async () => {
    try {
      const headers = getRideAuthHeaders();
      const [matchRes, convRes] = await Promise.all([
        fetch("/api/rides/match", { headers }),
        fetch("/api/rides/conversations", { headers }),
      ]);
      const data = await matchRes.json().catch(() => null);
      if (data?.success) {
        setIncomingRequests(data.incoming || []);
        setOutgoingRequests(data.outgoing || []);
      }
      const convData = await convRes.json().catch(() => null);
      if (convData?.success && Array.isArray(convData.conversations)) {
        setActiveConversations(convData.conversations);
      }
    } catch (err) {
      console.error("Failed to fetch connection requests:", err);
    }
  }, [getRideAuthHeaders]);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      void fetchConnectionRequests();
    }, 0);
    const interval = setInterval(() => {
      void fetchConnectionRequests();
    }, 8000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, [fetchConnectionRequests]);

  const handleRespondRequest = async (id: string, action: "ACCEPT" | "REJECT") => {
    try {
      const res = await fetch(`/api/rides/match/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getRideAuthHeaders() },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(`⚠️ ${data.error || "Failed to update request"}`);
      } else {
        showToast(action === "ACCEPT" ? "🎉 Connection accepted! Opening conversation..." : "Connection declined.");
        fetchConnectionRequests();
        if (action === "ACCEPT" && data.conversationId) {
          setShowRequestsModal(false);
          openConversation(data.conversationId);
        }
      }
    } catch (err) {
      console.error("Respond request error:", err);
      showToast("⚠️ Network error updating request.");
    }
  };

  // Helper to compute distance between coordinates in km
  const computeDistanceBetweenKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Clean up browser geolocation watcher and live map markers
  const stopBrowserGeolocation = useCallback(() => {
    if (trackingWatchIdRef.current !== null && typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(trackingWatchIdRef.current);
      trackingWatchIdRef.current = null;
    }
    if (trackingEventSourceRef.current) {
      trackingEventSourceRef.current.close();
      trackingEventSourceRef.current = null;
    }
    if (partnerLiveMarkerRef.current) {
      partnerLiveMarkerRef.current.setMap(null);
      partnerLiveMarkerRef.current = null;
    }
    if (myLiveTrackingMarkerRef.current) {
      myLiveTrackingMarkerRef.current.setMap(null);
      myLiveTrackingMarkerRef.current = null;
    }
  }, []);

  // Update live markers on Google Maps
  const updateLiveTrackingMarkersOnMap = useCallback(
    (
      partnerLoc: { lat: number; lng: number } | null,
      partnerName: string,
      myLoc: { lat: number; lng: number } | null
    ) => {
      const map = mapInstanceRef.current;
      const gmaps = window.google?.maps;
      if (!map || !gmaps) return;

      if (partnerLoc) {
        const initials = partnerName
          ? partnerName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
          : "LP";
        if (!partnerLiveMarkerRef.current) {
          partnerLiveMarkerRef.current = new gmaps.Marker({
            position: partnerLoc,
            map,
            title: `${partnerName} (Live GPS)`,
            label: { text: initials, color: "#ffffff", fontWeight: "bold" },
            icon: {
              path: gmaps.SymbolPath.CIRCLE,
              scale: 16,
              fillColor: "#0d6b63",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
            },
            zIndex: 999,
          });
        } else {
          partnerLiveMarkerRef.current.setPosition(partnerLoc);
        }
      } else if (partnerLiveMarkerRef.current) {
        partnerLiveMarkerRef.current.setMap(null);
        partnerLiveMarkerRef.current = null;
      }

      if (myLoc) {
        if (!myLiveTrackingMarkerRef.current) {
          myLiveTrackingMarkerRef.current = new gmaps.Marker({
            position: myLoc,
            map,
            title: "You (Live GPS Sharing)",
            label: { text: "ME", color: "#ffffff", fontWeight: "bold" },
            icon: {
              path: gmaps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: "#2563eb",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2.5,
            },
            zIndex: 998,
          });
        } else {
          myLiveTrackingMarkerRef.current.setPosition(myLoc);
        }
      }
    },
    []
  );

  // Notification recording helper (reuses UniShare notification storage)
  const recordNotification = useCallback(
    (title: string, body: string, icon: "car" | "box" | "wallet" = "car") => {
      try {
        const storageKey = getUserScopedKey(
          "unishare_notifications",
          currentUser.email,
          isDemoUser
        );
        const existing = localStorage.getItem(storageKey);
        let list: Array<Record<string, unknown>> = [];
        if (existing) {
          try {
            list = JSON.parse(existing);
          } catch { }
        }
        list.unshift({
          id: Date.now(),
          unread: true,
          icon,
          title,
          body,
          meta: "Ride · Just now",
          actionText: "Open Ride",
          actionHref: "/rides",
        });
        localStorage.setItem(storageKey, JSON.stringify(list.slice(0, 50)));
      } catch {
        // ignore storage errors
      }
    },
    [currentUser.email, isDemoUser]
  );

  // Start browser Geolocation API watchPosition
  const startBrowserGeolocation = useCallback(
    (conversationId: string) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        showToast("⚠️ Geolocation is not supported by your browser.");
        return;
      }
      if (trackingWatchIdRef.current !== null) return;

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsErrorState(null);
          const { latitude, longitude, accuracy, heading, speed } = pos.coords;
          const coords = { lat: latitude, lng: longitude };
          setMyLiveCoords(coords);

          if (mapInstanceRef.current && window.google?.maps) {
            const currentSession = trackingSessionRef.current;
            updateLiveTrackingMarkersOnMap(
              currentSession?.partnerLocation
                ? { lat: currentSession.partnerLocation.lat, lng: currentSession.partnerLocation.lng }
                : null,
              currentSession?.partner?.fullName || "Travel Partner",
              coords
            );
          }

          fetch(`/api/rides/conversations/${conversationId}/tracking/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getRideAuthHeaders() },
            body: JSON.stringify({
              lat: latitude,
              lng: longitude,
              accuracy: accuracy || undefined,
              heading: heading || undefined,
              speed: speed || undefined,
              destinationLat: destCoords.lat,
              destinationLng: destCoords.lng,
              destinationName: destination || "Selected Campus Destination",
              proximityThresholdMeters: proximityRadius,
            }),
          })
            .then((res) => res.json())
            .then((resData) => {
              if (resData.newlyArrived) {
                showToast(`🎯 You have arrived at ${destination || "your destination"}!`);
                recordNotification(
                  "You have arrived! 🎯",
                  `You have safely reached ${destination || "the destination"}. Your travel companion has been notified.`,
                  "car"
                );
              }
            })
            .catch(() => { });
        },
        (err) => {
          let errDesc = "GPS error occurred.";
          if (err.code === 1) {
            errDesc = "Location permission denied. Please enable location in your browser to share GPS.";
          } else if (err.code === 2) {
            errDesc = "GPS signal unavailable. Trying to acquire satellite lock...";
          } else if (err.code === 3) {
            errDesc = "GPS request timed out. Retrying...";
          }
          setGpsErrorState(errDesc);
          console.warn("Geolocation watchPosition notice:", err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 10000,
        }
      );

      trackingWatchIdRef.current = watchId;
    },
    [destCoords.lat, destCoords.lng, destination, getRideAuthHeaders, proximityRadius, recordNotification, showToast, updateLiveTrackingMarkersOnMap]
  );

  // Fetch current tracking state & arrival detection
  const fetchTrackingState = useCallback(
    async (conversationId: string) => {
      try {
        const res = await fetch(`/api/rides/conversations/${conversationId}/tracking`, {
          headers: getRideAuthHeaders(),
        });
        const data = await res.json();
        if (data.success && data.tracking) {
          const prev = trackingSessionRef.current;
          setTrackingSession(data.tracking);

          // Detect partner arrival transition
          if (data.tracking.partnerArrived && !prev?.partnerArrived) {
            showToast(`🎉 ${data.tracking.partner?.fullName} has arrived at the destination!`);
            recordNotification(
              `${data.tracking.partner?.fullName} arrived! 🎯`,
              `${data.tracking.partner?.fullName} has safely reached ${destination || "the destination"}.`,
              "car"
            );
          }

          if (data.tracking.partnerLocation) {
            const pLoc = data.tracking.partnerLocation;
            const refCoords = myLiveCoordsRef.current || pickupCoordsRef.current;
            const dist = computeDistanceBetweenKm(refCoords.lat, refCoords.lng, pLoc.lat, pLoc.lng);
            setPartnerDistanceMeters(Math.round(dist * 1000));

            updateLiveTrackingMarkersOnMap(
              { lat: pLoc.lat, lng: pLoc.lng },
              data.tracking.partner?.fullName || "Travel Partner",
              myLiveCoordsRef.current
            );
          } else {
            setPartnerDistanceMeters(null);
            if (partnerLiveMarkerRef.current) {
              partnerLiveMarkerRef.current.setMap(null);
              partnerLiveMarkerRef.current = null;
            }
          }

          if (data.tracking.journeyStatus === "COMPLETED") {
            stopBrowserGeolocation();
          }
        }
      } catch (err) {
        console.error("fetchTrackingState error:", err);
      }
    },
    [destination, getRideAuthHeaders, recordNotification, showToast, stopBrowserGeolocation, updateLiveTrackingMarkersOnMap]
  );

  // Manual arrival confirmation handler
  const handleManualArrival = async () => {
    if (!activeConversationId) return;
    setIsConfirmingArrival(true);
    try {
      const res = await fetch(`/api/rides/conversations/${activeConversationId}/arrival`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRideAuthHeaders() },
        body: JSON.stringify({ manualArrival: true }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("🎯 Arrival confirmed! Travel partner notified.");
        recordNotification(
          "Arrival Confirmed! 🎯",
          `You confirmed arrival at ${destination || "the destination"}.`,
          "car"
        );
        fetchTrackingState(activeConversationId);
        const msgRes = await fetch(`/api/rides/conversations/${activeConversationId}/messages`, {
          headers: getRideAuthHeaders(),
        });
        const msgData = await msgRes.json();
        if (msgData.success && Array.isArray(msgData.messages)) {
          setChatMessages(msgData.messages);
        }
      }
    } catch (err) {
      console.error("handleManualArrival error:", err);
      showToast("⚠️ Network error confirming arrival.");
    } finally {
      setIsConfirmingArrival(false);
    }
  };

  // Handle explicit consent grant or revocation
  const handleToggleConsent = async (consent: boolean) => {
    if (!activeConversationId) return;
    setIsUpdatingConsent(true);
    try {
      const res = await fetch(`/api/rides/conversations/${activeConversationId}/tracking/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRideAuthHeaders() },
        body: JSON.stringify({ consent }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          consent
            ? "🛰️ GPS consent granted! Live tracking enabled."
            : "🛑 Location sharing consent revoked."
        );
        setShowConsentModal(false);
        if (consent) {
          startBrowserGeolocation(activeConversationId);
        } else {
          stopBrowserGeolocation();
        }
        await fetchTrackingState(activeConversationId);
        const msgRes = await fetch(`/api/rides/conversations/${activeConversationId}/messages`, {
          headers: getRideAuthHeaders(),
        });
        const msgData = await msgRes.json();
        if (msgData.success && Array.isArray(msgData.messages)) {
          setChatMessages(msgData.messages);
        }
      } else {
        showToast(`⚠️ ${data.error || "Failed to update consent"}`);
      }
    } catch (err) {
      console.error("handleToggleConsent error:", err);
      showToast("⚠️ Network error updating consent.");
    } finally {
      setIsUpdatingConsent(false);
    }
  };

  // Handle tracking action (pause, resume, end journey)
  const handleTrackingAction = async (action: "STOP_SHARING" | "RESUME_SHARING" | "END_JOURNEY") => {
    if (!activeConversationId) return;
    setIsUpdatingTrackingAction(true);
    try {
      const res = await fetch(`/api/rides/conversations/${activeConversationId}/tracking/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRideAuthHeaders() },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Tracking updated.");
        if (action === "STOP_SHARING" || action === "END_JOURNEY") {
          stopBrowserGeolocation();
        } else if (action === "RESUME_SHARING") {
          startBrowserGeolocation(activeConversationId);
        }
        if (action === "END_JOURNEY") {
          setShowReviewModal(true);
        }
        await fetchTrackingState(activeConversationId);
        const msgRes = await fetch(`/api/rides/conversations/${activeConversationId}/messages`, {
          headers: getRideAuthHeaders(),
        });
        const msgData = await msgRes.json();
        if (msgData.success && Array.isArray(msgData.messages)) {
          setChatMessages(msgData.messages);
        }
      } else {
        showToast(`⚠️ ${data.error || "Action failed"}`);
      }
    } catch (err) {
      console.error("handleTrackingAction error:", err);
      showToast("⚠️ Network error.");
    } finally {
      setIsUpdatingTrackingAction(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!activeConversationId) return;
    setIsSubmittingReview(true);
    try {
      const res = await fetch(`/api/rides/conversations/${activeConversationId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRideAuthHeaders() },
        body: JSON.stringify({
          rating: reviewRating,
          feedback: reviewFeedback.trim() || undefined,
          reported: reviewReported,
          reportCategory: reviewReported ? reviewCategory : undefined,
          reportDetails: reviewReported ? reviewDetails.trim() || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          reviewReported
            ? "🛡️ Review & Safety Report submitted. Thank you."
            : "🌟 Thank you for reviewing your commute partner!"
        );
        setShowReviewModal(false);
        recordNotification(
          "Review Submitted ⭐",
          `Your rating and feedback for ${activeConversation?.partnerName || "your travel partner"} has been recorded.`,
          "car"
        );
      } else {
        showToast(`⚠️ ${data.error || "Failed to submit review"}`);
      }
    } catch (err) {
      console.error("handleSubmitReview error:", err);
      showToast("⚠️ Network error submitting review.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const focusPartnerOnMap = () => {
    if (!mapInstanceRef.current || !trackingSession?.partnerLocation) return;
    const { lat, lng } = trackingSession.partnerLocation;
    mapInstanceRef.current.panTo({ lat, lng });
    mapInstanceRef.current.setZoom(16);
    showToast(`🎯 Centered on ${trackingSession.partner?.fullName || "Travel Partner"}`);
  };

  const openConversation = async (conversationId: string) => {
    setActiveConversationId(conversationId);
    setMobileTab("map");
    setShowSplitFareBar(false);
    setSplitFareAmount(String(fareEstimate.sharedFareBdt));
    try {
      const res = await fetch(`/api/rides/conversations/${conversationId}`, {
        headers: getRideAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && data.conversation) {
        setActiveConversation(data.conversation);
        setChatMessages(data.conversation.messages || []);
      }
      fetchTrackingState(conversationId);

      // Check review status
      fetch(`/api/rides/conversations/${conversationId}/review`, {
        headers: getRideAuthHeaders(),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            if (d.isJourneyCompleted && !d.hasReviewed) {
              setShowReviewModal(true);
            }
          }
        })
        .catch(() => { });
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  };

  const handleSendMessage = async (textToSend?: string, messageType = "TEXT", locationName?: string) => {
    const text = (textToSend || newMessageText).trim();
    if (!text || !activeConversationId) return;

    setIsSendingMessage(true);
    try {
      const res = await fetch(`/api/rides/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRideAuthHeaders() },
        body: JSON.stringify({
          text,
          messageType,
          locationName: locationName || (messageType === "MEETING_LOCATION" ? text : null),
        }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setChatMessages((prev) => [...prev, data.message]);
        if (!textToSend) setNewMessageText("");
        if (messageType === "MEETING_LOCATION") {
          setActiveConversation((prev) => ({
            ...(prev || {}),
            meetingLocation: locationName || text,
            meetingConfirmed: false,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      showToast("⚠️ Failed to deliver message.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleConfirmMeetingSpot = async () => {
    if (!activeConversationId || !activeConversation?.meetingLocation) return;
    try {
      const res = await fetch(`/api/rides/conversations/${activeConversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getRideAuthHeaders() },
        body: JSON.stringify({
          meetingLocation: activeConversation.meetingLocation,
          meetingConfirmed: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveConversation((prev) => ({ ...(prev || {}), meetingConfirmed: true }));
        showToast("🤝 Meeting location confirmed with travel partner!");
        const msgRes = await fetch(`/api/rides/conversations/${activeConversationId}/messages`, {
          headers: getRideAuthHeaders(),
        });
        const msgData = await msgRes.json();
        if (msgData.success && Array.isArray(msgData.messages)) {
          setChatMessages(msgData.messages);
        }
      }
    } catch (err) {
      console.error("Confirm meeting spot error:", err);
    }
  };

  // Settle fair share directly in UniShare Wallet Tokens (1 Token = ৳1 BDT)
  const handleSettleSplitFare = async () => {
    if (!activeConversationId) return;
    const amount = Math.round(Number(splitFareAmount));
    if (!Number.isFinite(amount) || amount < 1 || amount > 2000) {
      showToast("⚠️ Enter a valid fair-share amount between 1 and 2000 BDT.");
      return;
    }

    setIsPayingSplitFare(true);
    try {
      const res = await fetch(`/api/rides/conversations/${activeConversationId}/split-fare`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRideAuthHeaders() },
        body: JSON.stringify({
          amount,
          note: `${pickup.split(",")[0]} → ${destination.split(",")[0]}`,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        showToast(`⚠️ ${data?.error || "Could not complete wallet split payment."}`);
        return;
      }

      if (data.user) {
        saveClientUser(data.user);
      }
      if (data.message) {
        setChatMessages((prev) => [...prev, data.message]);
      }
      setShowSplitFareBar(false);
      showToast(`💸 Settled ৳${amount} (${amount} tokens) with ${data.recipientName || "partner"}!`);
    } catch {
      showToast("⚠️ Network error settling ride fare.");
    } finally {
      setIsPayingSplitFare(false);
    }
  };

  // Poll conversation messages every 2.5 seconds while chat drawer is open
  useEffect(() => {
    if (!activeConversationId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rides/conversations/${activeConversationId}/messages`, {
          headers: getRideAuthHeaders(),
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.messages)) {
          setChatMessages(data.messages);
        }
      } catch {
        // ignore polling errors
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [activeConversationId, getRideAuthHeaders]);

  // Periodic tracking refresh and live cleanup
  useEffect(() => {
    if (!activeConversationId) {
      stopBrowserGeolocation();
      return;
    }

    const initTimer = setTimeout(() => {
      void fetchTrackingState(activeConversationId);
    }, 0);
    const trackingInterval = setInterval(() => {
      void fetchTrackingState(activeConversationId);
    }, 3000);

    return () => {
      clearTimeout(initTimer);
      clearInterval(trackingInterval);
      stopBrowserGeolocation();
    };
  }, [activeConversationId, fetchTrackingState, stopBrowserGeolocation]);

  if (!isAuthenticated) {
    return (
      <div className="unishare-rides-container" style={{ minHeight: "100vh", background: "#ffffff" }}>
        <AppNavbar activeNav="rides" />
        <div style={{ padding: "36px 24px", textAlign: "center", color: "#4b5553", fontWeight: 600 }}>
          Checking campus authorization...
        </div>
      </div>
    );
  }

  return (
    <div className="unishare-rides-container">
      {/* Top Application Navbar */}
      <AppNavbar activeNav="rides" />

      {/* Mobile Screen Tab Toggle */}
      <div className="mobile-view-toggle-bar">
        <button
          type="button"
          className={`mobile-toggle-btn ${mobileTab === "sidebar" ? "active" : ""}`}
          onClick={() => setMobileTab("sidebar")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
          Journey Setup
        </button>
        <button
          type="button"
          className={`mobile-toggle-btn ${mobileTab === "map" ? "active" : ""}`}
          onClick={() => setMobileTab("map")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          {isGoogleMapsReady ? "Google Map" : "Campus Map"}
        </button>
      </div>

      {/* Main Two-Column Google Maps Split Layout */}
      <div className="rides-split-layout">
        {/* =====================================================
            LEFT SIDEBAR: CONTROLS & JOURNEY PREFERENCES
            ===================================================== */}
        <aside className={`rides-sidebar ${mobileTab === "map" ? "hide-mobile" : ""}`}>
          <div className="rides-sidebar-scroll">
            {/* Header / Breadcrumb & Requests */}
            <div>
              <div className="rides-top-bar">
                <nav className="rides-breadcrumb" aria-label="Breadcrumb">
                  <Link href="/home">Home</Link>
                  <span aria-hidden="true">›</span>
                  <span>Rides</span>
                </nav>
                <button
                  type="button"
                  className="connection-requests-trigger-btn"
                  onClick={() => {
                    fetchConnectionRequests();
                    setShowRequestsModal(true);
                  }}
                  title="View travel connection requests"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <span>Requests</span>
                  {incomingRequests.filter((r) => r.status === "PENDING").length > 0 && (
                    <span className="requests-badge-count">
                      {incomingRequests.filter((r) => r.status === "PENDING").length}
                    </span>
                  )}
                </button>
              </div>
              <p className="rides-eyebrow">
                {(currentUser.university || "University of Dhaka").toUpperCase()} · VERIFIED STUDENTS ONLY
              </p>
              <div className="rides-title-block">
                <h1>Destination Live Matching</h1>
                <p>Find verified {currentUser.university} peers heading along your route and split ride cost.</p>
              </div>
            </div>

            {/* -------------------------------------------------
                1. PICKUP LOCATION
                ------------------------------------------------- */}
            <div className={`location-input-group ${mapPickMode === "pickup" ? "active-picking" : ""}`}>
              <div className="input-label-row">
                <span className="location-label pickup-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="6" />
                  </svg>
                  Pickup Location
                </span>
                <button
                  type="button"
                  className={`map-pick-btn ${mapPickMode === "pickup" ? "active" : ""}`}
                  onClick={() => setMapPickMode(mapPickMode === "pickup" ? "none" : "pickup")}
                  title="Click to select pickup directly by clicking on the map"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  {mapPickMode === "pickup" ? "Click map to set..." : "Pin on Map"}
                </button>
              </div>

              <div className="input-field-wrapper">
                <span className="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  ref={pickupInputRef}
                  type="text"
                  className="location-text-input"
                  placeholder="Enter pickup point (or click Pin on Map)"
                  value={pickup}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPickup(val);
                    setShowPickupAutocomplete(true);
                  }}
                  onFocus={() => setShowPickupAutocomplete(true)}
                  onBlur={() => setTimeout(() => setShowPickupAutocomplete(false), 250)}
                  aria-label="Pickup location search"
                />
                {pickup && (
                  <button
                    type="button"
                    className="location-clear-btn"
                    onClick={() => {
                      setPickup("");
                      pickupInputRef.current?.focus();
                    }}
                    aria-label="Clear pickup"
                  >
                    ✕
                  </button>
                )}

                {/* Autocomplete Dropdown anchored directly inside input-field-wrapper */}
                {showPickupAutocomplete && !isGoogleMapsReady && (
                  <div className="autocomplete-dropdown" role="listbox" aria-label="Pickup location suggestions">
                    {/* Quick Action: Use Current GPS Location */}
                    <div
                      className="autocomplete-item autocomplete-gps-item"
                      role="option"
                      aria-selected={isLocatingGps}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowPickupAutocomplete(false);
                        handleUseCurrentLocation();
                      }}
                    >
                      <span className="item-icon">📍</span>
                      <div className="autocomplete-item-text">
                        <span className="autocomplete-item-title">Use Current Location (GPS)</span>
                        <span className="autocomplete-item-sub">Accurately detect my live campus GPS location</span>
                      </div>
                    </div>

                    <div className="autocomplete-dropdown-header">
                      {isLoadingPickupPlaces
                        ? "Searching live locations..."
                        : pickup.trim()
                        ? `Matching Places for "${pickup}"`
                        : "Recommended Campus & Pickup Hubs"}
                    </div>

                    {pickupPlaces.map((pl) => (
                      <div
                        key={`pickup-${pl.id}`}
                        className="autocomplete-item"
                        role="option"
                        aria-selected={pickup === pl.name}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const nextPt = { lat: pl.lat, lng: pl.lng };
                          setPickup(pl.name);
                          setPickupCoords(nextPt);
                          setShowPickupAutocomplete(false);
                          focusRouteOnMap(nextPt, destCoords);
                          showToast(`📍 Pickup set: ${pl.label}`);
                          reportRidesPresence(nextPt, pl.name);
                        }}
                      >
                        <span className="item-icon">{pl.type === "university" ? "🎓" : "📍"}</span>
                        <div className="autocomplete-item-text">
                          <span className="autocomplete-item-title">{pl.label}</span>
                          <span className="autocomplete-item-sub">{pl.name}</span>
                        </div>
                      </div>
                    ))}
                    {pickupPlaces.length === 0 && !isLoadingPickupPlaces && (
                      <div className="autocomplete-empty-note">
                        Type any campus, street or landmark to search live
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* GPS Current Location Button */}
              <button
                type="button"
                className={`use-gps-btn ${isLocatingGps ? "locating" : ""}`}
                onClick={handleUseCurrentLocation}
                disabled={isLocatingGps}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
                </svg>
                {isLocatingGps ? "Acquiring GPS location..." : "Use Current Location using GPS"}
              </button>
            </div>

            {/* -------------------------------------------------
                2. DESTINATION LOCATION
                ------------------------------------------------- */}
            <div className={`location-input-group destination-group ${mapPickMode === "destination" ? "active-picking" : ""}`}>
              <div className="input-label-row">
                <span className="location-label dest-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
                  </svg>
                  Destination
                </span>
                <button
                  type="button"
                  className={`map-pick-btn ${mapPickMode === "destination" ? "active" : ""}`}
                  onClick={() => setMapPickMode(mapPickMode === "destination" ? "none" : "destination")}
                  title="Click to select destination directly by clicking on the map"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  {mapPickMode === "destination" ? "Click map to set..." : "Pin on Map"}
                </button>
              </div>

              <div className="input-field-wrapper">
                <span className="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  ref={destInputRef}
                  type="text"
                  className="location-text-input"
                  placeholder="Search destination (e.g. TSC, DU, Farmgate)"
                  value={destination}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDestination(val);
                    setShowDestAutocomplete(true);
                  }}
                  onFocus={() => setShowDestAutocomplete(true)}
                  onBlur={() => setTimeout(() => setShowDestAutocomplete(false), 250)}
                  aria-label="Destination search"
                />
                {destination && (
                  <button
                    type="button"
                    className="location-clear-btn"
                    onClick={() => {
                      setDestination("");
                      destInputRef.current?.focus();
                    }}
                    aria-label="Clear destination"
                  >
                    ✕
                  </button>
                )}

                {/* Destination Dropdown anchored directly inside input-field-wrapper */}
                {showDestAutocomplete && !isGoogleMapsReady && (
                  <div className="autocomplete-dropdown" role="listbox" aria-label="Destination suggestions">
                    <div className="autocomplete-dropdown-header">
                      {isLoadingDestPlaces
                        ? "Searching destinations..."
                        : destination.trim()
                        ? `Matching Destinations for "${destination}"`
                        : "Recommended Campus Destinations"}
                    </div>
                    {destPlaces.map((pl) => (
                      <div
                        key={`dest-${pl.id}`}
                        className="autocomplete-item"
                        role="option"
                        aria-selected={destination === pl.name}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const nextPt = { lat: pl.lat, lng: pl.lng };
                          setDestination(pl.name);
                          setDestCoords(nextPt);
                          setShowDestAutocomplete(false);
                          focusRouteOnMap(pickupCoords, nextPt);
                          showToast(`🎯 Destination set: ${pl.label}`);
                          reportRidesPresence(pickupCoords, pickup, pl.name);
                        }}
                      >
                        <span className="item-icon">{pl.type === "university" ? "🎓" : "🎯"}</span>
                        <div className="autocomplete-item-text">
                          <span className="autocomplete-item-title">{pl.label}</span>
                          <span className="autocomplete-item-sub">{pl.name}</span>
                        </div>
                      </div>
                    ))}
                    {destPlaces.length === 0 && !isLoadingDestPlaces && (
                      <div className="autocomplete-empty-note">
                        Type any campus or destination to search live
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Frequent Campus Hubs Shortcuts */}
              <div className="quick-destinations-block">
                <div className="quick-dest-label">Frequent Campus Hubs:</div>
                <div className="quick-dest-chips">
                  {QUICK_CAMPUS_DESTINATIONS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      className={`dest-chip ${destination === chip.name ? "active" : ""}`}
                      onClick={() => {
                        const nextPt = { lat: chip.lat, lng: chip.lng };
                        setDestination(chip.name);
                        setDestCoords(nextPt);
                        focusRouteOnMap(pickupCoords, nextPt);
                        showToast(`🎯 Destination: ${chip.label}`);
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* -------------------------------------------------
                3. GENDER PREFERENCE (Safety Filter)
                ------------------------------------------------- */}
            <div className="gender-preference-group">
              <div className="gender-control-label">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Gender Preference
              </div>

              <div className="gender-segmented-control" role="radiogroup" aria-label="Gender Preference Selection">
                <button
                  type="button"
                  role="radio"
                  aria-checked={genderPreference === "no_preference"}
                  className={`gender-option-btn ${genderPreference === "no_preference" ? "selected" : ""}`}
                  onClick={() => setGenderPreference("no_preference")}
                >
                  <span className="gender-icon">👥</span>
                  <span>No Preference</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={genderPreference === "women_only"}
                  className={`gender-option-btn ${genderPreference === "women_only" ? "selected" : ""}`}
                  onClick={() => setGenderPreference("women_only")}
                >
                  <span className="gender-icon">👩</span>
                  <span>Women Only</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={genderPreference === "men_only"}
                  className={`gender-option-btn ${genderPreference === "men_only" ? "selected" : ""}`}
                  onClick={() => setGenderPreference("men_only")}
                >
                  <span className="gender-icon">👨</span>
                  <span>Men Only</span>
                </button>
              </div>

              <div className="gender-safety-note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>
                  Safety enforcement: Matching is restricted strictly to verified university students with approved academic emails.
                </span>
              </div>
            </div>

            {/* -------------------------------------------------
                3B. SMART COST SPLIT & SAVINGS OPTIMIZER
                ------------------------------------------------- */}
            <div className="rides-savings-card" aria-label="Commute fare split optimizer">
              <div className="rides-savings-header">
                <span className="rides-savings-title">
                  <Wallet size={14} strokeWidth={2.2} />
                  <span>Cost split &amp; savings</span>
                </span>
                <span className="rides-savings-badge">
                  Save ৳{fareEstimate.savingsBdt}/trip ({fareEstimate.savingsPercent}%)
                </span>
              </div>

              <div className="rides-savings-controls">
                <div className="rides-mode-pills" role="group" aria-label="Transport mode">
                  {(
                    [
                      { id: "cng", label: "CNG" },
                      { id: "car", label: "Car" },
                      { id: "rickshaw", label: "Rickshaw" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`rides-mini-pill ${transportMode === m.id ? "active" : ""}`}
                      onClick={() => {
                        setTransportMode(m.id);
                        if (m.id === "rickshaw" && riderGroupSize > 2) setRiderGroupSize(2);
                        if (m.id === "cng" && riderGroupSize > 3) setRiderGroupSize(3);
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="rides-riders-pills" role="group" aria-label="Split group size">
                  {([2, 3, 4] as const)
                    .filter((count) => (transportMode === "rickshaw" ? count <= 2 : transportMode === "cng" ? count <= 3 : true))
                    .map((count) => (
                      <button
                        key={count}
                        type="button"
                        className={`rides-mini-pill ${effectiveRiderCount === count ? "active" : ""}`}
                        onClick={() => setRiderGroupSize(count)}
                        title={`Split fare across ${count} verified students`}
                      >
                        {count}p
                      </button>
                    ))}
                </div>
              </div>

              <div className="rides-savings-breakdown">
                <div className="rides-savings-price">
                  <span className="rides-savings-solo">৳{fareEstimate.soloFareBdt}</span>
                  <span>~৳{fareEstimate.sharedFareBdt}/person</span>
                </div>
                <div className="rides-savings-monthly">
                  ~৳{fareEstimate.monthlySavingsBdt.toLocaleString()}/mo saved
                </div>
              </div>

              {fareEstimate.mrtHint && (
                <div className="rides-mrt-hint">
                  <TrainFront size={14} strokeWidth={2.2} />
                  <span>Budget tip: {fareEstimate.mrtHint}</span>
                </div>
              )}
            </div>

            {/* -------------------------------------------------
                4. LIVE ROUTE BROADCAST & FIND TRAVEL PARTNERS
                ------------------------------------------------- */}
            {dbUserVerified === false ? (
              <div className="live-broadcast-card unverified">
                <div className="live-broadcast-row">
                  <span className="live-broadcast-status">Student verification pending</span>
                  <Link href="/student-verification" className="live-verify-link">
                    Verify Student ID
                  </Link>
                </div>
                <div className="live-broadcast-route">
                  Complete your Student ID verification so friends and verified peers can see your live route on the map.
                </div>
              </div>
            ) : myActiveJourney ? (
              <div className="live-broadcast-card active">
                <div className="live-broadcast-row">
                  <span className="live-broadcast-status">
                    <span className="realtime-pulse-dot" />
                    You are live on map
                  </span>
                  <div className="live-broadcast-actions">
                    <button
                      type="button"
                      className="live-go-btn"
                      onClick={handleRegisterRoute}
                      disabled={isRegisteringRoute}
                      title="Update peers with your current pickup and destination"
                    >
                      {isRegisteringRoute ? "Updating..." : "Update Route"}
                    </button>
                    <button
                      type="button"
                      className="live-pause-btn"
                      onClick={handlePauseLiveRoute}
                      disabled={isUpdatingBroadcast}
                    >
                      {isUpdatingBroadcast ? "..." : "Pause"}
                    </button>
                  </div>
                </div>
                <div className="live-broadcast-route">
                  {myActiveJourney.origin.split(",")[0]} → <strong>{myActiveJourney.destination.split(",")[0]}</strong> · Visible to peers
                </div>
              </div>
            ) : (
              <div className="live-broadcast-card">
                <div className="live-broadcast-row">
                  <span className="live-broadcast-status">Share your route live</span>
                  <button
                    type="button"
                    className="live-go-btn"
                    onClick={handleRegisterRoute}
                    disabled={isRegisteringRoute}
                  >
                    {isRegisteringRoute ? "Going Live..." : "Go Live on Map"}
                  </button>
                </div>
                <div className="live-broadcast-route">
                  Let logged-in friends & campus riders see your route and split costs.
                </div>
              </div>
            )}

            <button
              type="button"
              className="find-partners-btn"
              onClick={() => handleFindPartners()}
              disabled={isSearching}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {isSearching ? "Searching Corridor..." : "Find Travel Partners"}
            </button>

            {/* -------------------------------------------------
                5. LIVE SEARCH STATES (Loading, Error, No-Results, Results)
                ------------------------------------------------- */}

            {/* ACTIVE CAMPUS RIDERS ON LOAD (Pre-search discovery) */}
            {!isSearching && !searchError && !hasSubmittedSearch && (
              <div className="active-campus-section">
                <div className="active-campus-header">
                  <span className="active-campus-title">
                    <span className="realtime-pulse-dot" />
                    Active Campus Commuters
                  </span>
                  <span className="results-count-badge">{activeCampusRiders.length}</span>
                </div>
                <p className="active-campus-sub">
                  Verified peers currently open to sharing rides on the map. Click a rider to inspect their corridor and split costs.
                </p>

                {isLoadingActiveRiders ? (
                  <div className="active-campus-sub">Loading active commuters...</div>
                ) : activeCampusRiders.length === 0 ? (
                  <div className="no-results-actions">
                    <div className="active-campus-sub">
                      No other peers have posted an active route right now. Register yours so others heading your way can join.
                    </div>
                    <button
                      type="button"
                      className="register-route-btn"
                      onClick={handleRegisterRoute}
                      disabled={isRegisteringRoute}
                    >
                      {isRegisteringRoute ? "Registering Route..." : "Register My Route for Peers"}
                    </button>
                  </div>
                ) : (
                  <div className="active-campus-mini-list">
                    {activeCampusRiders.map((peer) => {
                      const peerOrigin = resolvePeerPoint(peer.originCoords, peer.origin, pickupCoords, 1);
                      const peerDest = resolvePeerPoint(peer.destCoords, peer.destination, destCoords, 2);
                      const est = estimateSharedCommute(peerOrigin, peerDest, effectiveRiderCount, transportMode);
                      const isConnected = hydratedConnectedPartnerIds.includes(peer.id);

                      return (
                        <div
                          key={`active-${peer.id}`}
                          className={`active-campus-mini-card ${peer.corridorMatch ? "corridor" : ""}`}
                          onClick={() => {
                            setInspectedPartnerId(peer.id);
                            focusRouteOnMap(peerOrigin, peerDest);
                          }}
                        >
                          <div className="active-campus-mini-top">
                            <span className="active-campus-mini-user">
                              <span className="map-peer-chip-avatar">{peer.avatarInitials}</span>
                              <span>{peer.fullName}</span>
                            </span>
                            <span className="partner-savings-badge">
                              ~৳{est.sharedFareBdt}/person · -{est.savingsPercent}%
                            </span>
                          </div>
                          <div className="active-campus-mini-route">
                            {peer.origin.split(",")[0]} → <strong>{peer.destination.split(",")[0]}</strong>
                            {peer.corridorMatch ? " · Matches your route" : ""}
                          </div>
                          <div className="active-campus-mini-bottom">
                            <button
                              type="button"
                              className="multi-clear-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdoptPeerRoute(peer);
                              }}
                            >
                              Share Route
                            </button>
                            <button
                              type="button"
                              className={`partner-connect-btn ${isConnected ? "connected" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConnectPartner(peer);
                              }}
                            >
                              {isConnected ? "Request Sent" : "Connect"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STATE 1: LOADING / SEARCHING SKELETON */}
            {isSearching && (
              <div className="search-loading-state" role="status" aria-live="polite">
                <div className="searching-pulse-indicator">
                  <div className="searching-pulse-ring" />
                  <div className="searching-pulse-core">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="searching-title">Scanning Campus Corridors...</div>
                  <div className="searching-subtitle">
                    Filtering verified student peers traveling towards <b>{destination.split(",")[0]}</b> with <b>{genderPreference === "no_preference" ? "No Preference" : genderPreference === "women_only" ? "Women Only" : "Men Only"}</b>.
                  </div>
                </div>
              </div>
            )}

            {/* STATE 2: ERROR STATE */}
            {!isSearching && searchError && (
              <div className="search-error-state" role="alert">
                <div className="search-error-header">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Search Policy Notice
                </div>
                <div className="search-error-message">{searchError}</div>
                <button
                  type="button"
                  className="search-error-btn"
                  onClick={() => handleFindPartners("no_preference")}
                >
                  Switch to &quot;No Preference&quot; &amp; Retry
                </button>
              </div>
            )}

            {/* STATE 3: NO RESULTS STATE */}
            {!isSearching && !searchError && hasSubmittedSearch && searchResults.length === 0 && (
              <div className="search-no-results-state">
                <div className="no-results-icon-wrap">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </div>
                <div>
                  <div className="no-results-title">No Travel Partners Found Yet</div>
                  <div className="no-results-desc">
                    No verified peers are currently traveling to <b>{destination.split(",")[0]}</b> matching your filter.
                  </div>
                </div>

                <div className="no-results-actions">
                  {genderPreference !== "no_preference" && (
                    <button
                      type="button"
                      className="switch-filter-btn"
                      onClick={() => handleFindPartners("no_preference")}
                    >
                      Search with &quot;No Preference&quot; (All Verified Students)
                    </button>
                  )}

                  {!routeRegisteredSuccess ? (
                    <button
                      type="button"
                      className="register-route-btn"
                      onClick={handleRegisterRoute}
                      disabled={isRegisteringRoute}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      {isRegisteringRoute ? "Registering Route..." : "Register My Route for Peers"}
                    </button>
                  ) : (
                    <div className="search-status-footer" style={{ justifyContent: "center", marginTop: 4 }}>
                      <span>🟢 Your route is indexed! Peers searching this corridor will discover you.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STATE 4: ACTIVE VERIFIED PARTNERS RESULTS LIST */}
            {!isSearching && !searchError && hasSubmittedSearch && searchResults.length > 0 && (
              <div className="search-results-section">
                <div className="results-header-bar">
                  <div className="results-count-title">
                    <span>Eligible Travel Partners</span>
                    <span className="results-count-badge">{searchResults.length}</span>
                    <span className="realtime-live-indicator" title="Connected to real-time companion feed">
                      <span className="realtime-pulse-dot" />
                      Live Feed
                    </span>
                  </div>
                  <div className="results-filter-indicator">
                    {genderPreference === "no_preference"
                      ? "All Verified Peers"
                      : genderPreference === "women_only"
                        ? "Women Only"
                        : "Men Only"}
                  </div>
                </div>

                {/* Multi-Partner Selection Action Bar */}
                {selectedPartnerIds.length > 0 && (
                  <div className="partner-multi-select-bar">
                    <div className="multi-select-info">
                      <div className="multi-select-title">
                        👥 {selectedPartnerIds.length} Travel Partner{selectedPartnerIds.length > 1 ? "s" : ""} Selected
                      </div>
                      <div className="multi-select-sub">
                        Ready to coordinate shared commute
                      </div>
                    </div>
                    <div className="multi-select-actions">
                      <button
                        type="button"
                        className="multi-clear-btn"
                        onClick={() => setSelectedPartnerIds([])}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        className="multi-select-btn"
                        onClick={handleSendGroupInvitations}
                        disabled={isSendingGroupInvite}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <line x1="19" y1="8" x2="19" y2="14" />
                          <line x1="22" y1="11" x2="16" y2="11" />
                        </svg>
                        {isSendingGroupInvite ? "Inviting..." : `Invite Selected (${selectedPartnerIds.length})`}
                      </button>
                    </div>
                  </div>
                )}

                <div className="partner-cards-list">
                  {searchResults.map((partner) => {
                    const isConnected = hydratedConnectedPartnerIds.includes(partner.id);
                    const isSelected = selectedPartnerIds.includes(partner.id);
                    const peerOrigin = resolvePeerPoint(partner.originCoords, partner.origin, pickupCoords, 1);
                    const peerDest = resolvePeerPoint(partner.destCoords, partner.destination, destCoords, 2);
                    const partnerFare = estimateSharedCommute(peerOrigin, peerDest, effectiveRiderCount, transportMode);
                    const initials = partner.avatarInitials || partner.fullName
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <div
                        key={partner.id}
                        className={`partner-card ${isSelected ? "selected" : ""} ${
                          partner.isRecommendedPartner ? "recommended-partner-highlight" : ""
                        }`}
                        onClick={() => togglePartnerSelection(partner.id)}
                      >
                        {/* Recommendation Highlight Banner */}
                        {partner.recommendationBadge && (
                          <div className="partner-recommendation-tag">
                            <span className="rec-icon">⭐</span>
                            <span>{partner.recommendationBadge}</span>
                          </div>
                        )}

                        {/* Checkbox Header Row */}
                        <div className="partner-checkbox-row">
                          <span className="partner-checkbox-label">
                            <span className="partner-custom-checkbox">
                              {isSelected && (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </span>
                            {isSelected ? "Partner Selected" : "Click to Select"}
                          </span>
                          <span className="partner-match-pill">{partner.destinationCompatibility}</span>
                        </div>

                        {/* User Identity Block */}
                        <div className="partner-card-top">
                          <div className="partner-user-block">
                            <div className="partner-avatar">{initials}</div>
                            <div className="partner-name-row">
                              <div className="partner-name">
                                <span>{partner.fullName}</span>
                                {partner.isExplorer ? (
                                  <span className="partner-explorer-badge" title="Active on website right now searching for rides">
                                    <span className="explorer-pulse-dot" />
                                    Active Explorer
                                  </span>
                                ) : (
                                  <span className="partner-verified-badge">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Verified
                                  </span>
                                )}
                              </div>
                              <div className="partner-institution">
                                {partner.department ? `${partner.department} · ` : ""}
                                {partner.university}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Corridor & Pickup Distance Badges */}
                        <div className="partner-route-row">
                          <span>{partner.origin.split(",")[0]}</span>
                          <span className="partner-route-arrow">➔</span>
                          <b>{partner.destination.split(",")[0]}</b>
                        </div>

                        <div className="partner-metrics-pill-row">
                          <span className="partner-distance-badge" title="Approximate pickup distance">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                              <circle cx="12" cy="9" r="2.5" />
                            </svg>
                            {partner.approxPickupDistance}
                          </span>
                          <span className="partner-compatibility-badge" title="Destination corridor match">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {partner.destinationCompatibility}
                          </span>
                          <span className="partner-savings-badge" title="Estimated shared ride cost per person">
                            ~৳{partnerFare.sharedFareBdt}/person · Save {partnerFare.savingsPercent}%
                          </span>
                        </div>

                        {partner.notes && (
                          <div className="partner-notes-bubble">&quot;{partner.notes}&quot;</div>
                        )}

                        <div className="partner-card-footer">
                          <div className="partner-time-info">
                            <span>Available · Ready to depart</span>
                          </div>
                          <button
                            type="button"
                            className={`partner-connect-btn ${isConnected ? "connected" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConnectPartner(partner);
                            }}
                          >
                            {isConnected ? (
                              <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Request Sent
                              </>
                            ) : (
                              <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                  <circle cx="9" cy="7" r="4" />
                                  <line x1="19" y1="8" x2="19" y2="14" />
                                  <line x1="22" y1="11" x2="16" y2="11" />
                                </svg>
                                Connect Partner
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* =====================================================
            MAP AREA: GOOGLE MAPS JAVASCRIPT SDK & INTERACTIVE CANVAS
            ===================================================== */}
        <main className={`rides-map-area ${mobileTab === "sidebar" ? "hide-mobile" : ""}`}>
          {/* Active Picking Mode Instruction Banner */}
          {mapPickMode !== "none" && (
            <div className="map-mode-indicator-pill">
              <span>
                {mapPickMode === "pickup"
                  ? "🎯 Click anywhere on the map to set PICKUP LOCATION"
                  : "🎯 Click anywhere on the map to set DESTINATION"}
              </span>
              <button
                type="button"
                className="cancel-pick-btn"
                onClick={() => setMapPickMode("none")}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Map Provider Live Status Badge */}
          <div className={`map-provider-status-badge ${isGoogleMapsReady ? "active" : "simulation"}`}>
            <span className="dot" />
            <span>
              {isGoogleMapsReady
                ? `Google Maps JS SDK Active · ${currentUser.university}`
                : `${currentUser.university} · Live Campus Map`}
            </span>
          </div>

          {/* Floating Map Zoom & Recenter Controls */}
          <div className="map-floating-controls">
            <div className="map-control-group">
              <button
                type="button"
                className="map-control-btn"
                onClick={() => handleZoom(1)}
                title="Zoom in"
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                className="map-control-btn"
                onClick={() => handleZoom(-1)}
                title="Zoom out"
                aria-label="Zoom out"
              >
                −
              </button>
            </div>

            <button
              type="button"
              className="map-control-btn"
              onClick={handleUseCurrentLocation}
              title="Recenter to My Current Location"
              aria-label="Recenter to current GPS location"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
              </svg>
            </button>

            <button
              type="button"
              className="map-control-btn"
              onClick={() => {
                focusRouteOnMap(pickupCoords, destCoords);
                showToast("📍 Map centered to full travel route.");
              }}
              title="Fit Full Route"
              aria-label="Fit entire travel corridor"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
          </div>

          {/* 1. Live Google Maps JavaScript API Container */}
          <div
            ref={googleMapDivRef}
            className={`google-map-element ${mapPickMode !== "none" ? "picking-cursor" : ""}`}
            style={{ display: isGoogleMapsReady ? "block" : "none" }}
          />

          {/* 2. Interactive Web-Mercator OpenStreetMap Campus Commute Map */}
          {!isGoogleMapsReady && (
            <CampusRouteMap
              pickup={pickup}
              destination={destination}
              pickupCoords={pickupCoords}
              destCoords={destCoords}
              gpsCoords={gpsCoords}
              myLiveCoords={myLiveCoords}
              partnerLiveCoords={
                trackingSession?.partnerLocation
                  ? {
                      lat: trackingSession.partnerLocation.lat,
                      lng: trackingSession.partnerLocation.lng,
                      name: trackingSession.partner.fullName,
                    }
                  : null
              }
              mapPickMode={mapPickMode}
              center={mapCenter}
              zoom={mapZoom}
              peers={mapPeers as MapPeerItem[]}
              selectedPartnerIds={selectedPartnerIds}
              connectedPartnerIds={hydratedConnectedPartnerIds}
              inspectedPartnerId={inspectedPartnerId}
              onCenterChange={setMapCenter}
              onZoomChange={setMapZoom}
              onViewportResize={setMapViewport}
              onPickCoordinate={(mode, lat, lng) => {
                const coord = { lat, lng };
                const nearest = findNearestLandmark(coord);
                const resolvedLabel =
                  Math.hypot(nearest.lat - lat, nearest.lng - lng) < 0.004
                    ? nearest.name
                    : `Near ${nearest.label} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

                if (mode === "pickup") {
                  setPickup(resolvedLabel);
                  setPickupCoords(coord);
                  focusRouteOnMap(coord, destCoords);
                  showToast(`📍 Pickup pinned: ${resolvedLabel.split("(")[0].trim()}`);
                  reportRidesPresence(coord, resolvedLabel);
                } else {
                  setDestination(resolvedLabel);
                  setDestCoords(coord);
                  focusRouteOnMap(pickupCoords, coord);
                  showToast(`🎯 Destination pinned: ${resolvedLabel.split("(")[0].trim()}`);
                  reportRidesPresence(pickupCoords, pickup, resolvedLabel);
                }
                setMapPickMode("none");
              }}
              onSelectLandmark={(lm) => {
                if (mapPickMode === "pickup") {
                  const pt = { lat: lm.lat, lng: lm.lng };
                  setPickup(lm.name);
                  setPickupCoords(pt);
                  setMapPickMode("none");
                  focusRouteOnMap(pt, destCoords);
                  showToast(`📍 Pickup set: ${lm.label}`);
                } else {
                  const pt = { lat: lm.lat, lng: lm.lng };
                  setDestination(lm.name);
                  setDestCoords(pt);
                  setMapPickMode("none");
                  focusRouteOnMap(pickupCoords, pt);
                  showToast(`🎯 Destination set: ${lm.label}`);
                }
              }}
              onInspectPartner={setInspectedPartnerId}
              onTogglePartnerSelection={togglePartnerSelection}
              onConnectPartner={(peer) => handleConnectPartner(peer)}
              onAdoptPeerRoute={(peer) => handleAdoptPeerRoute(peer)}
            />
          )}

          {/* Route Distance, Cost Split & Estimated Time Floating Pill */}
          <div className="map-route-summary-pill">
            <span className="route-badge-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="12 2 19 21 12 17 5 21 12 2" />
              </svg>
              {routeInfo.distanceText}
            </span>
            <span className="route-badge-separator" />
            <span className="route-badge-item route-duration">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {routeInfo.durationText}
            </span>
            <span className="route-badge-separator" />
            <span className="route-cost-split-pill" title={`Estimated solo fare ~৳${fareEstimate.soloFareBdt}`}>
              Split ~৳{fareEstimate.sharedFareBdt}/person · Save {fareEstimate.savingsPercent}%
            </span>
            <span className="route-badge-separator" />
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              {routeInfo.summary}
            </span>
          </div>

          {/* Floating Live Commute Telemetry Pill on Google Maps */}
          {trackingSession?.bothConsented && trackingSession?.journeyStatus === "IN_PROGRESS" && (
            <button
              type="button"
              className="floating-map-tracking-pill"
              onClick={focusPartnerOnMap}
              title="Click to focus on travel companion"
            >
              <span className="floating-pill-dot" />
              <span>
                Live Commute: {trackingSession.partner.fullName} is{" "}
                {partnerDistanceMeters !== null
                  ? partnerDistanceMeters < 1000
                    ? `${partnerDistanceMeters}m away`
                    : `${(partnerDistanceMeters / 1000).toFixed(1)}km`
                  : "sharing GPS"}
              </span>
            </button>
          )}

          {/* ===================================================
              3. PRIVATE TRAVEL COORDINATION CHAT DRAWER
              =================================================== */}
          {activeConversationId && activeConversation && (
            <div className="rides-chat-drawer" role="dialog" aria-label="Private travel companion coordination chat">
              {/* Header */}
              <div className="chat-drawer-header">
                <div className="chat-partner-profile">
                  <div className="chat-partner-avatar">
                    {activeConversation.partnerAvatarInitials}
                  </div>
                  <div className="chat-partner-name-block">
                    <div className="chat-partner-name">
                      <span>{activeConversation.partnerName}</span>
                      <span className="partner-verified-badge" style={{ fontSize: "9.5px", padding: "1px 5px" }}>
                        Verified
                      </span>
                    </div>
                    <div className="chat-partner-sub">
                      {activeConversation.partnerBadge}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="chat-drawer-close-btn"
                  onClick={() => {
                    setActiveConversationId(null);
                    setActiveConversation(null);
                  }}
                  title="Close conversation"
                >
                  ✕
                </button>
              </div>

              {/* Consent-Based Live GPS Tracking Panel */}
              <div className={`live-tracking-panel ${trackingSession?.journeyStatus === "IN_PROGRESS" ? "in-progress" : ""}`}>
                <div className="tracking-header-row">
                  <div className="tracking-title">
                    <span>🛰️</span>
                    <span>Live Journey GPS Tracking</span>
                  </div>
                  {trackingSession && (
                    <span className={`tracking-status-pill ${trackingSession.connectionStatus === "LIVE" ? "live" :
                        trackingSession.connectionStatus === "STALE" ? "stale" :
                          trackingSession.connectionStatus === "PAUSED" ? "paused" :
                            trackingSession.connectionStatus === "COMPLETED" ? "completed" : "awaiting"
                      }`}>
                      <span className="tracking-status-dot" />
                      {trackingSession.connectionStatus === "LIVE" ? "Live GPS" :
                        trackingSession.connectionStatus === "STALE" ? "Signal Weak" :
                          trackingSession.connectionStatus === "PAUSED" ? "Paused" :
                            trackingSession.connectionStatus === "COMPLETED" ? "Journey Ended" : "Awaiting Agreement"}
                    </span>
                  )}
                </div>

                {/* Awaiting Consent */}
                {!trackingSession?.bothConsented && trackingSession?.journeyStatus !== "COMPLETED" && (
                  <div className="tracking-consent-box">
                    <div>
                      <b>Consent-Based Commute Tracking</b>
                      <div className="tracking-consent-desc">
                        Both you and {activeConversation?.partnerName} must explicitly agree to share GPS coordinates during this journey. You can pause or stop sharing at any time.
                      </div>
                    </div>
                    {!trackingSession?.myConsent ? (
                      <button
                        type="button"
                        className="tracking-btn-primary"
                        onClick={() => setShowConsentModal(true)}
                        disabled={isUpdatingConsent}
                      >
                        <span>🛡️</span> Agree &amp; Start GPS Tracking
                      </button>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ fontSize: "11px", color: "#0284c7", fontWeight: 700 }}>
                          ✓ You consented. Waiting for {activeConversation?.partnerName}&apos;s agreement...
                        </div>
                        <button
                          type="button"
                          className="tracking-btn-revoke"
                          onClick={() => handleToggleConsent(false)}
                          disabled={isUpdatingConsent}
                        >
                          Revoke My Consent
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* In Progress Telemetry */}
                {trackingSession?.bothConsented && trackingSession?.journeyStatus === "IN_PROGRESS" && (
                  <>
                    <div className="tracking-telemetry-grid">
                      <div className="tracking-telemetry-card">
                        <span className="tracking-telemetry-label">Partner Distance</span>
                        <span className="tracking-telemetry-val">
                          {partnerDistanceMeters !== null
                            ? partnerDistanceMeters < 1000
                              ? `${partnerDistanceMeters}m away`
                              : `${(partnerDistanceMeters / 1000).toFixed(1)}km away`
                            : "Calculating..."}
                        </span>
                      </div>
                      <div className="tracking-telemetry-card">
                        <span className="tracking-telemetry-label">Freshness</span>
                        <span className="tracking-telemetry-val">
                          {trackingSession.partnerLocation?.freshnessSeconds !== undefined && trackingSession.partnerLocation?.freshnessSeconds !== null
                            ? trackingSession.partnerLocation.freshnessSeconds <= 5
                              ? "Just now"
                              : `${trackingSession.partnerLocation.freshnessSeconds}s ago`
                            : "Awaiting signal"}
                        </span>
                      </div>
                    </div>

                    {/* GPS Error & Permission Fallback Alert */}
                    {gpsErrorState && (
                      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "8px 10px", fontSize: "11px", color: "#b91c1c", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>⚠️</span>
                        <span>{gpsErrorState}</span>
                      </div>
                    )}

                    <div className="tracking-browser-notice">
                      <span>ℹ️</span>
                      <span>{trackingSession.browserLimitationNotice}</span>
                    </div>

                    {/* Configurable Proximity Threshold */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "#64748b", padding: "2px 0" }}>
                      <span>🎯 Arrival Detection Radius:</span>
                      <div style={{ display: "flex", gap: "4px" }}>
                        {[50, 100, 150].map((r) => (
                          <button
                            key={r}
                            type="button"
                            style={{
                              padding: "2px 7px",
                              borderRadius: "999px",
                              border: "1px solid",
                              borderColor: proximityRadius === r ? "var(--teal)" : "#cbd5e1",
                              background: proximityRadius === r ? "var(--mint)" : "#ffffff",
                              color: proximityRadius === r ? "var(--teal)" : "#64748b",
                              fontSize: "10.5px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                            onClick={() => setProximityRadius(r)}
                          >
                            {r}m
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Manual Arrival Confirmation Button if not yet arrived */}
                    {!trackingSession.myArrived && (
                      <button
                        type="button"
                        className="arrival-manual-confirm-btn"
                        onClick={handleManualArrival}
                        disabled={isConfirmingArrival}
                        title="Click if you have reached the destination"
                      >
                        <span>📍</span> Reached Destination? Confirm Arrival
                      </button>
                    )}

                    <div className="tracking-controls-row">
                      <button
                        type="button"
                        className="tracking-ctrl-btn focus"
                        onClick={focusPartnerOnMap}
                        title="Pan Google Map to partner's location"
                      >
                        🎯 Focus Map
                      </button>
                      {trackingSession.mySharing ? (
                        <button
                          type="button"
                          className="tracking-ctrl-btn"
                          onClick={() => handleTrackingAction("STOP_SHARING")}
                          disabled={isUpdatingTrackingAction}
                          title="Pause sharing my GPS location"
                        >
                          ⏸️ Pause
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="tracking-ctrl-btn"
                          onClick={() => handleTrackingAction("RESUME_SHARING")}
                          disabled={isUpdatingTrackingAction}
                          title="Resume sharing my GPS location"
                        >
                          ▶️ Resume
                        </button>
                      )}
                      <button
                        type="button"
                        className="tracking-ctrl-btn danger"
                        onClick={() => handleTrackingAction("END_JOURNEY")}
                        disabled={isUpdatingTrackingAction}
                        title="Complete journey and stop tracking for all"
                      >
                        🏁 Complete Journey
                      </button>
                    </div>
                  </>
                )}

                {/* Journey Completed State */}
                {trackingSession?.journeyStatus === "COMPLETED" && (
                  <div style={{ textAlign: "center", padding: "8px", fontSize: "11.5px", color: "#475569", fontWeight: 600 }}>
                    🏁 Journey completed! Live GPS tracking has ended and coordinates are cleared.
                  </div>
                )}
              </div>

              {/* Arrival Notification Banners */}
              {trackingSession?.bothArrived && trackingSession?.journeyStatus !== "COMPLETED" && (
                <div className="arrival-alert-banner both">
                  <div className="arrival-banner-info">
                    <span>🎉</span>
                    <span>Both travel partners have arrived at {destination || "the destination"}!</span>
                  </div>
                  <button
                    type="button"
                    className="arrival-banner-btn"
                    onClick={() => handleTrackingAction("END_JOURNEY")}
                    disabled={isUpdatingTrackingAction}
                  >
                    🏁 Mark Completed
                  </button>
                </div>
              )}

              {trackingSession?.myArrived && !trackingSession?.bothArrived && trackingSession?.journeyStatus !== "COMPLETED" && (
                <div className="arrival-alert-banner">
                  <div className="arrival-banner-info">
                    <span>🎯</span>
                    <span>You have arrived! Awaiting {activeConversation?.partnerName}...</span>
                  </div>
                  <button
                    type="button"
                    className="arrival-banner-btn"
                    onClick={() => handleTrackingAction("END_JOURNEY")}
                  >
                    Finish Journey
                  </button>
                </div>
              )}

              {trackingSession?.partnerArrived && !trackingSession?.myArrived && trackingSession?.journeyStatus !== "COMPLETED" && (
                <div className="arrival-alert-banner">
                  <div className="arrival-banner-info">
                    <span>🎯</span>
                    <span>{activeConversation?.partnerName} has arrived at destination!</span>
                  </div>
                  <button
                    type="button"
                    className="arrival-banner-btn"
                    onClick={handleManualArrival}
                    disabled={isConfirmingArrival}
                  >
                    I&apos;ve Arrived Too ✓
                  </button>
                </div>
              )}

              {/* Meeting Point Banner */}
              <div className="chat-meeting-banner">
                <div className="meeting-banner-text">
                  <span>📍</span>
                  <span>
                    Meetup Spot:{" "}
                    <b>
                      {activeConversation.meetingLocation || "No agreed meeting spot yet"}
                    </b>
                  </span>
                </div>
                {activeConversation.meetingLocation && !activeConversation.meetingConfirmed && (
                  <button
                    type="button"
                    className="meeting-confirm-btn"
                    onClick={handleConfirmMeetingSpot}
                  >
                    Confirm Spot ✓
                  </button>
                )}
                {activeConversation.meetingConfirmed && (
                  <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#15803d" }}>
                    Confirmed ✓
                  </span>
                )}
              </div>

              {/* Quick Campus Meetup Spot Chips */}
              <div className="chat-quick-spots">
                {[
                  "TSC Front Gate",
                  "Shahbagh Metro Gate 2",
                  "Dhanmondi 27 Mina Bazar",
                  "Curzon Hall Front",
                  "Farmgate Footbridge",
                ].map((spot) => (
                  <button
                    key={spot}
                    type="button"
                    className="quick-spot-chip"
                    onClick={() => handleSendMessage(spot, "MEETING_LOCATION", spot)}
                    title={`Propose meeting at ${spot}`}
                  >
                    📍 {spot}
                  </button>
                ))}
              </div>

              {/* In-Chat Shared Fair-Share Fare Settlement */}
              <div className="chat-split-fare-bar">
                <div className="chat-split-fare-row">
                  <span style={{ fontSize: "11px", color: "#475569", fontWeight: 700 }}>
                    Est. Split: ~৳{fareEstimate.sharedFareBdt}/person (Save {fareEstimate.savingsPercent}%)
                  </span>
                  <button
                    type="button"
                    className="chat-split-fare-trigger"
                    onClick={() => {
                      if (!showSplitFareBar) {
                        setSplitFareAmount(String(fareEstimate.sharedFareBdt));
                      }
                      setShowSplitFareBar((prev) => !prev);
                    }}
                  >
                    <Wallet size={12} strokeWidth={2.2} />
                    <span>{showSplitFareBar ? "Hide split" : "Pay fair share"}</span>
                  </button>
                </div>

                {showSplitFareBar && (
                  <div className="chat-split-fare-form">
                    <input
                      type="number"
                      min={1}
                      max={2000}
                      className="chat-split-fare-input"
                      aria-label="Fair share amount in BDT tokens"
                      value={splitFareAmount}
                      onChange={(e) => setSplitFareAmount(e.target.value)}
                    />
                    <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>৳/tokens</span>
                    <button
                      type="button"
                      className="chat-split-pay-btn"
                      onClick={handleSettleSplitFare}
                      disabled={isPayingSplitFare}
                    >
                      {isPayingSplitFare ? "Paying..." : "Pay via Wallet"}
                    </button>
                    <button
                      type="button"
                      className="quick-spot-chip"
                      onClick={() => {
                        void handleSendMessage(
                          `💸 Proposed fare split: ৳${splitFareAmount || fareEstimate.sharedFareBdt} each for ${pickup.split(",")[0]} → ${destination.split(",")[0]}.`,
                          "TEXT"
                        );
                        setShowSplitFareBar(false);
                      }}
                    >
                      Propose
                    </button>
                  </div>
                )}
              </div>

              {/* Chat Thread Messages List */}
              <div className="chat-messages-container">
                {chatMessages.length === 0 && (
                  <div style={{ textAlign: "center", color: "#64748b", fontSize: "12px", padding: "20px 10px" }}>
                    Send a message to coordinate your meeting location and departure!
                  </div>
                )}
                {chatMessages.map((msg) => {
                  const isSelf = msg.isSelf || msg.senderId === currentUser.email;

                  if (msg.messageType === "STATUS_UPDATE") {
                    return (
                      <div key={msg.id} className="chat-bubble-row status">
                        <div className="chat-bubble status">{msg.text}</div>
                      </div>
                    );
                  }

                  if (msg.messageType === "MEETING_LOCATION") {
                    return (
                      <div key={msg.id} className={`chat-bubble-row ${isSelf ? "self" : "partner"}`}>
                        <div className="chat-meeting-card">
                          <div className="chat-meeting-header">
                            <span>📍 Proposing Meetup Location</span>
                          </div>
                          <div className="chat-meeting-spot-name">
                            {msg.locationName || msg.text}
                          </div>
                          <div style={{ fontSize: "10.5px", color: "#64748b" }}>
                            Proposed by {msg.senderName}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`chat-bubble-row ${isSelf ? "self" : "partner"}`}>
                      <div className={`chat-bubble ${isSelf ? "self" : "partner"}`}>
                        <div>{msg.text}</div>
                        <div className="chat-bubble-time">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar */}
              <form
                className="chat-input-bar"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
              >
                <input
                  type="text"
                  className="chat-input-field"
                  placeholder="Coordinate meetup spot & time..."
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  disabled={isSendingMessage}
                />
                <button
                  type="submit"
                  className="chat-send-btn"
                  disabled={isSendingMessage || !newMessageText.trim()}
                  title="Send message"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
            </div>
          )}

          {/* Watermark & Attributions (Google Maps mode only; CampusRouteMap renders its own OSM attribution) */}
          {isGoogleMapsReady && (
            <>
              <div className="map-watermark-google">Google</div>
              <div className="map-attribution-text">Map Data ©2026 UniShare Campus Transit Network</div>
            </>
          )}
        </main>
      </div>

      {/* =======================================================
          4. CONNECTION REQUESTS MODAL (Incoming & Outgoing)
          ======================================================= */}
      {showRequestsModal && (
        <div className="requests-modal-overlay" onClick={() => setShowRequestsModal(false)}>
          <div className="requests-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="requests-modal-header">
              <div className="requests-modal-title">
                <span>📬 Travel Partner Requests</span>
                <span className="results-count-badge">
                  {incomingRequests.filter((r) => r.status === "PENDING").length}
                </span>
              </div>
              <button
                type="button"
                className="requests-close-btn"
                onClick={() => setShowRequestsModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="requests-tabs-row">
              <button
                type="button"
                className={`requests-tab-btn ${requestsTab === "incoming" ? "active" : ""}`}
                onClick={() => setRequestsTab("incoming")}
              >
                Incoming ({incomingRequests.length})
              </button>
              <button
                type="button"
                className={`requests-tab-btn ${requestsTab === "outgoing" ? "active" : ""}`}
                onClick={() => setRequestsTab("outgoing")}
              >
                Sent ({outgoingRequests.length})
              </button>
              <button
                type="button"
                className={`requests-tab-btn ${requestsTab === "chats" ? "active" : ""}`}
                onClick={() => setRequestsTab("chats")}
              >
                Chats ({activeConversations.length})
              </button>
            </div>

            <div className="requests-list-body">
              {requestsTab === "chats" && (
                <>
                  {activeConversations.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#64748b", fontSize: "13px", padding: "30px 10px" }}>
                      No active ride chats yet. Connect with a partner to start coordinating.
                    </div>
                  ) : (
                    activeConversations.map((conv) => (
                      <div key={conv.id} className="request-item-card accepted">
                        <div className="request-item-top">
                          <div className="request-user-info">
                            <div className="request-user-avatar">{conv.partnerAvatarInitials}</div>
                            <div>
                              <div className="request-user-name">{conv.partnerName}</div>
                              <div style={{ fontSize: "11px", color: "#64748b" }}>
                                {conv.partnerBadge}
                                {conv.meetingLocation ? ` · Meet: ${conv.meetingLocation}` : ""}
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a" }}>ACTIVE</span>
                        </div>
                        {conv.lastMessage?.text && (
                          <div className="request-message-quote">&quot;{conv.lastMessage.text}&quot;</div>
                        )}
                        <div className="request-action-row">
                          <button
                            type="button"
                            className="request-chat-btn"
                            onClick={() => {
                              setShowRequestsModal(false);
                              openConversation(conv.id);
                            }}
                          >
                            💬 Reopen Ride Chat
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
              {requestsTab === "incoming" && (
                <>
                  {incomingRequests.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#64748b", fontSize: "13px", padding: "30px 10px" }}>
                      No incoming travel connection requests yet.
                    </div>
                  ) : (
                    incomingRequests.map((req) => (
                      <div
                        key={req.id}
                        className={`request-item-card ${req.status === "ACCEPTED" ? "accepted" : ""}`}
                      >
                        <div className="request-item-top">
                          <div className="request-user-info">
                            <div className="request-user-avatar">
                              {req.senderAvatarInitials}
                            </div>
                            <div>
                              <div className="request-user-name">
                                {req.senderName}
                              </div>
                              <div style={{ fontSize: "11px", color: "#64748b" }}>
                                {req.verificationBadge} · {req.senderDepartment}
                              </div>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: req.status === "ACCEPTED" ? "#16a34a" : "#ca8a04",
                            }}
                          >
                            {req.status}
                          </span>
                        </div>

                        {req.message && (
                          <div className="request-message-quote">
                            &quot;{req.message}&quot;
                          </div>
                        )}

                        <div className="request-action-row">
                          {req.status === "PENDING" ? (
                            <>
                              <button
                                type="button"
                                className="request-reject-btn"
                                onClick={() => handleRespondRequest(req.id, "REJECT")}
                              >
                                Decline
                              </button>
                              <button
                                type="button"
                                className="request-accept-btn"
                                onClick={() => handleRespondRequest(req.id, "ACCEPT")}
                              >
                                Accept ✓
                              </button>
                            </>
                          ) : req.status === "ACCEPTED" && req.conversationId ? (
                            <button
                              type="button"
                              className="request-chat-btn"
                              onClick={() => {
                                setShowRequestsModal(false);
                                if (req.conversationId) {
                                  openConversation(req.conversationId);
                                }
                              }}
                            >
                              💬 Open Private Chat
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {requestsTab === "outgoing" && (
                <>
                  {outgoingRequests.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#64748b", fontSize: "13px", padding: "30px 10px" }}>
                      You haven&apos;t sent any travel requests yet.
                    </div>
                  ) : (
                    outgoingRequests.map((req) => (
                      <div
                        key={req.id}
                        className={`request-item-card ${req.status === "ACCEPTED" ? "accepted" : ""}`}
                      >
                        <div className="request-item-top">
                          <div className="request-user-info">
                            <div className="request-user-avatar">
                              {req.receiverAvatarInitials}
                            </div>
                            <div>
                              <div className="request-user-name">
                                {req.receiverName}
                              </div>
                              <div style={{ fontSize: "11px", color: "#64748b" }}>
                                {req.verificationBadge}
                              </div>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: req.status === "ACCEPTED" ? "#16a34a" : "#0d6b63",
                            }}
                          >
                            {req.status}
                          </span>
                        </div>

                        <div className="request-action-row">
                          {req.status === "ACCEPTED" && req.conversationId ? (
                            <button
                              type="button"
                              className="request-chat-btn"
                              onClick={() => {
                                setShowRequestsModal(false);
                                if (req.conversationId) {
                                  openConversation(req.conversationId);
                                }
                              }}
                            >
                              💬 Coordinate in Private Chat
                            </button>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                              Awaiting peer confirmation
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          5. EXPLICIT LIVE GPS TRACKING CONSENT MODAL
          ======================================================= */}
      {showConsentModal && (
        <div className="consent-modal-overlay" onClick={() => setShowConsentModal(false)}>
          <div className="consent-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="consent-modal-header">
              <h3>🛡️ Explicit GPS Tracking Consent</h3>
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                style={{ background: "none", border: "none", color: "#ffffff", fontSize: "16px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div className="consent-modal-body">
              <p>
                You are about to start live GPS location sharing for your journey with{" "}
                <b>{activeConversation?.partnerName}</b> ({activeConversation?.partnerBadge}).
              </p>
              <ul className="consent-notice-list" style={{ listStyle: "none", padding: 0 }}>
                <li>
                  <span>🔒</span>
                  <span><b>Authorized Participants Only:</b> Your GPS coordinates will only be accessible by {activeConversation?.partnerName}.</span>
                </li>
                <li>
                  <span>⏱️</span>
                  <span><b>Strict Freshness &amp; Lifecycle:</b> Tracking stops immediately when you pause, revoke consent, or when either student ends the journey.</span>
                </li>
                <li>
                  <span>🌐</span>
                  <span><b>Browser Foreground Notice:</b> Standard mobile and desktop browsers pause web GPS execution when the tab is switched or minimized.</span>
                </li>
              </ul>
              <p style={{ fontSize: "11.5px", color: "#64748b" }}>
                By clicking &ldquo;I Agree &amp; Share GPS&rdquo;, you explicitly grant UniShare permission to access your browser Geolocation API and stream coordinates to your verified companion.
              </p>
            </div>
            <div className="consent-modal-actions">
              <button
                type="button"
                className="consent-btn-cancel"
                onClick={() => setShowConsentModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="consent-btn-confirm"
                onClick={() => handleToggleConsent(true)}
                disabled={isUpdatingConsent}
              >
                I Agree &amp; Share GPS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          6. HOW WAS YOUR RIDE? REVIEW & SAFETY REPORTING MODAL
          ======================================================= */}
      {showReviewModal && (
        <div className="review-modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="review-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="review-modal-header">
              <h3 className="review-header-title">How was your ride?</h3>
              <div className="review-header-sub">
                Rate your commute experience with {activeConversation?.partnerName || "your travel companion"}
              </div>
              <button
                type="button"
                className="review-modal-close-btn"
                onClick={() => setShowReviewModal(false)}
                title="Dismiss review"
              >
                ✕
              </button>
            </div>

            <div className="review-modal-body">
              {/* Partner Card */}
              <div className="review-partner-preview">
                <div className="review-partner-avatar">
                  {activeConversation?.partnerAvatarInitials || "ST"}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "14px", color: "var(--ink)" }}>
                    {activeConversation?.partnerName || "Verified Student"}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                    {activeConversation?.partnerBadge || "Verified Student"} · {activeConversation?.partnerDepartment || "Campus"}
                  </div>
                </div>
              </div>

              {/* Star Rating */}
              <div className="review-stars-container">
                <div className="review-stars-row">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = star <= (hoverRating || reviewRating);
                    return (
                      <button
                        key={star}
                        type="button"
                        className={`star-btn ${isFilled ? "filled" : ""}`}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setReviewRating(star)}
                        title={`Rate ${star} star${star > 1 ? "s" : ""}`}
                      >
                        ★
                      </button>
                    );
                  })}
                </div>
                <div className="review-rating-caption">
                  {reviewRating === 5 && "🌟 Excellent Commute!"}
                  {reviewRating === 4 && "👍 Good & Pleasant"}
                  {reviewRating === 3 && "👌 Fair / Average"}
                  {reviewRating === 2 && "⚠️ Could be better"}
                  {reviewRating === 1 && "❌ Poor experience"}
                </div>
              </div>

              {/* Written Feedback (Optional) */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "5px", color: "var(--ink)" }}>
                  Written Feedback (Optional)
                </label>
                <textarea
                  className="review-textarea-field"
                  placeholder="Share details about punctuality, friendliness, or coordination..."
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  maxLength={1000}
                />
              </div>

              {/* Inappropriate Behavior / Safety Reporting */}
              <div>
                <label className="review-report-toggle-row">
                  <input
                    type="checkbox"
                    checked={reviewReported}
                    onChange={(e) => setReviewReported(e.target.checked)}
                  />
                  <span>⚠️ Report Inappropriate Behavior or Safety Issue</span>
                </label>

                {reviewReported && (
                  <div className="review-report-box">
                    <div>
                      <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, marginBottom: "4px", color: "#991b1b" }}>
                        Safety Issue Category:
                      </label>
                      <select
                        className="review-report-select"
                        value={reviewCategory}
                        onChange={(e) => setReviewCategory(e.target.value)}
                      >
                        <option value="INAPPROPRIATE_BEHAVIOR">Inappropriate conduct or language</option>
                        <option value="HARASSMENT">Harassment or disrespectful behavior</option>
                        <option value="SAFETY_CONCERN">Safety violation or reckless behavior</option>
                        <option value="NO_SHOW">No-show or abandoned meeting spot</option>
                        <option value="OTHER">Other concern</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, marginBottom: "4px", color: "#991b1b" }}>
                        Confidential Details for Campus Safety:
                      </label>
                      <textarea
                        className="review-report-textarea"
                        placeholder="Please describe what occurred. This report is treated with strict confidentiality."
                        value={reviewDetails}
                        onChange={(e) => setReviewDetails(e.target.value)}
                        maxLength={2000}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="review-modal-actions">
              <button
                type="button"
                className="review-btn-skip"
                onClick={() => setShowReviewModal(false)}
              >
                Maybe Later
              </button>
              <button
                type="button"
                className="review-btn-submit"
                onClick={handleSubmitReview}
                disabled={isSubmittingReview}
              >
                {isSubmittingReview ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="rides-toast-container" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
