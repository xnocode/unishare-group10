import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Haversine formula to compute distance between two coordinates in kilometers
function getHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
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
}

// POST /api/rides/conversations/[id]/tracking/location — Push browser GPS update & detect arrival
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Please log in." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const conversation = await db.travelConversation.findUnique({
      where: { id },
      include: {
        tracking: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: "Conversation not found." },
        { status: 404 }
      );
    }

    const isP1 = conversation.participant1Id === user.id;
    const isP2 = conversation.participant2Id === user.id;
    if (!isP1 && !isP2) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Not an authorized participant." },
        { status: 403 }
      );
    }

    const tracking = conversation.tracking;
    if (!tracking) {
      return NextResponse.json(
        { success: false, error: "Tracking session not initialized. Please consent first." },
        { status: 400 }
      );
    }

    // Consent enforcement
    const myConsent = isP1 ? tracking.participant1Consent : tracking.participant2Consent;
    if (!myConsent) {
      return NextResponse.json(
        { success: false, error: "Consent required: You must explicitly agree to share location before sending GPS coordinates." },
        { status: 403 }
      );
    }

    const bothConsented = tracking.participant1Consent && tracking.participant2Consent;
    if (!bothConsented) {
      return NextResponse.json(
        { success: false, error: "Awaiting mutual consent: Live tracking cannot start until both participants agree." },
        { status: 403 }
      );
    }

    if (tracking.journeyStatus === "COMPLETED") {
      return NextResponse.json(
        { success: false, error: "Journey has ended. Live tracking is closed." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { success: false, error: "Invalid GPS coordinates." },
        { status: 400 }
      );
    }

    const accuracy = typeof body.accuracy === "number" ? body.accuracy : null;
    const heading = typeof body.heading === "number" ? body.heading : null;
    const speed = typeof body.speed === "number" ? body.speed : null;
    const now = new Date();

    // Destination & Configurable Proximity Threshold
    const destLat = typeof body.destinationLat === "number"
      ? body.destinationLat
      : (tracking.destinationLat ?? conversation.meetingLat ?? null);
    const destLng = typeof body.destinationLng === "number"
      ? body.destinationLng
      : (tracking.destinationLng ?? conversation.meetingLng ?? null);
    const destName = typeof body.destinationName === "string"
      ? body.destinationName.trim()
      : (tracking.destinationName || conversation.meetingLocation || "the destination");
    const proximityThreshold = typeof body.proximityThresholdMeters === "number" && body.proximityThresholdMeters > 0
      ? body.proximityThresholdMeters
      : tracking.proximityThresholdMeters;

    // -----------------------------------------------------------
    // ARRIVAL DETECTION ENGINE & FALSE-ALARM PREVENTION
    // -----------------------------------------------------------
    let distMeters: number | null = null;
    let newlyArrived = false;
    const alreadyArrived = isP1 ? tracking.p1Arrived : tracking.p2Arrived;
    const partnerArrived = isP1 ? tracking.p2Arrived : tracking.p1Arrived;
    let consecutivePings = isP1 ? tracking.p1ConsecutiveArrivalPings : tracking.p2ConsecutiveArrivalPings;

    if (destLat !== null && destLng !== null) {
      const distKm = getHaversineDistanceKm(lat, lng, destLat, destLng);
      distMeters = Math.round(distKm * 1000);

      // FALSE-ALARM PROTECTION:
      // If GPS accuracy is worse than 65 meters (or larger than proximity threshold),
      // it's too noisy to be confident of arrival. Do not increment arrival pings.
      const isAccuracyAcceptable = accuracy === null || accuracy <= Math.max(65, proximityThreshold);

      if (distMeters <= proximityThreshold && isAccuracyAcceptable) {
        consecutivePings += 1;
        // Require either a single high-accuracy ping (<= 30m accuracy) or 2 consecutive accurate pings
        const isConfidentArrival = (accuracy !== null && accuracy <= 30) || consecutivePings >= 2;

        if (isConfidentArrival && !alreadyArrived) {
          newlyArrived = true;
        }
      } else if (distMeters > proximityThreshold) {
        // Reset counter if moving away from destination
        consecutivePings = 0;
      }
    }

    const updateData: Record<string, unknown> = isP1
      ? {
          p1Lat: lat,
          p1Lng: lng,
          p1Accuracy: accuracy,
          p1Heading: heading,
          p1Speed: speed,
          p1UpdatedAt: now,
          participant1Sharing: true,
          journeyStatus: "IN_PROGRESS",
          destinationLat: destLat,
          destinationLng: destLng,
          destinationName: destName,
          proximityThresholdMeters: proximityThreshold,
          p1ConsecutiveArrivalPings: consecutivePings,
          ...(newlyArrived ? { p1Arrived: true, p1ArrivedAt: now } : {}),
        }
      : {
          p2Lat: lat,
          p2Lng: lng,
          p2Accuracy: accuracy,
          p2Heading: heading,
          p2Speed: speed,
          p2UpdatedAt: now,
          participant2Sharing: true,
          journeyStatus: "IN_PROGRESS",
          destinationLat: destLat,
          destinationLng: destLng,
          destinationName: destName,
          proximityThresholdMeters: proximityThreshold,
          p2ConsecutiveArrivalPings: consecutivePings,
          ...(newlyArrived ? { p2Arrived: true, p2ArrivedAt: now } : {}),
        };

    const updatedTracking = await db.travelLiveTracking.update({
      where: { conversationId: id },
      data: updateData,
    });

    // Send in-thread arrival notification if newly arrived
    if (newlyArrived) {
      await db.travelMessage.create({
        data: {
          conversationId: id,
          senderId: user.id,
          senderName: user.fullName,
          text: `🎯 Arrival Confirmed: ${user.fullName} has safely reached ${destName}!`,
          messageType: "STATUS_UPDATE",
        },
      });

      // If both partners have now arrived, emit celebration message
      if (partnerArrived) {
        await db.travelMessage.create({
          data: {
            conversationId: id,
            senderId: "system",
            senderName: "UniShare Transit",
            text: `🎉 Both travel partners have reached ${destName}! You can now mark the journey completed.`,
            messageType: "STATUS_UPDATE",
          },
        });
      }
    }

    const myArrived = isP1 ? updatedTracking.p1Arrived : updatedTracking.p2Arrived;
    const bothArrived = updatedTracking.p1Arrived && updatedTracking.p2Arrived;

    return NextResponse.json({
      success: true,
      message: newlyArrived ? `Arrival detected at ${destName}!` : "GPS location updated successfully.",
      updatedAt: now.toISOString(),
      lat,
      lng,
      accuracy,
      destinationLat: destLat,
      destinationLng: destLng,
      destinationName: destName,
      distanceToDestinationMeters: distMeters,
      proximityThresholdMeters: proximityThreshold,
      consecutiveArrivalPings: consecutivePings,
      arrived: myArrived,
      newlyArrived,
      partnerArrived,
      bothArrived,
    });
  } catch (error) {
    console.error("POST /api/rides/conversations/[id]/tracking/location error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

