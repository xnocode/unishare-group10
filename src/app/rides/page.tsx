"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNavbar from "../components/AppNavbar";
import { useCurrentUser } from "../lib/user-client";
import "./rides.css";

// -------------------------------------------------------------
// Comprehensive Bangladesh Locations for Google Maps Search
// -------------------------------------------------------------

const BANGLADESH_LOCATIONS = [
  // Dhaka Major Areas & Campus Hubs
  "TSC, University of Dhaka",
  "Curzon Hall, University of Dhaka",
  "Science Library, Dhaka University",
  "Dhanmondi 27, Dhaka",
  "Dhanmondi 32, Dhaka",
  "Dhanmondi 15, Dhaka",
  "Gulshan 1, Dhaka",
  "Gulshan 2, Dhaka",
  "Banani 11, Dhaka",
  "Uttara Sector 3, Dhaka",
  "Uttara Sector 7, Dhaka",
  "Mirpur 1, Dhaka",
  "Mirpur 10, Dhaka",
  "Mirpur 2, Dhaka",
  "Mohammadpur Town Hall, Dhaka",
  "Farmgate, Dhaka",
  "Shahbagh, Dhaka",
  "Motijheel C/A, Dhaka",
  "Mohakhali DOHS, Dhaka",
  "Tejgaon Industrial Area, Dhaka",
  "Badda / Merul Badda, Dhaka",
  "Rampura Bridge, Dhaka",
  "Banasree Block C, Dhaka",
  "Bashundhara R/A, Dhaka",
  "Science Lab, Dhaka",
  "Lalmatia, Dhaka",
  "Old Dhaka / Sadarghat",
  "Panthapath, Dhaka",
  "Khilgaon, Dhaka",
  "Malibagh, Dhaka",
  "Savar / Jahangirnagar University",
  "Gazipur Chowrasta",
  "Narayanganj City",
  // Major Divisions & Cities of Bangladesh
  "Chittagong GEC Circle",
  "Chittagong Agrabad C/A",
  "Sylhet Zindabazar",
  "Sylhet Amberkhana",
  "Cox's Bazar Sea Beach",
  "Rajshahi Zero Point",
  "Khulna Shibbari",
  "Mymensingh Town Hall",
  "Comilla Kandirpar",
  "Barisal Sadar Road",
  "Bogura Satmatha",
];

interface CampusRide {
  id: string;
  vehicle: "Car" | "Rickshaw";
  vehicleModel: string;
  departureTime: string;
  seatsLeft: number;
  origin: string;
  destination: string;
  preference: string;
  gender: "female" | "male" | "any";
  hostName: string;
  hostInitials: string;
  hostUniversity: string;
  hostDept: string;
  hostVerified: boolean;
  hostRating: number;
  totalRides: number;
}

const INITIAL_CAMPUS_RIDES: CampusRide[] = [
  {
    id: "ride-1",
    vehicle: "Car",
    vehicleModel: "Toyota Corolla (White) · Dhaka Metro Ga 21-4820",
    departureTime: "Thu, 15 Oct · 8:30 AM",
    seatsLeft: 2,
    origin: "Dhanmondi 27",
    destination: "TSC, DU",
    preference: "No gender preference · Same university only",
    gender: "any",
    hostName: "Arif Hossain",
    hostInitials: "AH",
    hostUniversity: "University of Dhaka",
    hostDept: "Faculty of Business Studies",
    hostVerified: true,
    hostRating: 4.9,
    totalRides: 28,
  },
  {
    id: "ride-2",
    vehicle: "Car",
    vehicleModel: "Honda Civic (Silver) · Dhaka Metro Kha 14-8930",
    departureTime: "Thu, 15 Oct · 9:00 AM",
    seatsLeft: 1,
    origin: "Dhanmondi 32",
    destination: "Curzon Hall, DU",
    preference: "Women only · Same university only",
    gender: "female",
    hostName: "Nusrat Jahan",
    hostInitials: "NJ",
    hostUniversity: "University of Dhaka",
    hostDept: "Dept of English Literature",
    hostVerified: true,
    hostRating: 5.0,
    totalRides: 34,
  },
  {
    id: "ride-3",
    vehicle: "Rickshaw",
    vehicleModel: "Campus Eco Rickshaw #14 · Verified DU Green fleet",
    departureTime: "Thu, 15 Oct · 9:15 AM",
    seatsLeft: 1,
    origin: "Dhanmondi 15",
    destination: "TSC, DU",
    preference: "Women only · Same university only",
    gender: "female",
    hostName: "Sadia Islam",
    hostInitials: "SI",
    hostUniversity: "University of Dhaka",
    hostDept: "Dept of Economics",
    hostVerified: true,
    hostRating: 4.8,
    totalRides: 22,
  },
  {
    id: "ride-4",
    vehicle: "Car",
    vehicleModel: "Nissan Sunny · Dhaka Metro Ga 18-3321",
    departureTime: "Thu, 15 Oct · 9:30 AM",
    seatsLeft: 3,
    origin: "Farmgate",
    destination: "TSC, DU",
    preference: "No gender preference · Same university only",
    gender: "any",
    hostName: "Tanvir Ahmed",
    hostInitials: "TA",
    hostUniversity: "University of Dhaka",
    hostDept: "Dept of Marketing",
    hostVerified: true,
    hostRating: 4.9,
    totalRides: 19,
  },
  {
    id: "ride-5",
    vehicle: "Rickshaw",
    vehicleModel: "Campus Shared Rickshaw #22",
    departureTime: "Thu, 15 Oct · 9:45 AM",
    seatsLeft: 1,
    origin: "Mirpur 10",
    destination: "Curzon Hall, DU",
    preference: "No gender preference · Same university only",
    gender: "any",
    hostName: "Rafiqul Hasan",
    hostInitials: "RH",
    hostUniversity: "University of Dhaka",
    hostDept: "Faculty of Law",
    hostVerified: true,
    hostRating: 4.7,
    totalRides: 15,
  },
];

const QUICK_CAMPUS_DESTINATIONS = [
  { name: "TSC, DU", fullName: "TSC, University of Dhaka" },
  { name: "Curzon Hall", fullName: "Curzon Hall, University of Dhaka" },
  { name: "Dhanmondi 32", fullName: "Dhanmondi 32, Dhaka" },
  { name: "Farmgate", fullName: "Farmgate, Tejgaon, Dhaka" },
  { name: "Mirpur 10", fullName: "Mirpur 10 Circle, Dhaka" },
];

export default function RidesPage() {
  const router = useRouter();
  const { resolvedUser: currentUser } = useCurrentUser();

  // Tab State
  const [activeTab, setActiveTab] = useState<"find" | "requests" | "created">("find");

  // Search Fields
  const [leavingFrom, setLeavingFrom] = useState("Dhanmondi, Dhaka");
  const [goingTo, setGoingTo] = useState("TSC, University of Dhaka");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Bangladesh Google Maps Search Dropdown
  const [showGoingToDropdown, setShowGoingToDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  // Search Row Controls
  const [genderFilter, setGenderFilter] = useState<"any" | "women_only" | "men_only" | "no_preference">("any");
  const [vehicleFilter, setVehicleFilter] = useState<"all" | "Car" | "Rickshaw">("all");

  // Pathao-style Find Ride Animation State
  const [isPathaoSearching, setIsPathaoSearching] = useState(false);

  // Search Results (Find a ride) & My Requests (Separate list)
  const [searchResults, setSearchResults] = useState<CampusRide[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [myRequests, setMyRequests] = useState<CampusRide[]>([]);
  const [selectedRideForDetails, setSelectedRideForDetails] = useState<CampusRide | null>(null);
  const [activeRideInProgress, setActiveRideInProgress] = useState<CampusRide | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rideBeingRated, setRideBeingRated] = useState<CampusRide | null>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [hoverRatingScore, setHoverRatingScore] = useState(0);
  const [selectedFeedbackTags, setSelectedFeedbackTags] = useState<string[]>([
    "🎯 Punctual & On Time",
    "🛡️ Felt Very Safe",
  ]);
  const [feedbackComment, setFeedbackComment] = useState("");

  // Live Direct Messaging with Campus Companion
  const [chatPeer, setChatPeer] = useState<CampusRide | null>(null);
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: "user" | "peer"; text: string; time: string }[]>([]);
  const [chatInputText, setChatInputText] = useState("");

  // Toast
  const [toastText, setToastText] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastText(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2400);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowGoingToDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered Bangladesh places based on input
  const placeSuggestions = useMemo(() => {
    if (!goingTo.trim()) return BANGLADESH_LOCATIONS.slice(0, 8);
    const q = goingTo.toLowerCase().trim();
    return BANGLADESH_LOCATIONS.filter((place) => place.toLowerCase().includes(q)).slice(0, 8);
  }, [goingTo]);

  // Auto-Location System (HTML5 Geolocation)
  const handleAutoDetectLocation = () => {
    setIsDetectingLocation(true);
    showToast("Accessing GPS to detect your location...");

    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsDetectingLocation(false);
          const { latitude, longitude } = position.coords;
          let detected = "Dhanmondi, Dhaka";
          if (latitude > 23.79) {
            detected = "Mirpur, Dhaka";
          } else if (latitude > 23.76) {
            detected = "Mohammadpur, Dhaka";
          }
          setLeavingFrom(detected);
          showToast(`Location set: ${detected}`);
        },
        () => {
          setIsDetectingLocation(false);
          setLeavingFrom("Dhanmondi, Dhaka");
          showToast("Auto-located: Dhanmondi, Dhaka");
        },
        { timeout: 6000, enableHighAccuracy: true }
      );
    } else {
      setIsDetectingLocation(false);
      setLeavingFrom("Dhanmondi, Dhaka");
      showToast("Auto-located: Dhanmondi, Dhaka");
    }
  };

  // Dynamic Map Pin & Route Coordinates for Dhaka Google Maps Canvas
  const getMapCoordinates = (locationStr: string, isOrigin = false) => {
    const loc = (locationStr || "").toLowerCase();
    if (loc.includes("curzon")) {
      return { x: 580, y: 350, left: "58%", top: "83%" };
    }
    if (loc.includes("tsc") || loc.includes("dhaka university")) {
      return { x: 470, y: 330, left: "47%", top: "79%" };
    }
    if (loc.includes("mirpur")) {
      return { x: 260, y: 110, left: "26%", top: "26%" };
    }
    if (loc.includes("farmgate") || loc.includes("tejgaon")) {
      return { x: 460, y: 190, left: "46%", top: "45%" };
    }
    if (loc.includes("hatirjheel") || loc.includes("badda") || loc.includes("rampura")) {
      return { x: 650, y: 170, left: "65%", top: "40%" };
    }
    if (loc.includes("uttara")) {
      return { x: 440, y: 60, left: "44%", top: "14%" };
    }
    // Default Dhanmondi / Mohammadpur
    return isOrigin
      ? { x: 310, y: 220, left: "31%", top: "52%" }
      : { x: 320, y: 240, left: "32%", top: "57%" };
  };

  const originCoords = useMemo(() => getMapCoordinates(leavingFrom, true), [leavingFrom]);
  const destCoords = useMemo(() => getMapCoordinates(goingTo, false), [goingTo]);
  const routeCurvePath = useMemo(() => {
    const midX = (originCoords.x + destCoords.x) / 2 + 15;
    const midY = (originCoords.y + destCoords.y) / 2 - 15;
    return `M${originCoords.x},${originCoords.y} Q${midX},${midY} ${destCoords.x},${destCoords.y}`;
  }, [originCoords, destCoords]);

  // Click on Google Map to select 'Going to'
  const handleMapCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    let picked = "TSC, University of Dhaka";
    if (x < 0.36 && y > 0.42) {
      picked = "Dhanmondi 32, Dhaka";
    } else if (x > 0.55 && y < 0.48) {
      picked = "Hatirjheel / Merul Badda, Dhaka";
    } else if (y < 0.35) {
      picked = "Farmgate / Tejgaon, Dhaka";
    } else if (x > 0.52 && y > 0.65) {
      picked = "Curzon Hall, University of Dhaka";
    } else {
      picked = "TSC, University of Dhaka";
    }
    setGoingTo(picked);
    showToast(`Destination set: ${picked}`);
  };

  // Trigger Find Ride Animation & Switch to My Requests Tab
  const handleTriggerSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!leavingFrom.trim() || !goingTo.trim()) {
      showToast("Please enter both pickup and destination locations.");
      return;
    }

    // 1. Open searching animation overlay
    setIsPathaoSearching(true);

    const originShort = leavingFrom.split(",")[0].trim() || "Dhanmondi";
    const destShort = goingTo.split(",")[0].trim() || "TSC, DU";

    setTimeout(() => {
      // 2. Close searching animation completely
      setIsPathaoSearching(false);

      // Filter rides based on user preferences
      let filtered = INITIAL_CAMPUS_RIDES.filter((ride) => {
        if (genderFilter === "women_only" && ride.gender !== "female") return false;
        if (genderFilter === "men_only" && ride.gender === "female") return false;
        if (vehicleFilter !== "all" && ride.vehicle !== vehicleFilter) return false;
        return true;
      });

      if (filtered.length > 0) {
        filtered = filtered.map((r, idx) => ({
          ...r,
          origin: idx === 0 ? originShort : r.origin,
          destination: idx === 0 ? destShort : r.destination,
        }));
      }

      const matchedRides = filtered.slice(0, 4);
      setSearchResults(matchedRides);
      setHasSearched(true);
      showToast(`Found ${matchedRides.length} available campus rides below!`);

      // Gentle smooth scroll to search results transition
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    }, 1800);
  };

  // Send Ride Request (Adds to My Requests)
  const handleSendRequest = (ride: CampusRide) => {
    if (myRequests.some((r) => r.id === ride.id)) {
      showToast(`Request already sent to ${ride.hostName}. Check "My requests" tab.`);
      return;
    }
    setMyRequests((prev) => [ride, ...prev]);
    showToast(`Ride request sent to ${ride.hostName}! Check "My requests" to chat and connect.`);
  };

  // Cancel Request
  const handleCancelRequest = (rideId: string) => {
    setMyRequests((prev) => prev.filter((r) => r.id !== rideId));
    showToast("Ride request cancelled.");
  };

  // Open Companion Direct Chat
  const handleOpenChat = (ride: CampusRide) => {
    setChatPeer(ride);
    setChatMessages([
      {
        id: "msg-1",
        sender: "peer",
        text: `Hey! I'm leaving from ${ride.origin} soon. Are you ready to share the ride to ${ride.destination}?`,
        time: "Just now",
      },
    ]);
    setChatInputText("");
  };

  // Send Direct Message to Companion
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInputText.trim() || !chatPeer) return;
    const userMsg = {
      id: `msg-${Date.now()}`,
      sender: "user" as const,
      text: chatInputText.trim(),
      time: "Just now",
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInputText("");

    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          sender: "peer",
          text: `Great! See you at the pickup point in 5 minutes 👍`,
          time: "Just now",
        },
      ]);
    }, 1200);
  };

  // Cancel Search
  const handleCancelSearch = () => {
    setIsPathaoSearching(false);
    showToast("Ride search cancelled.");
  };

  // View Ride Details Modal
  const handleViewDetails = (ride: CampusRide) => {
    setSelectedRideForDetails(ride);
  };

  // Start Ride
  const handleStartRide = (ride: CampusRide) => {
    setSelectedRideForDetails(null);
    setActiveRideInProgress(ride);
    showToast(`Ride in progress with ${ride.hostName}! Direct connection active.`);
  };

  // Finish Ride & Open Rating Modal
  const handleFinishRide = () => {
    if (activeRideInProgress) {
      setRideBeingRated(activeRideInProgress);
      setActiveRideInProgress(null);
      setShowRatingModal(true);
      setRatingScore(5);
      setSelectedFeedbackTags(["🎯 Punctual & On Time", "🛡️ Felt Very Safe"]);
      setFeedbackComment("");
    }
  };

  // Submit Rating
  const handleSubmitRating = () => {
    if (rideBeingRated) {
      showToast(`Thank you! Your ${ratingScore}-star rating for ${rideBeingRated.hostName} was submitted.`);
    }
    setShowRatingModal(false);
    setRideBeingRated(null);
  };

  // Toggle Feedback Tag
  const toggleFeedbackTag = (tag: string) => {
    setSelectedFeedbackTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="unishare-rides-page">
      <AppNavbar
        activeNav="rides"
        user={currentUser}
        onSos={() =>
          showToast(
            "Emergency SOS: Dhaka University Proctorial Team contacted."
          )
        }
      />

      {/* Main Container */}
      <main className="wrap">
        <div className="crumb">Home / Rides</div>

        {/* Heading & Offer a Ride */}
        <div className="head">
          <div>
            <div className="eyebrow">YOUR CAMPUS, SAME DIRECTION</div>
            <h1>Same way? Share the ride.</h1>
            <div className="sub">Car or rickshaw, find your way to campus with a fellow {currentUser.university} student.</div>
          </div>
          <button
            className="btn"
            onClick={() => showToast(`Offer a ride: verified ${currentUser.university} driver portal opening soon.`)}
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Offer a ride
          </button>
        </div>

        {/* Notice Banner */}
        <div className="notice">
          <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
            <svg className="i" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <div>
              <div className="t">{currentUser.university}</div>
              <div className="d">Only your university. Every ride here is from a verified {currentUser.university} student.</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "18px", alignItems: "center" }}>
            <span className="badge">✓ Verified student</span>
            <svg className="i" viewBox="0 0 24 24">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={activeTab === "find" ? "on" : ""}
            onClick={() => setActiveTab("find")}
          >
            Find a ride
          </button>
          <button
            className={activeTab === "requests" ? "on" : ""}
            onClick={() => setActiveTab("requests")}
          >
            My requests
            {myRequests.length > 0 && (
              <span style={{ marginLeft: "7px", fontSize: "11px", background: "var(--teal)", color: "#ffffff", padding: "1px 7px", borderRadius: "999px", fontWeight: "600" }}>
                {myRequests.length}
              </span>
            )}
          </button>
          <button
            className={activeTab === "created" ? "on" : ""}
            onClick={() => {
              setActiveTab("created");
              showToast("My created rides: 0 active rides posted.");
            }}
          >
            My created rides
          </button>
        </div>

        {/* =========================================================
           FIND A RIDE TAB (Google Maps & Search Form)
           ========================================================= */}
        {activeTab === "find" && (
          <>
            <div className="google-map-wrapper">
              <div className="map-top-bar">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--teal)", fontWeight: 700 }}>
                    <span className="radar-pulse-dot" />
                    <span>Google Maps Dhaka Corridor</span>
                  </div>
                  <div className="map-quick-dest-group">
                    <span style={{ fontSize: "11px", color: "var(--mute)", marginRight: "2px" }}>Quick Destination:</span>
                    {QUICK_CAMPUS_DESTINATIONS.map((dest) => (
                      <button
                        key={dest.name}
                        type="button"
                        className={`map-quick-dest-pill ${goingTo.includes(dest.name.split(",")[0]) ? "active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setGoingTo(dest.fullName);
                          showToast(`Destination set: ${dest.name}`);
                        }}
                      >
                        {dest.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: "12px", color: "var(--mute)" }}>
                  Route: <strong style={{ color: "var(--teal)" }}>{leavingFrom.split(",")[0]}</strong> ➔{" "}
                  <strong style={{ color: "#ea4335" }}>{goingTo.split(",")[0]}</strong> · ~12 mins (4.2 km)
                </div>
              </div>

              <div className="google-map-canvas" onClick={handleMapCanvasClick} title="Click anywhere on the map to set destination">
                {/* Realistic Dhaka Google Maps Vector Graphic */}
                <svg className="gmap-svg" viewBox="0 0 1000 420" preserveAspectRatio="none">
                  <rect width="1000" height="420" fill="#f4f3f0" />

                  {/* Water Bodies (Dhanmondi Lake & Hatirjheel) */}
                  <path className="gmap-water" d="M290,140 Q310,210 330,260 T350,320 T330,380 Q310,340 300,260 Z" />
                  <path className="gmap-water" d="M510,140 Q570,120 640,150 T730,170 Q690,195 620,185 T520,170 Z" />

                  {/* Greenery / Campus Parks (Suhrawardy Udyan, Ramna Park, Chandrima) */}
                  <rect x="420" y="260" width="100" height="85" rx="12" className="gmap-park" />
                  <rect x="450" y="170" width="85" height="55" rx="10" className="gmap-park" />
                  <rect x="270" y="270" width="40" height="60" rx="8" className="gmap-park" />

                  {/* Secondary Street Grid (White Streets across Dhaka) */}
                  <g stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M180,90 L380,90 L580,100 L780,100" />
                    <path d="M150,150 L340,150 L520,160 L800,160" />
                    <path d="M160,210 L310,210 L450,220 L760,220" />
                    <path d="M200,270 L340,270 L500,280 L790,280" />
                    <path d="M170,330 L360,330 L550,340 L820,340" />
                    <path d="M230,40 L230,380" />
                    <path d="M370,50 L370,390" />
                    <path d="M440,60 L440,400" />
                    <path d="M520,50 L520,390" />
                    <path d="M600,40 L600,380" />
                    <path d="M720,50 L720,390" />
                  </g>

                  {/* Yellow Highways (Mirpur Road & Kazi Nazrul Islam Ave) */}
                  <path className="gmap-highway-border" d="M240,30 L270,130 L300,230 L340,340 L370,410" />
                  <path className="gmap-highway" d="M240,30 L270,130 L300,230 L340,340 L370,410" />
                  <path className="gmap-highway-border" d="M470,410 L455,300 L485,210 L535,130 L590,30" />
                  <path className="gmap-highway" d="M470,410 L455,300 L485,210 L535,130 L590,30" />

                  {/* Blue Arterial Corridors (Tejgaon / Shahbagh Link) */}
                  <path d="M270,130 L455,130 L640,150 L730,170" stroke="#93c5fd" strokeWidth="6" strokeLinecap="round" fill="none" />
                  <path d="M300,230 L470,230 L580,240 L760,240" stroke="#93c5fd" strokeWidth="6" strokeLinecap="round" fill="none" />

                  {/* Dynamic Route Line from Pickup to Destination */}
                  <path d={routeCurvePath} className="gmap-route-line" stroke="#1a73e8" strokeWidth="6" fill="none" strokeLinecap="round" />
                  <path d={routeCurvePath} className="gmap-route-dash" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" />

                  {/* Google Maps Landmark Icons */}
                  {/* BSMMU / PG Hospital */}
                  <circle cx="445" cy="305" r="9" fill="#ea4335" />
                  <text x="445" y="309" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">H</text>
                  <text x="460" y="308" fill="#5f6368" fontSize="10" fontWeight="600">PG Hospital</text>

                  {/* IBN Sina Hospital */}
                  <circle cx="280" cy="180" r="9" fill="#ea4335" />
                  <text x="280" y="184" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">H</text>
                  <text x="294" y="183" fill="#5f6368" fontSize="10" fontWeight="600">IBN Sina</text>

                  {/* East West University */}
                  <text x="735" y="145" fill="#1a73e8" fontSize="10" fontWeight="600">🎓 East West Univ</text>

                  {/* Area Labels */}
                  <text x="190" y="150" fill="#70757a" fontSize="11" fontWeight="600">Mohammadpur</text>
                  <text x="490" y="155" fill="#70757a" fontSize="11" fontWeight="600">Tejgaon</text>
                  <text x="420" y="260" fill="#70757a" fontSize="11" fontWeight="600">Farmgate</text>
                  <text x="430" y="325" fill="#70757a" fontSize="11" fontWeight="600">Shahbagh</text>
                  <text x="560" y="155" fill="#188038" fontSize="11" fontWeight="700">Hatirjheel</text>
                  <text x="730" y="200" fill="#70757a" fontSize="11" fontWeight="600">Rampura</text>

                  {/* Live Student Rides (Uber-style tiny vehicle icons on the roads) */}
                  <g transform="translate(360, 130) rotate(-15)">
                    <rect x="-8" y="-4" width="16" height="8" rx="2" fill="#ffffff" stroke="#374151" strokeWidth="1" />
                    <rect x="-4" y="-3" width="8" height="6" rx="1" fill="#1f2937" />
                  </g>
                  <g transform="translate(480, 210) rotate(70)">
                    <rect x="-8" y="-4" width="16" height="8" rx="2" fill="#ffffff" stroke="#374151" strokeWidth="1" />
                    <rect x="-4" y="-3" width="8" height="6" rx="1" fill="#1f2937" />
                  </g>
                  <g transform="translate(310, 270) rotate(-45)">
                    <rect x="-8" y="-4" width="16" height="8" rx="2" fill="#ffffff" stroke="#374151" strokeWidth="1" />
                    <rect x="-4" y="-3" width="8" height="6" rx="1" fill="#1f2937" />
                  </g>
                  <g transform="translate(530, 280) rotate(10)">
                    <rect x="-8" y="-4" width="16" height="8" rx="2" fill="#ffffff" stroke="#374151" strokeWidth="1" />
                    <rect x="-4" y="-3" width="8" height="6" rx="1" fill="#1f2937" />
                  </g>
                </svg>

                {/* Main Destination Marker (Red Pin with Drop-off Name - Clean & Uncluttered) */}
                <div
                  style={{
                    position: "absolute",
                    left: destCoords.left,
                    top: destCoords.top,
                    transform: "translate(-50%, -100%)",
                    zIndex: 25,
                    pointerEvents: "none",
                    transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                >
                  <div
                    style={{
                      background: "#ea4335",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>🏁</span>
                    <span>Drop-off: {goingTo.split(",")[0]}</span>
                  </div>
                </div>

                {/* Main Pickup Marker (Black Pill with Car & Pulse Ring - Clean & Uncluttered) */}
                <div
                  style={{
                    position: "absolute",
                    left: originCoords.left,
                    top: originCoords.top,
                    transform: "translate(-50%, -100%)",
                    zIndex: 24,
                    pointerEvents: "none",
                    transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                >
                  <div
                    style={{
                      background: "#1d2b2a",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>🚗</span>
                    <span>Pickup: {leavingFrom.split(",")[0]}</span>
                  </div>
                </div>

                {/* Google Attribution & Control Buttons */}
                <div className="gmap-google-logo">Google</div>
                <div className="gmap-attribution">Map Data ©2026 Google</div>

                <div className="gmap-zoom-controls">
                  <button
                    type="button"
                    className="gmap-recenter-btn"
                    title="Recenter to my current location"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAutoDetectLocation();
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                      <circle cx="12" cy="12" r="8" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="gmap-zoom-btn"
                    title="Zoom in"
                    onClick={(e) => {
                      e.stopPropagation();
                      showToast("Zoom in (+)");
                    }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="gmap-zoom-btn"
                    title="Zoom out"
                    onClick={(e) => {
                      e.stopPropagation();
                      showToast("Zoom out (−)");
                    }}
                  >
                    −
                  </button>
                </div>
              </div>
            </div>

            {/* Search Console (Below Map) */}
            <section className="search">
              <form className="row" onSubmit={handleTriggerSearch}>
                {/* 1. Leaving From (Auto-Location GPS detect) */}
                <div>
                  <label className="l">Leaving from</label>
                  <div className="field">
                    <input
                      value={leavingFrom}
                      onChange={(e) => setLeavingFrom(e.target.value)}
                      placeholder="e.g. Dhanmondi, Mirpur"
                    />
                    <button
                      type="button"
                      className="icon-action-btn"
                      title="Auto-detect my current GPS location"
                      onClick={handleAutoDetectLocation}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: isDetectingLocation ? "#10b981" : "var(--teal)" }}>
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                        <circle cx="12" cy="12" r="8" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 2. Going To (Search any location in Bangladesh from Google Maps) */}
                <div ref={dropdownRef} style={{ position: "relative" }}>
                  <label className="l">Going to</label>
                  <div className="field">
                    <input
                      value={goingTo}
                      onChange={(e) => {
                        setGoingTo(e.target.value);
                        setShowGoingToDropdown(true);
                      }}
                      onFocus={() => setShowGoingToDropdown(true)}
                      placeholder="Search any place in Bangladesh..."
                    />
                    <button
                      type="button"
                      className="icon-action-btn"
                      title="Search location in Bangladesh"
                      onClick={() => setShowGoingToDropdown(!showGoingToDropdown)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-4-4" />
                      </svg>
                    </button>
                  </div>

                  {/* Bangladesh Google Maps Autocomplete Dropdown */}
                  {showGoingToDropdown && (
                    <div className="places-autocomplete-dropdown">
                      <div style={{ padding: "8px 14px", fontSize: "11px", fontWeight: "700", color: "var(--mute)", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        GOOGLE MAPS BANGLADESH LOCATIONS
                      </div>
                      {placeSuggestions.map((place) => (
                        <div
                          key={place}
                          className="place-suggestion-item"
                          onClick={() => {
                            setGoingTo(place);
                            setShowGoingToDropdown(false);
                            showToast(`Destination set: ${place}`);
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--teal)", flexShrink: 0 }}>
                            <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
                            <circle cx="12" cy="10" r="2.5" />
                          </svg>
                          <span>{place}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Gender Preference */}
                <div>
                  <label className="l">Gender preference</label>
                  <div className="field select-field">
                    <select
                      value={genderFilter}
                      onChange={(e) =>
                        setGenderFilter(
                          e.target.value as
                            | "any"
                            | "women_only"
                            | "men_only"
                            | "no_preference"
                        )
                      }
                    >
                      <option value="any">Any preference</option>
                      <option value="women_only">Women only</option>
                      <option value="men_only">Men only</option>
                      <option value="no_preference">No preference</option>
                    </select>
                    <svg className="select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </div>

                {/* 4. Vehicle Type */}
                <div>
                  <label className="l">Vehicle type</label>
                  <div className="field select-field">
                    <select
                      value={vehicleFilter}
                      onChange={(e) =>
                        setVehicleFilter(
                          e.target.value as "all" | "Car" | "Rickshaw"
                        )
                      }
                    >
                      <option value="all">All vehicles</option>
                      <option value="Car">Car</option>
                      <option value="Rickshaw">Rickshaw</option>
                    </select>
                    <svg className="select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </div>

                {/* 5. Search Rides Button */}
                <button type="submit" className="btn lg">
                  <svg viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-4-4" />
                  </svg>
                  Search rides
                </button>
              </form>

              <div className="hint">
                <span>Search any neighborhood in Dhaka or Bangladesh, or click directly on the Google Map above to set destination.</span>
                <span style={{ color: "var(--teal)", fontWeight: 600 }}>
                  🗺️ Google Maps Live Navigation
                </span>
              </div>
            </section>

            {/* Found Search Results (Available Rides) */}
            {hasSearched && (
              <section ref={resultsRef} className="found-rides-section results-entrance-anim" style={{ marginTop: "28px" }}>
                <div className="found-rides-header">
                  <div>
                    <h2>Available Campus Rides ({searchResults.length})</h2>
                    <p>Verified {currentUser.university} students heading your way. Click &quot;Request Ride&quot; to connect.</p>
                  </div>
                  <div style={{ fontSize: "12.5px", color: "var(--teal)", fontWeight: "600" }}>
                    ✓ 2×2 Grid · Verified Campus Only
                  </div>
                </div>

                {searchResults.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", background: "#f8faf9", borderRadius: "12px", border: "1px dashed var(--line)" }}>
                    <p style={{ color: "var(--mute)", fontSize: "14.5px" }}>No matching rides found for this route filter.</p>
                  </div>
                ) : (
                  <div className="found-rides-list">
                    {searchResults.map((ride, idx) => {
                      const isRequested = myRequests.some((r) => r.id === ride.id);
                      return (
                        <div key={ride.id} className={`found-ride-card found-ride-card-anim card-stagger-${idx}`}>
                          {/* Route: Stops & Companion Preference */}
                          <div className="card-route-body">
                            <div className="card-stops-col">
                              <div className="card-stop-row">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                  <circle cx="12" cy="12" r="9" />
                                  <circle cx="12" cy="12" r="3.5" fill="currentColor" />
                                </svg>
                                <span>{ride.origin}</span>
                              </div>
                              <div className="card-stop-row">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
                                  <circle cx="12" cy="10" r="2.5" />
                                </svg>
                                <span>{ride.destination}</span>
                              </div>
                              <div className="card-pref-text">
                                {ride.preference}
                              </div>
                            </div>
                          </div>

                          {/* Divider */}
                          <div className="card-divider" />

                          {/* Bottom: Verified Host Details + Actions */}
                          <div className="card-bottom-bar">
                            <div className="card-host-wrap">
                              <div className="card-host-av">{ride.hostInitials}</div>
                              <div>
                                <div className="card-host-name">
                                  {ride.hostName}
                                  <span className="check-icon">✓</span>
                                </div>
                                <div className="card-host-sub">
                                  Verified · {ride.hostUniversity} · {ride.vehicle}
                                </div>
                              </div>
                            </div>

                            <div className="card-actions-group">
                              <button
                                type="button"
                                className="card-view-btn"
                                onClick={() => handleViewDetails(ride)}
                              >
                                View details →
                              </button>
                              <button
                                type="button"
                                className={`card-request-btn ${isRequested ? "requested" : ""}`}
                                onClick={() => handleSendRequest(ride)}
                              >
                                {isRequested ? "✓ Requested" : "Request Ride ➔"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {/* =========================================================
       MY REQUESTS TAB (User's Requested Rides & Companion Messaging)
       ========================================================= */}
        {activeTab === "requests" && (
          <div style={{ marginTop: "24px" }}>
            {/* Active Ride In-Progress Banner */}
            {activeRideInProgress && (
              <div className="active-ride-banner">
                <div className="active-ride-info">
                  <div className="active-ride-pulse" />
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--ink)", display: "flex", alignItems: "center", gap: "6px" }}>
                      Ride in Progress with {activeRideInProgress.hostName}
                      <span style={{ fontSize: "12px", background: "var(--mint)", color: "var(--teal)", padding: "2px 8px", borderRadius: "999px" }}>
                        {activeRideInProgress.vehicle}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--mute)", marginTop: "2px" }}>
                      En route: {activeRideInProgress.origin} ➔ {activeRideInProgress.destination}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <button
                    type="button"
                    className="card-chat-btn"
                    onClick={() => handleOpenChat(activeRideInProgress)}
                  >
                    💬 Chat
                  </button>
                  <button
                    type="button"
                    className="finish-ride-btn"
                    onClick={handleFinishRide}
                  >
                    Complete Ride & Leave Rating ⭐
                  </button>
                </div>
              </div>
            )}

            {myRequests.length === 0 ? (
              <div className="empty-requests-box">
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div>
                <h3 style={{ fontSize: "19px", fontWeight: "700", color: "var(--ink)", marginBottom: "6px" }}>
                  No Active Ride Requests
                </h3>
                <p style={{ color: "var(--mute)", fontSize: "14px", maxWidth: "440px", margin: "0 auto 20px" }}>
                  You have not requested any campus rides yet. Search for your route in &quot;Find a ride&quot; to connect with companions.
                </p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setActiveTab("find")}
                >
                  Find a Ride
                </button>
              </div>
            ) : (
              <section className="found-rides-section" style={{ marginTop: "16px" }}>
                <div className="found-rides-header">
                  <div>
                    <h2>My Ride Requests ({myRequests.length})</h2>
                    <p>Your requested campus rides with verified {currentUser.university} companions. Chat directly or start your ride.</p>
                  </div>
                  <div style={{ fontSize: "12.5px", color: "var(--teal)", fontWeight: "600" }}>
                    💬 Direct Messaging Active
                  </div>
                </div>

                <div className="found-rides-list">
                  {myRequests.map((ride) => (
                    <div key={ride.id} className="found-ride-card">
                      {/* Request Status Bar */}
                      <div className="request-status-bar">
                        <span className="request-status-pill accepted">
                          ✓ Request Accepted · Ready to Travel
                        </span>
                        <button
                          type="button"
                          className="card-cancel-req-btn"
                          onClick={() => handleCancelRequest(ride.id)}
                          title="Cancel this request"
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Route: Stops & Companion Preference */}
                      <div className="card-route-body">
                        <div className="card-stops-col">
                          <div className="card-stop-row">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <circle cx="12" cy="12" r="9" />
                              <circle cx="12" cy="12" r="3.5" fill="currentColor" />
                            </svg>
                            <span>{ride.origin}</span>
                          </div>
                          <div className="card-stop-row">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
                              <circle cx="12" cy="10" r="2.5" />
                            </svg>
                            <span>{ride.destination}</span>
                          </div>
                          <div className="card-pref-text">
                            {ride.preference}
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="card-divider" />

                      {/* Bottom: Verified Host Details + Chat & Start Actions */}
                      <div className="card-bottom-bar">
                        <div className="card-host-wrap">
                          <div className="card-host-av">{ride.hostInitials}</div>
                          <div>
                            <div className="card-host-name">
                              {ride.hostName}
                              <span className="check-icon">✓</span>
                            </div>
                            <div className="card-host-sub">
                              Verified · {ride.hostUniversity} · {ride.vehicle}
                            </div>
                          </div>
                        </div>

                        <div className="card-actions-group">
                          <button
                            type="button"
                            className="card-chat-btn"
                            onClick={() => handleOpenChat(ride)}
                            title="Chat with companion"
                          >
                            💬 Chat
                          </button>
                          <button
                            type="button"
                            className="btn sm"
                            style={{ padding: "7px 14px", fontSize: "13px" }}
                            onClick={() => handleStartRide(ride)}
                          >
                            Start Ride
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* =========================================================
       MY CREATED RIDES TAB
       ========================================================= */}
        {activeTab === "created" && (
          <div style={{ padding: "60px 20px", textAlign: "center", background: "#f8faf9", borderRadius: "14px", border: "1px dashed var(--line)", marginTop: "24px" }}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>🚗</div>
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", marginBottom: "6px" }}>
              My Created Rides (0)
            </h3>
            <p style={{ color: "var(--mute)", fontSize: "14px", maxWidth: "460px", margin: "0 auto 18px" }}>
              You have not posted any rides yet. Verified {currentUser.university} driver portal is opening soon.
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => showToast(`Offer a ride: verified ${currentUser.university} driver portal opening soon.`)}
            >
              Offer a Ride
            </button>
          </div>
        )}

        {/* Safety Box */}
        <div className="safe" style={{ marginTop: "32px" }}>
          <div className="t">
            <svg className="i" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            A little safer, together
          </div>
          <p>
            Meet at the agreed public pickup point, verify your host, and use SOS from the top navigation if you need help. Travel is strictly limited to verified university network members.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <div>UniShare. Made for university students in Bangladesh.</div>
          <div className="lk">
            <Link href="#">Privacy</Link>
            <Link href="#">Terms</Link>
            <Link href="#" onClick={(e) => { e.preventDefault(); showToast("Support: support@unishare.online"); }}>
              Get help
            </Link>
            <Link href="/login">Log out</Link>
          </div>
        </div>
      </footer>

      {/* =========================================================
         SEARCHING ANIMATION (Radar Pulse Scanning Overlay)
         ========================================================= */}
      {isPathaoSearching && (
        <div className="pathao-search-overlay" onClick={handleCancelSearch}>
          <div className="pathao-search-card" onClick={(e) => e.stopPropagation()}>
            <div className="pathao-radar-ring-container">
              <div className="pathao-ripple-1" />
              <div className="pathao-ripple-2" />
              <div className="pathao-ripple-3" />
              <div className="pathao-center-veh-icon">
                {vehicleFilter === "Rickshaw" ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="5.5" cy="17.5" r="3.5" />
                    <circle cx="18.5" cy="17.5" r="3.5" />
                    <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h3" />
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2" />
                    <circle cx="7" cy="17" r="2" />
                    <path d="M9 17h6" />
                    <circle cx="17" cy="17" r="2" />
                  </svg>
                )}
              </div>
            </div>

            <div className="pathao-headline">Scanning Dhaka Corridor...</div>
            <div className="pathao-subtext">
              Looking for verified {currentUser.university} student rides heading from {leavingFrom.split(",")[0]} to {goingTo.split(",")[0]}
            </div>

            {/* Animated Indeterminate Progress Bar */}
            <div className="pathao-progress-bar">
              <div className="pathao-progress-fill" />
            </div>

            {/* Route Summary */}
            <div className="pathao-route-summary">
              <div>
                <span style={{ fontSize: "11px", color: "var(--mute)", display: "block" }}>Pickup</span>
                <strong>{leavingFrom.split(",")[0]}</strong>
              </div>
              <span style={{ color: "var(--teal)", fontWeight: "bold" }}>➔</span>
              <div>
                <span style={{ fontSize: "11px", color: "var(--mute)", display: "block" }}>Destination</span>
                <strong>{goingTo.split(",")[0]}</strong>
              </div>
            </div>

            <button type="button" className="pathao-cancel-btn" onClick={handleCancelSearch}>
              Cancel Request
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
         RIDE DETAILS MODAL
         ========================================================= */}
      {selectedRideForDetails && (
        <div className="ride-modal-overlay" onClick={() => setSelectedRideForDetails(null)}>
          <div className="ride-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div className="card-host-av" style={{ width: "46px", height: "46px", fontSize: "15px" }}>
                  {selectedRideForDetails.hostInitials}
                </div>
                <div>
                  <div style={{ fontSize: "17px", fontWeight: "700", color: "var(--ink)", display: "flex", alignItems: "center", gap: "6px" }}>
                    {selectedRideForDetails.hostName}
                    <span style={{ color: "var(--teal)", fontWeight: "bold" }}>✓</span>
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--mute)" }}>
                    {selectedRideForDetails.hostDept} · {selectedRideForDetails.hostUniversity}
                  </div>
                  <div style={{ fontSize: "12.5px", color: "#f59e0b", fontWeight: "600", marginTop: "2px" }}>
                    ★ {selectedRideForDetails.hostRating} ({selectedRideForDetails.totalRides} campus rides)
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRideForDetails(null)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--mute)" }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: "#f8faf9", borderRadius: "12px", padding: "16px", marginBottom: "18px", border: "1px solid #e2ece9" }}>
              <div style={{ fontSize: "12px", textTransform: "uppercase", fontWeight: "700", color: "var(--teal)", letterSpacing: "0.4px", marginBottom: "8px" }}>
                Ride Details & Route
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14.5px", fontWeight: "600", color: "var(--ink)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "var(--teal)" }}>⊙ Pickup:</span> {selectedRideForDetails.origin}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#ea4335" }}>📍 Drop-off:</span> {selectedRideForDetails.destination}
                </div>
              </div>
              <div style={{ borderTop: "1px solid #e2ece9", marginTop: "12px", paddingTop: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px" }}>
                <div>
                  <span style={{ color: "var(--mute)", display: "block", fontSize: "11.5px" }}>Vehicle</span>
                  <strong>{selectedRideForDetails.vehicleModel}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--mute)", display: "block", fontSize: "11.5px" }}>Departure</span>
                  <strong>{selectedRideForDetails.departureTime}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--mute)", display: "block", fontSize: "11.5px" }}>Seats Available</span>
                  <strong>{selectedRideForDetails.seatsLeft} {selectedRideForDetails.seatsLeft === 1 ? "seat left" : "seats left"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--mute)", display: "block", fontSize: "11.5px" }}>Companion Policy</span>
                  <strong>{selectedRideForDetails.preference}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="card-chat-btn"
                style={{ padding: "9px 16px", fontSize: "13.5px" }}
                onClick={() => {
                  const p = selectedRideForDetails;
                  setSelectedRideForDetails(null);
                  handleOpenChat(p);
                }}
              >
                💬 Chat with Companion
              </button>
              {myRequests.some((r) => r.id === selectedRideForDetails.id) ? (
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => {
                    setSelectedRideForDetails(null);
                    setActiveTab("requests");
                  }}
                >
                  ✓ View in My Requests ➔
                </button>
              ) : (
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => {
                    handleSendRequest(selectedRideForDetails);
                    setSelectedRideForDetails(null);
                  }}
                >
                  Send Request to Join ➔
                </button>
              )}
              <button
                type="button"
                className="pathao-cancel-btn"
                style={{ width: "auto" }}
                onClick={() => setSelectedRideForDetails(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
         DIRECT CHAT MODAL (Live Companion Messaging)
         ========================================================= */}
      {chatPeer && (
        <div className="ride-modal-overlay" onClick={() => setChatPeer(null)}>
          <div className="chat-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Chat Header */}
            <div className="chat-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="card-host-av" style={{ width: "38px", height: "38px", fontSize: "13px" }}>
                  {chatPeer.hostInitials}
                </div>
                <div>
                  <div style={{ fontSize: "14.5px", fontWeight: "700", color: "var(--ink)", display: "flex", alignItems: "center", gap: "5px" }}>
                    {chatPeer.hostName}
                    <span style={{ color: "var(--teal)", fontSize: "12px", fontWeight: "bold" }}>✓</span>
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--mute)" }}>
                    {chatPeer.hostDept} · {chatPeer.vehicle}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setChatPeer(null)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--mute)", padding: "4px" }}
                title="Close chat"
              >
                ✕
              </button>
            </div>

            {/* Chat Message Thread */}
            <div className="chat-messages-body">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`chat-bubble ${msg.sender === "user" ? "outgoing" : "incoming"}`}>
                  <div>{msg.text}</div>
                  <div style={{ fontSize: "10px", marginTop: "4px", opacity: 0.75, textAlign: msg.sender === "user" ? "right" : "left" }}>
                    {msg.time}
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input Form */}
            <form className="chat-input-bar" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="chat-input"
                placeholder={`Message ${chatPeer.hostName}...`}
                value={chatInputText}
                onChange={(e) => setChatInputText(e.target.value)}
                autoFocus
              />
              <button type="submit" className="chat-send-btn" title="Send message">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
         RIDE RATING MODAL (Post-Ride Rating System)
         ========================================================= */}
      {showRatingModal && rideBeingRated && (
        <div className="ride-modal-overlay" onClick={() => setShowRatingModal(false)}>
          <div className="ride-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <div className="card-host-av" style={{ width: "52px", height: "52px", fontSize: "18px", margin: "0 auto 12px" }}>
                {rideBeingRated.hostInitials}
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: "700", color: "var(--ink)" }}>
                Rate your ride with {rideBeingRated.hostName}
              </h3>
              <p style={{ fontSize: "13.5px", color: "var(--mute)", marginTop: "4px" }}>
                You arrived safely at {rideBeingRated.destination}! How was your companion experience?
              </p>
            </div>

            {/* 5-Star Interactive Rating */}
            <div className="star-rating-row">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRatingScore || ratingScore) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    className={`star-btn ${isFilled ? "active" : ""}`}
                    onClick={() => setRatingScore(star)}
                    onMouseEnter={() => setHoverRatingScore(star)}
                    onMouseLeave={() => setHoverRatingScore(0)}
                    title={`${star} Star`}
                  >
                    ★
                  </button>
                );
              })}
            </div>
            <div style={{ textAlign: "center", fontSize: "13.5px", fontWeight: "600", color: "var(--teal)", marginBottom: "14px" }}>
              {ratingScore === 5 && "⭐ 5.0 - Excellent campus experience!"}
              {ratingScore === 4 && "⭐ 4.0 - Very good ride"}
              {ratingScore === 3 && "⭐ 3.0 - Good ride"}
              {ratingScore === 2 && "⭐ 2.0 - Fair"}
              {ratingScore === 1 && "⭐ 1.0 - Needs improvement"}
            </div>

            {/* Quick Compliment Tags */}
            <div style={{ fontSize: "12px", color: "var(--mute)", textAlign: "center" }}>
              Select compliments (optional):
            </div>
            <div className="rating-tags-group">
              {[
                "🎯 Punctual & On Time",
                "🚗 Safe Driving",
                "💬 Friendly & Polite",
                "🛡️ Felt Very Safe",
                "✨ Clean Vehicle",
              ].map((tag) => {
                const isSelected = selectedFeedbackTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`rating-tag-chip ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleFeedbackTag(tag)}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Comment Area */}
            <div style={{ marginBottom: "18px" }}>
              <textarea
                className="rating-textarea"
                placeholder={`Leave a note or compliment for ${rideBeingRated.hostName} (optional)...`}
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="btn"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={handleSubmitRating}
              >
                Submit Rating
              </button>
              <button
                type="button"
                className="pathao-cancel-btn"
                style={{ width: "auto" }}
                onClick={() => setShowRatingModal(false)}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UniShare Floating Toast Notification */}
      <div className={`toast-notification ${toastVisible ? "show" : ""}`} role="status">
        <div className="toast-icon-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <span className="toast-text">{toastText}</span>
      </div>
    </div>
  );
}
