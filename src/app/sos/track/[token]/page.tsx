"use client";

import React, { useEffect, useState, use, Suspense, useCallback } from "react";
import "../../sos.css";

interface TrackingData {
  id: string;
  status: string;
  callingStatus: string;
  triggerReason?: string;
  createdAt: string;
  studentName: string;
  studentId?: string;
  gpsStatus: string;
  latestLocation: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: string;
  } | null;
  breadcrumbs: Array<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: string;
  }>;
  recentCalls: Array<{
    contactName: string;
    status: string;
    priority: number;
    time: string;
  }>;
}

function TrackingContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [resolvedInfo, setResolvedInfo] = useState<{
    studentName?: string;
    resolvedAt?: string;
    resolvedReason?: string;
  } | null>(null);

  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [locationActionMsg, setLocationActionMsg] = useState<string | null>(null);

  // Fetch tracking data from secure API
  const fetchTrackingData = useCallback(async (initial = false) => {
    if (initial) setIsLoading(true);
    try {
      const searchSuffix =
        typeof window !== "undefined" ? window.location.search : "";
      const res = await fetch(
        `/api/sos/track/${encodeURIComponent(token)}${searchSuffix}`
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Unable to load emergency tracking details.");
        return;
      }

      if (data.isExpired) {
        setIsExpired(true);
        setResolvedInfo({
          studentName: data.studentName,
          resolvedAt: data.resolvedAt,
          resolvedReason: data.resolvedReason,
        });
        setTracking(null);
        return;
      }

      setTracking(data.session);
      setIsExpired(false);
      setLastRefreshedAt(new Date());
      setSecondsAgo(0);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch tracking data:", err);
      if (initial) setError("Network error loading emergency tracking.");
    } finally {
      if (initial) setIsLoading(false);
    }
  }, [token]);

  const dispatchCoordinates = async (latitude: number, longitude: number, accuracy = 10) => {
    setIsUpdatingLocation(true);
    setLocationActionMsg("Broadcasting GPS coordinates to live tracking server...");
    try {
      const res = await fetch(`/api/sos/track/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, accuracy }),
      });
      const data = await res.json();
      if (data.success) {
        setLocationActionMsg("✓ Location successfully updated!");
        await fetchTrackingData(false);
      } else {
        setLocationActionMsg(data.error || "Failed to update location.");
      }
    } catch {
      setLocationActionMsg("Network error sending GPS coordinates.");
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const handleCaptureLiveGps = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocationActionMsg("Geolocation is not supported by your browser.");
      return;
    }
    setIsUpdatingLocation(true);
    setLocationActionMsg("Requesting satellite coordinates from device...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void dispatchCoordinates(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      (err) => {
        setIsUpdatingLocation(false);
        setLocationActionMsg(`GPS notice: ${err.message}. Using campus coordinates or enable device GPS.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchTrackingData(true);
    }, 0);
    return () => clearTimeout(t);
  }, [fetchTrackingData]);

  // Periodic polling every 4 seconds for live location refresh
  useEffect(() => {
    if (isExpired || error) return;
    const interval = setInterval(() => {
      void fetchTrackingData(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchTrackingData, isExpired, error]);

  // Second-counter for "Updated X seconds ago"
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [lastRefreshedAt]);

  const lat = tracking?.latestLocation?.latitude;
  const lng = tracking?.latestLocation?.longitude;
  const accuracy = tracking?.latestLocation?.accuracy;

  // OpenStreetMap embed coordinates (bounding box around point)
  const mapEmbedUrl =
    lat !== undefined && lng !== undefined
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005}%2C${lat - 0.003}%2C${lng + 0.005}%2C${lat + 0.003}&layer=mapnik&marker=${lat}%2C${lng}`
      : null;

  return (
    <div className="unishare-sos-page" style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Top Header */}
      <header className="top" style={{ background: "#ffffff", borderBottom: "1.5px solid var(--border-subtle)" }}>
        <div className="wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="22" height="16" viewBox="0 0 20 14" fill="none" stroke="#0d6b63" strokeWidth="2.2">
              <circle cx="6" cy="7" r="4.5" />
              <circle cx="14" cy="7" r="4.5" />
            </svg>
            <span style={{ fontWeight: 800, fontSize: "17px", color: "var(--brand)" }}>UniShare</span>
            <span style={{ fontSize: "12px", color: "var(--muted)", borderLeft: "1px solid #cbd5e1", paddingLeft: "8px" }}>
              Emergency Location Center
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", background: "#f1f5f9", color: "#475569" }}>
              Authorized Contact Portal
            </span>
          </div>
        </div>
      </header>

      <main className="wrap" style={{ maxWidth: "860px", margin: "24px auto", padding: "0 16px 40px" }}>
        {/* Loading state */}
        {isLoading && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div className="sos-pulsing-dot" style={{ margin: "0 auto 16px" }} />
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>
              Connecting to secure emergency tracking channel...
            </div>
            <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
              Verifying token authorization and retrieving GPS coordinates
            </div>
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="sos-card" style={{ textAlign: "center", padding: "40px 20px", marginTop: "20px" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚠️</div>
            <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--ink)", marginBottom: "8px" }}>
              Invalid or Inaccessible Tracking Link
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "14px", maxWidth: "460px", margin: "0 auto 20px" }}>
              {error} This tracking link may have been revoked, expired, or is missing a valid authorization token.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
              <a href="tel:999" className="sos-btn" style={{ background: "#e11d48", color: "#fff" }}>
                Dial National Police (999)
              </a>
              <a href="tel:01711374747" className="sos-btn sos-btn-primary">
                Call DU Proctor (01711-374747)
              </a>
            </div>
          </div>
        )}

        {/* Expired / Resolved State */}
        {!isLoading && isExpired && (
          <div className="sos-card" style={{ padding: "36px 28px", marginTop: "16px", border: "1.5px solid #a7f3d0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "#0d6b63",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  fontWeight: 800,
                }}
              >
                ✓
              </div>
              <div>
                <span
                  style={{
                    background: "#dcfce7",
                    color: "#065f46",
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: "999px",
                    textTransform: "uppercase",
                  }}
                >
                  Emergency Concluded & Safe
                </span>
                <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "4px 0 0", color: "var(--ink)" }}>
                  Emergency Session Resolved
                </h2>
              </div>
            </div>

            <p style={{ fontSize: "14.5px", color: "#334155", lineHeight: "1.5", marginBottom: "14px" }}>
              Student <strong>{resolvedInfo?.studentName || "The student"}</strong> has officially marked themselves safe
              and concluded this emergency assistance session.
            </p>

            <div style={{ padding: "12px 16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", color: "var(--muted)", marginBottom: "20px" }}>
              <div>
                <strong>Resolution Reason:</strong> {resolvedInfo?.resolvedReason || "Marked safe by student."}
              </div>
              {resolvedInfo?.resolvedAt && (
                <div style={{ marginTop: "4px" }}>
                  <strong>Resolved At:</strong> {new Date(resolvedInfo.resolvedAt).toLocaleString()}
                </div>
              )}
            </div>

            <div style={{ padding: "12px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", fontSize: "12.5px", color: "#166534" }}>
              🔒 <strong>Security Notice:</strong> In accordance with privacy and safety policies, live GPS location tracking and tracking access have been expired.
            </div>
          </div>
        )}

        {/* ACTIVE Tracking State */}
        {!isLoading && !isExpired && tracking && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Live Banner */}
            <div
              style={{
                background: "#fff1f2",
                border: "2px solid #fecdd3",
                borderRadius: "12px",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="sos-pulsing-dot" />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#e11d48", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      LIVE EMERGENCY ALERT
                    </span>
                    <span className="sos-session-status-tag tag-escalating">
                      STATUS: {tracking.status} ({tracking.callingStatus})
                    </span>
                  </div>
                  <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--ink)", margin: "4px 0 0" }}>
                    {tracking.studentName} — Real-Time GPS Tracking
                  </h1>
                </div>
              </div>

              <div style={{ fontSize: "12px", color: "var(--muted)", textAlign: "right" }}>
                <div>Activated: {new Date(tracking.createdAt).toLocaleTimeString()}</div>
                <div style={{ color: "#0d6b63", fontWeight: 600 }}>
                  Refreshed {secondsAgo === 0 ? "just now" : `${secondsAgo}s ago`} (Auto-refresh)
                </div>
              </div>
            </div>

            {/* Main Location Card */}
            <div className="sos-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                  Current Real-Time Location
                </h3>

                {tracking.latestLocation && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#065f46",
                      background: "#dcfce7",
                      padding: "3px 10px",
                      borderRadius: "999px",
                      fontWeight: 700,
                    }}
                  >
                    ✓ GPS Signal Locked (±{accuracy ? Math.round(accuracy) : 10}m)
                  </span>
                )}
              </div>

              {/* Map Display */}
              {tracking.latestLocation && lat !== undefined && lng !== undefined ? (
                <div>
                  <div
                    style={{
                      width: "100%",
                      height: "360px",
                      borderRadius: "10px",
                      overflow: "hidden",
                      border: "1.5px solid var(--border-subtle)",
                      background: "#e2e8f0",
                      position: "relative",
                    }}
                  >
                    {mapEmbedUrl && (
                      <iframe
                        title="Live GPS Location Map"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="eager"
                        src={mapEmbedUrl}
                      />
                    )}

                    <div
                      style={{
                        position: "absolute",
                        bottom: "10px",
                        left: "10px",
                        background: "rgba(255, 255, 255, 0.94)",
                        backdropFilter: "blur(4px)",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--ink)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                      }}
                    >
                      📍 Lat: {lat.toFixed(5)}, Lng: {lng.toFixed(5)} · Accuracy: ±{accuracy ? Math.round(accuracy) : 15}m
                    </div>
                  </div>

                  {/* External Map Buttons */}
                  <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                    <a
                      href={`https://www.google.com/maps?q=${lat},${lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sos-btn sos-btn-outline"
                      style={{ flex: 1, minWidth: "180px", justifyContent: "center" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 19 21 12 17 5 21 12 2" />
                      </svg>
                      <span>Open in Google Maps</span>
                    </a>

                    <a
                      href={`https://maps.apple.com/?q=${lat},${lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sos-btn sos-btn-outline"
                      style={{ flex: 1, minWidth: "180px", justifyContent: "center" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                      </svg>
                      <span>Open in Apple Maps</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "36px 20px",
                    textAlign: "center",
                    background: "#f8fafc",
                    border: "1.5px dashed #cbd5e1",
                    borderRadius: "10px",
                  }}
                >
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>📡</div>
                  <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--ink)" }}>
                    {tracking.gpsStatus === "DENIED"
                      ? "Location Permission Denied by Student's Browser"
                      : "Awaiting Live GPS Coordinates from Student's Device..."}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--muted)", maxWidth: "460px", margin: "6px auto 14px" }}>
                    {tracking.gpsStatus === "DENIED"
                      ? "The student's browser blocked automatic GPS permissions. Direct emergency dial options below are active."
                      : "The GPS receiver is acquiring satellite signal or waiting for browser location permission. Click below to dispatch device coordinates or preview campus location."}
                  </div>

                  {locationActionMsg && (
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#0d6b63", marginBottom: "12px" }}>
                      {locationActionMsg}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", marginTop: "12px" }}>
                    <button
                      type="button"
                      onClick={handleCaptureLiveGps}
                      disabled={isUpdatingLocation}
                      style={{
                        padding: "9px 18px",
                        fontSize: "13px",
                        fontWeight: 700,
                        borderRadius: "8px",
                        border: "1px solid #0d6b63",
                        background: "#0d6b63",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {isUpdatingLocation ? "Capturing GPS..." : "📍 Dispatch My Current Location Now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatchCoordinates(23.7315, 90.3965, 10)}
                      disabled={isUpdatingLocation}
                      style={{
                        padding: "9px 18px",
                        fontSize: "13px",
                        fontWeight: 700,
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      📌 Use Dhaka University Campus Coordinates
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Breadcrumb Trail / Location History */}
            {tracking.breadcrumbs && tracking.breadcrumbs.length > 1 && (
              <div className="sos-timeline-box">
                <div className="sos-timeline-title">
                  <span>Location History & Movement Trail ({tracking.breadcrumbs.length} coordinates recorded)</span>
                  <small style={{ color: "var(--muted)", fontWeight: 400 }}>Auto-logged</small>
                </div>

                <div className="sos-timeline-list" style={{ maxHeight: "160px" }}>
                  {tracking.breadcrumbs.map((b, idx) => (
                    <div key={idx} className="sos-timeline-item">
                      <div className="sos-timeline-item-left">
                        <span className="sos-status-pill status-INITIATED">
                          {idx === 0 ? "LATEST" : `POINT #${tracking.breadcrumbs.length - idx}`}
                        </span>
                        <div>
                          <strong>{b.latitude.toFixed(5)}, {b.longitude.toFixed(5)}</strong>
                          <span style={{ color: "var(--muted)", marginLeft: "6px", fontSize: "11.5px" }}>
                            (±{b.accuracy ? Math.round(b.accuracy) : 10}m)
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                        {new Date(b.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fast Action Emergency Hotlines */}
            <div className="sos-card" style={{ padding: "18px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 12px", color: "var(--ink)" }}>
                Immediate Emergency Contacts & Hotlines
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                <a
                  href="tel:999"
                  className="sos-btn"
                  style={{ background: "#e11d48", color: "#ffffff", border: "none", justifyContent: "center" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>Dial 999 (National Police)</span>
                </a>

                <a
                  href="tel:01711374747"
                  className="sos-btn"
                  style={{ background: "var(--brand)", color: "#ffffff", border: "none", justifyContent: "center" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  <span>DU Proctor (01711-374747)</span>
                </a>

                <a
                  href="tel:0255165088"
                  className="sos-btn sos-btn-outline"
                  style={{ justifyContent: "center" }}
                >
                  <span>DMCH Emergency (02-55165088)</span>
                </a>
              </div>
            </div>

            {/* Student Privacy & Legal Information */}
            <div style={{ textAlign: "center", fontSize: "11.5px", color: "var(--muted)", padding: "10px 0" }}>
              UniShare Campus Safety System · University of Dhaka · Authorized Emergency Contact Access Only
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function EmergencyTrackingPage(props: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div className="sos-pulsing-dot" style={{ margin: "0 auto 16px" }} />
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>
            Loading emergency tracking...
          </div>
        </div>
      }
    >
      <TrackingContent {...props} />
    </Suspense>
  );
}

