"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import AppNavbar from "../components/AppNavbar";
import { useCurrentUser } from "../lib/user-client";
import CampusRouteMap, { MapPeerItem, resolvePeerPoint } from "./CampusRouteMap";
import {
  computeFitViewport,
  DHAKA_CAMPUS_LANDMARKS as DHAKA_CANVAS_LANDMARKS,
  estimateSharedCommute,
  findNearestLandmark,
  LatLngPoint,
  QUICK_CAMPUS_DESTINATIONS,
  resolveLandmarkByName,
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

export default function RideSharingPage() {
  // -----------------------------------------------------------
  // 1. User & State
  // -----------------------------------------------------------
  const { resolvedUser: currentUser } = useCurrentUser();

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

  // Gender Preference
  const [genderPreference, setGenderPreference] = useState<"no_preference" | "women_only" | "men_only">("no_preference");

  // Map Picking Mode: "none" | "pickup" | "destination"
  const [mapPickMode, setMapPickMode] = useState<"none" | "pickup" | "destination">("none");
  const mapPickModeRef = useRef<"none" | "pickup" | "destination">("none");
  useEffect(() => {
    mapPickModeRef.current = mapPickMode;
  }, [mapPickMode]);

  // Live GPS Tracking
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  // Autocomplete UI
  const [showPickupAutocomplete, setShowPickupAutocomplete] = useState(false);
  const [showDestAutocomplete, setShowDestAutocomplete] = useState(false);
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  // Search Submission & Live Matching State
  const [isSearching, setIsSearching] = useState(false);
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<MatchedPartner[]>([]);
  const [activeCampusRiders, setActiveCampusRiders] = useState<MatchedPartner[]>([]);
  const [isLoadingActiveRiders, setIsLoadingActiveRiders] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
  const [connectedPartnerIds, setConnectedPartnerIds] = useState<string[]>([]);
  const [isRegisteringRoute, setIsRegisteringRoute] = useState(false);
  const [routeRegisteredSuccess, setRouteRegisteredSuccess] = useState(false);
  const [isSendingGroupInvite, setIsSendingGroupInvite] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // References for Real-Time SSE Stream & Custom Map Markers
  const eventSourceRef = useRef<EventSource | null>(null);
  const partnerMarkersRef = useRef<GoogleMarkerInstance[]>([]);
  const infoWindowRef = useRef<GoogleInfoWindowInstance | null>(null);

  // Connection Requests & Private Coordination Chat State
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [requestsTab, setRequestsTab] = useState<"incoming" | "outgoing">("incoming");
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Consent-Based Live GPS Tracking State
  const [trackingSession, setTrackingSession] = useState<{
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
  const [partnerDistanceMeters, setPartnerDistanceMeters] = useState<number | null>(null);
  const [myLiveCoords, setMyLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
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
  const [hasReviewed, setHasReviewed] = useState(false);

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

  const fareEstimate = useMemo(
    () => estimateSharedCommute(pickupCoords, destCoords, 1 + Math.max(1, selectedPartnerIds.length)),
    [pickupCoords, destCoords, selectedPartnerIds.length]
  );

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

  // Toast feedback helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  }, []);

  // Reverse Geocode Helper
  const reverseGeocode = useCallback(
    (coords: { lat: number; lng: number }, isPickup: boolean) => {
      if (!geocoderRef.current) {
        // Canvas fallback
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

  // Load active campus riders right away so map shows who is live & open to route sharing
  const fetchActiveCampusRiders = useCallback(async () => {
    setIsLoadingActiveRiders(true);
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

      const res = await fetch(`/api/rides?${queryParams.toString()}`);
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && Array.isArray(data.partners)) {
        setActiveCampusRiders(data.partners);
      }
    } catch {
      // Quietly handle transient network interruption on background map discovery
    } finally {
      setIsLoadingActiveRiders(false);
    }
  }, [destination, pickup, genderPreference, destCoords, pickupCoords]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchActiveCampusRiders();
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchActiveCampusRiders]);

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

    try {
      const queryParams = new URLSearchParams({
        destination: destination.trim(),
        origin: pickup.trim(),
        genderPreference: activePref,
        destLat: String(destCoords.lat),
        destLng: String(destCoords.lng),
        originLat: String(pickupCoords.lat),
        originLng: String(pickupCoords.lng),
      });

      const res = await fetch(`/api/rides?${queryParams.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSearchError(data.error || "Failed to search for travel companions. Please try again.");
        setSearchResults([]);
        showToast(`⚠️ ${data.error || "Search error"}`);
      } else {
        const partners = Array.isArray(data.partners) ? data.partners : [];
        setSearchResults(partners);
        if (partners.length > 0) {
          showToast(`🎯 Found ${partners.length} verified travel companion(s)!`);
        } else {
          showToast("ℹ️ No active travel partners found for this corridor yet.");
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
    setIsRegisteringRoute(true);
    try {
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: pickup.trim(),
          destination: destination.trim(),
          originLat: pickupCoords.lat,
          originLng: pickupCoords.lng,
          destinationLat: destCoords.lat,
          destinationLng: destCoords.lng,
          genderPreference,
          notes: `Heading from ${pickup.split(",")[0]} towards ${destination.split(",")[0]}. Looking for peer companion.`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(`⚠️ ${data.error || "Could not register journey"}`);
      } else {
        setRouteRegisteredSuccess(true);
        fetchActiveCampusRiders();
        showToast("🟢 Your route has been registered and indexed for student matching!");
      }
    } catch (err) {
      console.error("Register route error:", err);
      showToast("⚠️ Network error while registering journey.");
    } finally {
      setIsRegisteringRoute(false);
    }
  };

  // Multi-Partner Selection Handlers
  const togglePartnerSelection = (partnerId: string) => {
    setSelectedPartnerIds((prev) =>
      prev.includes(partnerId)
        ? prev.filter((id) => id !== partnerId)
        : [...prev, partnerId]
    );
  };

  const handleSelectAllPartners = () => {
    if (selectedPartnerIds.length === searchResults.length) {
      setSelectedPartnerIds([]);
    } else {
      setSelectedPartnerIds(searchResults.map((p) => p.id));
    }
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
        headers: { "Content-Type": "application/json" },
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
    if (connectedPartnerIds.includes(partner.id)) {
      showToast(`✓ Invitation already sent to ${partner.fullName}. Check Requests to message.`);
      return;
    }

    try {
      const res = await fetch("/api/rides/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      setRealtimeConnected(true);
      setLastSyncedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    });

    es.addEventListener("matches", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data.partners)) {
          setSearchResults(data.partners);
          setLastSyncedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    });

    es.onerror = () => {
      setRealtimeConnected(false);
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
      const res = await fetch("/api/rides/match");
      const data = await res.json();
      if (data.success) {
        setIncomingRequests(data.incoming || []);
        setOutgoingRequests(data.outgoing || []);
      }
    } catch (err) {
      console.error("Failed to fetch connection requests:", err);
    }
  }, []);

  useEffect(() => {
    fetchConnectionRequests();
    const interval = setInterval(fetchConnectionRequests, 8000);
    return () => clearInterval(interval);
  }, [fetchConnectionRequests]);

  const handleRespondRequest = async (id: string, action: "ACCEPT" | "REJECT") => {
    try {
      const res = await fetch(`/api/rides/match/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
        const storageKey = `unishare_${currentUser.email || "demo"}_unishare_notifications`;
        const existing = localStorage.getItem(storageKey);
        let list: any[] = [];
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
    [currentUser.email]
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
            updateLiveTrackingMarkersOnMap(
              trackingSession?.partnerLocation ? { lat: trackingSession.partnerLocation.lat, lng: trackingSession.partnerLocation.lng } : null,
              trackingSession?.partner?.fullName || "Travel Partner",
              coords
            );
          }

          fetch(`/api/rides/conversations/${conversationId}/tracking/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
    [destCoords.lat, destCoords.lng, destination, proximityRadius, recordNotification, showToast, trackingSession, updateLiveTrackingMarkersOnMap]
  );

  // Fetch current tracking state & arrival detection
  const fetchTrackingState = useCallback(
    async (conversationId: string) => {
      try {
        const res = await fetch(`/api/rides/conversations/${conversationId}/tracking`);
        const data = await res.json();
        if (data.success && data.tracking) {
          const prev = trackingSession;
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
            const refCoords = myLiveCoords || pickupCoords;
            const dist = computeDistanceBetweenKm(refCoords.lat, refCoords.lng, pLoc.lat, pLoc.lng);
            setPartnerDistanceMeters(Math.round(dist * 1000));

            updateLiveTrackingMarkersOnMap(
              { lat: pLoc.lat, lng: pLoc.lng },
              data.tracking.partner?.fullName || "Travel Partner",
              myLiveCoords
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
    [destination, myLiveCoords, pickupCoords, recordNotification, showToast, stopBrowserGeolocation, trackingSession, updateLiveTrackingMarkersOnMap]
  );

  // Manual arrival confirmation handler
  const handleManualArrival = async () => {
    if (!activeConversationId) return;
    setIsConfirmingArrival(true);
    try {
      const res = await fetch(`/api/rides/conversations/${activeConversationId}/arrival`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        const msgRes = await fetch(`/api/rides/conversations/${activeConversationId}/messages`);
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
        headers: { "Content-Type": "application/json" },
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
        const msgRes = await fetch(`/api/rides/conversations/${activeConversationId}/messages`);
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
        headers: { "Content-Type": "application/json" },
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
        const msgRes = await fetch(`/api/rides/conversations/${activeConversationId}/messages`);
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
        headers: { "Content-Type": "application/json" },
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
        setHasReviewed(true);
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
    try {
      const res = await fetch(`/api/rides/conversations/${conversationId}`);
      const data = await res.json();
      if (data.success && data.conversation) {
        setActiveConversation(data.conversation);
        setChatMessages(data.conversation.messages || []);
      }
      fetchTrackingState(conversationId);

      // Check review status
      fetch(`/api/rides/conversations/${conversationId}/review`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setHasReviewed(d.hasReviewed);
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
        headers: { "Content-Type": "application/json" },
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
          setActiveConversation((prev: any) => ({
            ...prev,
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingLocation: activeConversation.meetingLocation,
          meetingConfirmed: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveConversation((prev: any) => ({ ...prev, meetingConfirmed: true }));
        showToast("🤝 Meeting location confirmed with travel partner!");
        const msgRes = await fetch(`/api/rides/conversations/${activeConversationId}/messages`);
        const msgData = await msgRes.json();
        if (msgData.success && Array.isArray(msgData.messages)) {
          setChatMessages(msgData.messages);
        }
      }
    } catch (err) {
      console.error("Confirm meeting spot error:", err);
    }
  };

  // Poll conversation messages every 2.5 seconds while chat drawer is open
  useEffect(() => {
    if (!activeConversationId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rides/conversations/${activeConversationId}/messages`);
        const data = await res.json();
        if (data.success && Array.isArray(data.messages)) {
          setChatMessages(data.messages);
        }
      } catch {
        // ignore polling errors
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [activeConversationId]);

  // Periodic tracking refresh and live cleanup
  useEffect(() => {
    if (!activeConversationId) {
      stopBrowserGeolocation();
      setTrackingSession(null);
      setPartnerDistanceMeters(null);
      return;
    }

    fetchTrackingState(activeConversationId);
    const trackingInterval = setInterval(() => {
      fetchTrackingState(activeConversationId);
    }, 3000);

    return () => {
      clearInterval(trackingInterval);
      stopBrowserGeolocation();
    };
  }, [activeConversationId, fetchTrackingState, stopBrowserGeolocation]);

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
                    if (val.trim().length >= 5) {
                      const matched = resolveLandmarkByName(val);
                      if (matched) {
                        const nextPt = { lat: matched.lat, lng: matched.lng };
                        setPickupCoords(nextPt);
                        focusRouteOnMap(nextPt, destCoords);
                      }
                    }
                  }}
                  onFocus={() => setShowPickupAutocomplete(true)}
                  onBlur={() => setTimeout(() => setShowPickupAutocomplete(false), 150)}
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
              </div>

              {showPickupAutocomplete && !isGoogleMapsReady && (
                <div className="autocomplete-dropdown" role="listbox" aria-label="Pickup location suggestions">
                  <div className="autocomplete-dropdown-header">Campus & Dhaka Pickup Hubs</div>
                  {DHAKA_CANVAS_LANDMARKS.filter(
                    (lm) =>
                      !pickup.trim() ||
                      lm.name.toLowerCase().includes(pickup.trim().toLowerCase()) ||
                      lm.label.toLowerCase().includes(pickup.trim().toLowerCase())
                  )
                    .slice(0, 6)
                    .map((lm) => (
                      <div
                        key={`pickup-${lm.id}`}
                        className="autocomplete-item"
                        role="option"
                        aria-selected={pickup === lm.name}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const nextPt = { lat: lm.lat, lng: lm.lng };
                          setPickup(lm.name);
                          setPickupCoords(nextPt);
                          setShowPickupAutocomplete(false);
                          focusRouteOnMap(nextPt, destCoords);
                          showToast(`📍 Pickup set: ${lm.label}`);
                        }}
                      >
                        <span className="item-icon">📍</span>
                        <span>{lm.name}</span>
                      </div>
                    ))}
                </div>
              )}

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
            <div className={`location-input-group ${mapPickMode === "destination" ? "active-picking" : ""}`}>
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
                    if (val.trim().length >= 4) {
                      const matched = resolveLandmarkByName(val);
                      if (matched) {
                        const nextPt = { lat: matched.lat, lng: matched.lng };
                        setDestCoords(nextPt);
                        focusRouteOnMap(pickupCoords, nextPt);
                      }
                    }
                  }}
                  onFocus={() => setShowDestAutocomplete(true)}
                  onBlur={() => setTimeout(() => setShowDestAutocomplete(false), 150)}
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
              </div>

              {showDestAutocomplete && !isGoogleMapsReady && (
                <div className="autocomplete-dropdown" role="listbox" aria-label="Destination suggestions">
                  <div className="autocomplete-dropdown-header">Campus & Commute Corridors</div>
                  {DHAKA_CANVAS_LANDMARKS.filter(
                    (lm) =>
                      !destination.trim() ||
                      lm.name.toLowerCase().includes(destination.trim().toLowerCase()) ||
                      lm.label.toLowerCase().includes(destination.trim().toLowerCase())
                  )
                    .slice(0, 6)
                    .map((lm) => (
                      <div
                        key={`dest-${lm.id}`}
                        className="autocomplete-item"
                        role="option"
                        aria-selected={destination === lm.name}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const nextPt = { lat: lm.lat, lng: lm.lng };
                          setDestination(lm.name);
                          setDestCoords(nextPt);
                          setShowDestAutocomplete(false);
                          focusRouteOnMap(pickupCoords, nextPt);
                          showToast(`🎯 Destination set: ${lm.label}`);
                        }}
                      >
                        <span className="item-icon">🎯</span>
                        <span>{lm.name}</span>
                      </div>
                    ))}
                </div>
              )}

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
                4. FIND TRAVEL PARTNERS ACTION BUTTON
                ------------------------------------------------- */}
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
                    {activeCampusRiders.slice(0, 4).map((peer) => {
                      const peerOrigin = resolvePeerPoint(peer.originCoords, peer.origin, pickupCoords, 1);
                      const peerDest = resolvePeerPoint(peer.destCoords, peer.destination, destCoords, 2);
                      const est = estimateSharedCommute(peerOrigin, peerDest, 2);
                      const isConnected = connectedPartnerIds.includes(peer.id);

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
                  Switch to "No Preference" & Retry
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
                      Search with "No Preference" (All Verified Students)
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
                    const isConnected = connectedPartnerIds.includes(partner.id);
                    const isSelected = selectedPartnerIds.includes(partner.id);
                    const peerOrigin = resolvePeerPoint(partner.originCoords, partner.origin, pickupCoords, 1);
                    const peerDest = resolvePeerPoint(partner.destCoords, partner.destination, destCoords, 2);
                    const partnerFare = estimateSharedCommute(peerOrigin, peerDest, 2);
                    const initials = partner.avatarInitials || partner.fullName
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <div
                        key={partner.id}
                        className={`partner-card ${isSelected ? "selected" : ""}`}
                        onClick={() => togglePartnerSelection(partner.id)}
                      >
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
                                <span className="partner-verified-badge">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  Verified
                                </span>
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
                          <div className="partner-notes-bubble">"{partner.notes}"</div>
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
              connectedPartnerIds={connectedPartnerIds}
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
                } else {
                  setDestination(resolvedLabel);
                  setDestCoords(coord);
                  focusRouteOnMap(pickupCoords, coord);
                  showToast(`🎯 Destination pinned: ${resolvedLabel.split("(")[0].trim()}`);
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
                Incoming Requests ({incomingRequests.length})
              </button>
              <button
                type="button"
                className={`requests-tab-btn ${requestsTab === "outgoing" ? "active" : ""}`}
                onClick={() => setRequestsTab("outgoing")}
              >
                Sent by Me ({outgoingRequests.length})
              </button>
            </div>

            <div className="requests-list-body">
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
                            "{req.message}"
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
                                openConversation(req.conversationId);
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
                      You haven't sent any travel requests yet.
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
                                openConversation(req.conversationId);
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
