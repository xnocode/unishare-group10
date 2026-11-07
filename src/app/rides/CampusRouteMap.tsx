"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildCurvedRoutePath,
  CampusLandmark,
  computeDistanceKm,
  DHAKA_ARTERIAL_ROADS,
  DHAKA_CAMPUS_LANDMARKS,
  DHAKA_GEO_FEATURES,
  estimateSharedCommute,
  latLngToWorld,
  LatLngPoint,
  projectToScreen,
  resolveLandmarkByName,
  screenToLatLng,
  worldToLatLng,
} from "./rides-geo";

export interface MapPeerItem {
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
  originCoords: LatLngPoint | null;
  destCoords: LatLngPoint | null;
  notes: string | null;
}

interface CampusRouteMapProps {
  pickup: string;
  destination: string;
  pickupCoords: LatLngPoint;
  destCoords: LatLngPoint;
  gpsCoords: LatLngPoint | null;
  myLiveCoords?: LatLngPoint | null;
  partnerLiveCoords?: { lat: number; lng: number; name?: string } | null;
  mapPickMode: "none" | "pickup" | "destination";
  center: LatLngPoint;
  zoom: number;
  peers: MapPeerItem[];
  selectedPartnerIds: string[];
  connectedPartnerIds: string[];
  inspectedPartnerId: string | null;
  onCenterChange: (center: LatLngPoint) => void;
  onZoomChange: (zoom: number) => void;
  onPickCoordinate: (mode: "pickup" | "destination", lat: number, lng: number) => void;
  onSelectLandmark: (landmark: CampusLandmark) => void;
  onInspectPartner: (partnerId: string | null) => void;
  onTogglePartnerSelection: (partnerId: string) => void;
  onConnectPartner: (partner: MapPeerItem) => void;
  onAdoptPeerRoute?: (partner: MapPeerItem) => void;
  onViewportResize?: (size: { width: number; height: number }) => void;
}

/** Resolve geographic coordinates for a peer's origin or destination when DB lat/lng is missing. */
export function resolvePeerPoint(
  coords: LatLngPoint | null,
  label: string,
  fallback: LatLngPoint,
  seedOffset = 0
): LatLngPoint {
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    return coords;
  }
  const matched = resolveLandmarkByName(label);
  if (matched) return { lat: matched.lat, lng: matched.lng };
  const angle = (seedOffset % 8) * (Math.PI / 4);
  return {
    lat: fallback.lat + Math.sin(angle) * 0.0045,
    lng: fallback.lng + Math.cos(angle) * 0.0045,
  };
}

export default function CampusRouteMap({
  pickup,
  destination,
  pickupCoords,
  destCoords,
  gpsCoords,
  myLiveCoords,
  partnerLiveCoords,
  mapPickMode,
  center,
  zoom,
  peers,
  selectedPartnerIds,
  connectedPartnerIds,
  inspectedPartnerId,
  onCenterChange,
  onZoomChange,
  onPickCoordinate,
  onSelectLandmark,
  onInspectPartner,
  onTogglePartnerSelection,
  onConnectPartner,
  onAdoptPeerRoute,
  onViewportResize,
}: CampusRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 840, height: 640 });
  const [hoveredPartnerId, setHoveredPartnerId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    startCenterWorld: { wx: number; wy: number };
    movedPx: number;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startCenterWorld: { wx: 0, wy: 0 },
    movedPx: 0,
  });

  // Track container pixel size accurately so projections & tile bounds never drift
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const next = { width: Math.round(rect.width), height: Math.round(rect.height) };
        setViewport(next);
        onViewportResize?.(next);
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onViewportResize]);

  // Calculate visible Web Mercator OpenStreetMap tiles
  const visibleTiles = useMemo(() => {
    const z = Math.max(11, Math.min(17, Math.round(zoom)));
    const numTiles = Math.pow(2, z);
    const centerWorld = latLngToWorld(center.lat, center.lng, z);
    const topLeftWX = centerWorld.wx - viewport.width / 2;
    const topLeftWY = centerWorld.wy - viewport.height / 2;

    const minTileX = Math.floor(topLeftWX / 256);
    const maxTileX = Math.floor((topLeftWX + viewport.width) / 256);
    const minTileY = Math.floor(topLeftWY / 256);
    const maxTileY = Math.floor((topLeftWY + viewport.height) / 256);

    const tiles: Array<{ key: string; left: number; top: number; url: string }> = [];
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        if (ty < 0 || ty >= numTiles) continue;
        const wrappedX = ((tx % numTiles) + numTiles) % numTiles;
        tiles.push({
          key: `${z}-${wrappedX}-${ty}`,
          left: tx * 256 - topLeftWX,
          top: ty * 256 - topLeftWY,
          url: `https://tile.openstreetmap.org/${z}/${wrappedX}/${ty}.png`,
        });
      }
    }
    return { z, tiles };
  }, [center, zoom, viewport]);

  const project = useCallback(
    (pt: LatLngPoint) => projectToScreen(pt, center, visibleTiles.z, viewport.width, viewport.height),
    [center, visibleTiles.z, viewport.width, viewport.height]
  );

  // Project key route endpoints
  const pickupPx = useMemo(() => project(pickupCoords), [project, pickupCoords]);
  const destPx = useMemo(() => project(destCoords), [project, destCoords]);
  const mainRoutePath = useMemo(
    () => buildCurvedRoutePath(pickupPx.x, pickupPx.y, destPx.x, destPx.y, 0.14),
    [pickupPx, destPx]
  );

  // Prepare peer points with light jitter only when two peers share exact pickup pixel
  const projectedPeers = useMemo(() => {
    const bucketCounts = new Map<string, number>();

    return peers.map((peer, idx) => {
      const originGeo = resolvePeerPoint(peer.originCoords, peer.origin, pickupCoords, idx + 1);
      const destGeo = resolvePeerPoint(peer.destCoords, peer.destination, destCoords, idx + 2);
      const rawOriginPx = project(originGeo);
      const bucketKey = `${Math.round(rawOriginPx.x / 20)}-${Math.round(rawOriginPx.y / 20)}`;
      const seenInBucket = bucketCounts.get(bucketKey) || 0;
      bucketCounts.set(bucketKey, seenInBucket + 1);

      // Gentle radial spread if multiple peers share exact same hub or collide with Pin A / Pin B
      const nearPinA = Math.hypot(rawOriginPx.x - pickupPx.x, rawOriginPx.y - pickupPx.y) < 28;
      const nearPinB = Math.hypot(rawOriginPx.x - destPx.x, rawOriginPx.y - destPx.y) < 28;
      const baseShiftX = nearPinA || nearPinB ? 56 : 0;
      const baseShiftY = nearPinA || nearPinB ? 6 : 0;

      const offsetRadius = seenInBucket > 0 ? 26 : 0;
      const offsetAngle = seenInBucket * 2.1;
      const originPx = {
        x: Math.round((rawOriginPx.x + baseShiftX + Math.cos(offsetAngle) * offsetRadius) * 10) / 10,
        y: Math.round((rawOriginPx.y + baseShiftY + Math.sin(offsetAngle) * offsetRadius) * 10) / 10,
      };
      const destPeerPx = project(destGeo);
      const peerPath = buildCurvedRoutePath(originPx.x, originPx.y, destPeerPx.x, destPeerPx.y, -0.18);
      const fareInfo = estimateSharedCommute(originGeo, destGeo, 2);
      const pickupGapKm = Math.round(computeDistanceKm(pickupCoords, originGeo) * 10) / 10;

      return {
        peer,
        originGeo,
        destGeo,
        originPx,
        destPx: destPeerPx,
        peerPath,
        fareInfo,
        pickupGapKm,
      };
    });
  }, [peers, pickupCoords, destCoords, pickupPx, destPx, project]);

  // Filter campus landmark chips so labels don't visually collide with Pin A, Pin B, or peers
  const projectedLandmarks = useMemo(() => {
    return DHAKA_CAMPUS_LANDMARKS.map((lm) => {
      const px = project(lm);
      const nearPinA = Math.hypot(px.x - pickupPx.x, px.y - pickupPx.y) < 52;
      const nearPinB = Math.hypot(px.x - destPx.x, px.y - destPx.y) < 52;
      const nearPeer = projectedPeers.some(
        (item) => Math.hypot(px.x - item.originPx.x, px.y - item.originPx.y) < 42
      );
      const inBounds =
        px.x >= -40 && px.x <= viewport.width + 40 && px.y >= -40 && px.y <= viewport.height + 40;
      return {
        lm,
        px,
        inBounds,
        hideLabel: nearPinA || nearPinB || nearPeer || (!lm.isQuickHub && visibleTiles.z < 14),
      };
    }).filter((item) => item.inBounds);
  }, [project, pickupPx, destPx, projectedPeers, viewport.width, viewport.height, visibleTiles.z]);

  const gpsPx = useMemo(() => (gpsCoords ? project(gpsCoords) : null), [gpsCoords, project]);
  const myLivePx = useMemo(() => (myLiveCoords ? project(myLiveCoords) : null), [myLiveCoords, project]);
  const partnerLivePx = useMemo(
    () => (partnerLiveCoords ? project({ lat: partnerLiveCoords.lat, lng: partnerLiveCoords.lng }) : null),
    [partnerLiveCoords, project]
  );

  // Pointer drag pan handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-map-interactive='true']")) {
      return;
    }
    const z = visibleTiles.z;
    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startCenterWorld: latLngToWorld(center.lat, center.lng, z),
      movedPx: 0,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    drag.movedPx = Math.max(drag.movedPx, Math.hypot(dx, dy));

    if (drag.movedPx > 2) {
      const nextCenter = worldToLatLng(
        drag.startCenterWorld.wx - dx,
        drag.startCenterWorld.wy - dy,
        visibleTiles.z
      );
      onCenterChange(nextCenter);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;

    const wasClick = drag.movedPx <= 5;
    drag.active = false;
    drag.pointerId = null;
    setIsDragging(false);

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (wasClick) {
      if (mapPickMode !== "none" && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        const picked = screenToLatLng(
          localX,
          localY,
          center,
          visibleTiles.z,
          viewport.width,
          viewport.height
        );
        onPickCoordinate(mapPickMode, picked.lat, picked.lng);
      } else if (!(e.target as HTMLElement).closest("[data-map-interactive='true']")) {
        onInspectPartner(null);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    const nextZoom = Math.max(11, Math.min(17, visibleTiles.z + delta));
    if (nextZoom !== visibleTiles.z) {
      onZoomChange(nextZoom);
    }
  };

  const inspectedItem = useMemo(
    () => projectedPeers.find((p) => p.peer.id === inspectedPartnerId) || null,
    [projectedPeers, inspectedPartnerId]
  );

  // Build projected offline-safe SVG geometry paths
  const roadPaths = useMemo(() => {
    return DHAKA_ARTERIAL_ROADS.map((road) => ({
      ...road,
      d: road.points
        .map((pt, i) => {
          const p = project(pt);
          return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        })
        .join(" "),
    }));
  }, [project]);

  const toPolygonPoints = useCallback(
    (coords: LatLngPoint[]) =>
      coords
        .map((pt) => {
          const p = project(pt);
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join(" "),
    [project]
  );

  return (
    <div
      ref={containerRef}
      className={`interactive-map-canvas ${mapPickMode !== "none" ? "picking-cursor" : isDragging ? "dragging-cursor" : "grab-cursor"}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      role="region"
      aria-label="Interactive Dhaka Campus Commute & Ride-Share Map"
    >
      {/* Layer 1: Projected offline-resilient Dhaka vector arterial map */}
      <svg
        className="campus-map-vector-layer"
        width={viewport.width}
        height={viewport.height}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        aria-hidden="true"
      >
        <defs>
          <pattern id="dhakaGrid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#e4ebe8" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={viewport.width} height={viewport.height} fill="#eef3f1" />
        <rect width={viewport.width} height={viewport.height} fill="url(#dhakaGrid)" />

        <polygon points={toPolygonPoints(DHAKA_GEO_FEATURES.dhanmondiLake)} className="svg-water-body" />
        <polygon points={toPolygonPoints(DHAKA_GEO_FEATURES.hatirjheelLake)} className="svg-water-body" />
        <polygon points={toPolygonPoints(DHAKA_GEO_FEATURES.ramnaGreen)} className="svg-green-space" />

        {roadPaths.map((road) => (
          <path
            key={road.id}
            d={road.d}
            className={road.primary ? "svg-primary-highway" : "svg-secondary-road"}
          />
        ))}
      </svg>

      {/* Layer 2: Real OpenStreetMap raster Slippy Tiles via CSS background tiles */}
      <div className="osm-tiles-layer" aria-hidden="true">
        {visibleTiles.tiles.map((tile) => (
          <div
            key={tile.key}
            className="osm-tile"
            style={{
              transform: `translate3d(${Math.round(tile.left)}px, ${Math.round(tile.top)}px, 0)`,
              backgroundImage: `url("${tile.url}")`,
            }}
          />
        ))}
      </div>

      {/* Subtle readability wash over OSM map so emerald corridors & pins pop cleanly */}
      <div className="map-readability-scrim" aria-hidden="true" />

      {/* Layer 3: Projected active routes, landmarks, student corridors & Pins A/B */}
      <svg
        className="campus-map-overlay-svg"
        width={viewport.width}
        height={viewport.height}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      >
        <defs>
          <filter id="mapPinShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0f172a" floodOpacity="0.22" />
          </filter>
        </defs>

        {/* Active peers' individual route arcs */}
        {projectedPeers.map(({ peer, peerPath, originPx, destPx: peerDestPx }) => {
          const isHighlighted =
            hoveredPartnerId === peer.id ||
            inspectedPartnerId === peer.id ||
            selectedPartnerIds.includes(peer.id);
          const isMatch = Boolean(peer.corridorMatch);
          if (!isHighlighted && !isMatch) return null;

          return (
            <g key={`route-${peer.id}`} className="peer-route-overlay">
              <path
                d={peerPath}
                fill="none"
                stroke={isHighlighted ? "#0d6b63" : "rgba(13, 107, 99, 0.35)"}
                strokeWidth={isHighlighted ? 3.5 : 2.2}
                strokeDasharray="6 5"
                strokeLinecap="round"
              />
              {isHighlighted && (
                <>
                  <circle cx={originPx.x} cy={originPx.y} r="5" fill="#0d6b63" stroke="#ffffff" strokeWidth="2" />
                  <circle cx={peerDestPx.x} cy={peerDestPx.y} r="5" fill="#0f766e" stroke="#ffffff" strokeWidth="2" />
                </>
              )}
            </g>
          );
        })}

        {/* Main planned commuter route Pin A -> Pin B */}
        <path d={mainRoutePath} className="svg-active-route-casing" />
        <path d={mainRoutePath} className="svg-active-route-line" />

        {/* Live GPS Current Position Beacon */}
        {gpsPx && (
          <g transform={`translate(${gpsPx.x}, ${gpsPx.y})`}>
            <circle r="18" fill="rgba(26, 115, 232, 0.22)" className="gps-beacon-halo" />
            <circle r="7" fill="#1a73e8" stroke="#ffffff" strokeWidth="2.5" />
          </g>
        )}

        {/* Clickable Dhaka Campus Hubs */}
        {projectedLandmarks.map(({ lm, px, hideLabel }) => (
          <g
            key={lm.id}
            data-map-interactive="true"
            className="landmark-interactive-node"
            transform={`translate(${px.x}, ${px.y})`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectLandmark(lm);
            }}
          >
            <circle
              r={lm.isQuickHub ? "4.5" : "3.5"}
              fill="#ffffff"
              stroke={lm.isQuickHub ? "#0d6b63" : "#475569"}
              strokeWidth="2"
            />
            {!hideLabel && (
              <g transform="translate(8, -9)">
                <rect
                  x="-3"
                  y="0"
                  width={Math.max(46, lm.label.length * 6.5 + 10)}
                  height="18"
                  rx="9"
                  fill="rgba(255, 255, 255, 0.92)"
                  stroke="#d5dcda"
                  strokeWidth="1"
                />
                <text
                  x="4"
                  y="12.5"
                  fontSize="10.5"
                  fontWeight="600"
                  fill="#161b1a"
                  fontFamily="system-ui, sans-serif"
                >
                  {lm.label}
                </text>
              </g>
            )}
          </g>
        ))}

        {/* Pickup Pin A (Green) */}
        <g transform={`translate(${pickupPx.x}, ${pickupPx.y})`} filter="url(#mapPinShadow)">
          <circle cx="0" cy="0" r="5" fill="#1e8e3e" stroke="#ffffff" strokeWidth="2" />
          <path
            d="M0 -30 C -11 -30, -16 -22, -16 -14 C -16 -4, 0 0, 0 0 C 0 0, 16 -4, 16 -14 C 16 -22, 11 -30, 0 -30 Z"
            fill="#1e8e3e"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <circle cx="0" cy="-16" r="6" fill="#ffffff" />
          <text
            x="0"
            y="-12.5"
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="800"
            fill="#1e8e3e"
            fontFamily="system-ui"
          >
            A
          </text>
        </g>

        {/* Destination Pin B (Red) */}
        <g transform={`translate(${destPx.x}, ${destPx.y})`} filter="url(#mapPinShadow)">
          <circle cx="0" cy="0" r="5" fill="#d93025" stroke="#ffffff" strokeWidth="2" />
          <path
            d="M0 -30 C -11 -30, -16 -22, -16 -14 C -16 -4, 0 0, 0 0 C 0 0, 16 -4, 16 -14 C 16 -22, 11 -30, 0 -30 Z"
            fill="#d93025"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <circle cx="0" cy="-16" r="6" fill="#ffffff" />
          <text
            x="0"
            y="-12.5"
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="800"
            fill="#d93025"
            fontFamily="system-ui"
          >
            B
          </text>
        </g>

        {/* Consented Live Commute Markers */}
        {myLivePx && (
          <g transform={`translate(${myLivePx.x}, ${myLivePx.y})`}>
            <circle r="13" fill="rgba(16, 185, 129, 0.28)" />
            <circle r="6" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" />
          </g>
        )}
        {partnerLivePx && (
          <g transform={`translate(${partnerLivePx.x}, ${partnerLivePx.y})`}>
            <circle r="16" fill="rgba(13, 107, 99, 0.28)" className="gps-beacon-halo" />
            <circle r="7" fill="#0d6b63" stroke="#ffffff" strokeWidth="2.5" />
          </g>
        )}
      </svg>

      {/* Layer 4: Interactive HTML Active Student Companion Chips */}
      <div className="map-peer-markers-layer">
        {projectedPeers.map(({ peer, originPx, fareInfo }) => {
          const isSelected = selectedPartnerIds.includes(peer.id);
          const isInspected = inspectedPartnerId === peer.id;
          const isCorridor = Boolean(peer.corridorMatch);
          const isConnected = connectedPartnerIds.includes(peer.id);

          if (
            originPx.x < 16 ||
            originPx.x > viewport.width - 16 ||
            originPx.y < 36 ||
            originPx.y > viewport.height - 68
          ) {
            return null;
          }

          return (
            <button
              key={`marker-${peer.id}`}
              type="button"
              data-map-interactive="true"
              className={`map-peer-chip ${isCorridor ? "corridor-match" : "active-nearby"} ${
                isSelected ? "selected" : ""
              } ${isInspected ? "inspected" : ""}`}
              style={{
                left: `${originPx.x}px`,
                top: `${originPx.y}px`,
              }}
              onMouseEnter={() => setHoveredPartnerId(peer.id)}
              onMouseLeave={() => setHoveredPartnerId(null)}
              onClick={(e) => {
                e.stopPropagation();
                onInspectPartner(isInspected ? null : peer.id);
              }}
              title={`${peer.fullName} heading to ${peer.destination.split(",")[0]} · Est. ৳${fareInfo.sharedFareBdt}/person`}
            >
              <span className="map-peer-chip-avatar">{peer.avatarInitials}</span>
              <span className="map-peer-chip-body">
                <span className="map-peer-chip-name">{peer.fullName.split(" ")[0]}</span>
                <span className="map-peer-chip-dest">
                  {isCorridor ? `Split ৳${fareInfo.sharedFareBdt}` : `→ ${peer.destination.split(",")[0]}`}
                </span>
              </span>
              {isConnected && <span className="map-peer-chip-check">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Floating Inspected Active Rider Card (shows route, savings & 1-click connect) */}
      {inspectedItem && (
        <div
          className="map-peer-inspector-card"
          data-map-interactive="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="inspector-header">
            <div className="inspector-user">
              <div className="inspector-avatar">{inspectedItem.peer.avatarInitials}</div>
              <div>
                <div className="inspector-name">
                  {inspectedItem.peer.fullName}
                  <span className="inspector-verified">Verified</span>
                </div>
                <div className="inspector-meta">
                  {inspectedItem.peer.department} · {inspectedItem.peer.university}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="inspector-close-btn"
              onClick={() => onInspectPartner(null)}
              aria-label="Close peer route details"
            >
              ✕
            </button>
          </div>

          <div className="inspector-route-box">
            <div className="inspector-route-line">
              <span className="inspector-dot pickup" />
              <span>{inspectedItem.peer.origin.split(",")[0]}</span>
              <span className="inspector-arrow">→</span>
              <span className="inspector-dot dest" />
              <strong>{inspectedItem.peer.destination.split(",")[0]}</strong>
            </div>
            <div className="inspector-fare-strip">
              <span className="inspector-savings-pill">
                Save {inspectedItem.fareInfo.savingsPercent}% · ~৳{inspectedItem.fareInfo.sharedFareBdt}/person
              </span>
              <span className="inspector-solo-note">
                vs ~৳{inspectedItem.fareInfo.soloFareBdt} solo ({inspectedItem.fareInfo.distanceKm} km)
              </span>
            </div>
          </div>

          <div className="inspector-actions">
            <button
              type="button"
              className={`inspector-select-btn ${
                selectedPartnerIds.includes(inspectedItem.peer.id) ? "selected" : ""
              }`}
              onClick={() => onTogglePartnerSelection(inspectedItem.peer.id)}
            >
              {selectedPartnerIds.includes(inspectedItem.peer.id) ? "✓ Selected" : "Select to Share"}
            </button>
            {onAdoptPeerRoute && !inspectedItem.peer.corridorMatch && (
              <button
                type="button"
                className="inspector-adopt-btn"
                onClick={() => onAdoptPeerRoute(inspectedItem.peer)}
              >
                Use Same Route
              </button>
            )}
            <button
              type="button"
              className={`inspector-connect-btn ${
                connectedPartnerIds.includes(inspectedItem.peer.id) ? "connected" : ""
              }`}
              onClick={() => onConnectPartner(inspectedItem.peer)}
            >
              {connectedPartnerIds.includes(inspectedItem.peer.id) ? "Request Sent ✓" : "Send Request"}
            </button>
          </div>
        </div>
      )}

      {/* Map Key / Route Endpoints Pill (Top Left when not picking) */}
      {mapPickMode === "none" && (
        <div className="map-active-legend-pill" data-map-interactive="true">
          <span className="legend-dot live" />
          <span>
            <strong>{projectedPeers.length}</strong> active verified student{projectedPeers.length === 1 ? "" : "s"} on campus
          </span>
          <span className="legend-sep">·</span>
          <span className="legend-route-mini">
            A: {pickup.split(",")[0] || "Pickup"} → B: {destination.split(",")[0] || "Destination"}
          </span>
        </div>
      )}

      {/* Attribution */}
      <div className="map-watermark-google">UniShare Campus Map</div>
      <div className="map-attribution-text">© OpenStreetMap contributors · Web Mercator z{visibleTiles.z}</div>
    </div>
  );
}

