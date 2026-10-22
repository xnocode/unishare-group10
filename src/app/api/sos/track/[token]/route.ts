import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

// GET: Secure Emergency Tracking Endpoint for authorized emergency contacts
// Accessed via cryptographically secure, unguessable token
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token || token.length < 16) {
      return NextResponse.json(
        { success: false, error: "Invalid tracking token format." },
        { status: 400 }
      );
    }

    const session = await db.emergencySession.findUnique({
      where: { trackingToken: token },
      include: {
        user: {
          select: {
            fullName: true,
            studentId: true,
            email: true,
          },
        },
        locationUpdates: {
          orderBy: { timestamp: "desc" },
          take: 25,
        },
        callAttempts: {
          orderBy: { createdAt: "desc" },
          take: 6,
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Emergency tracking link is invalid or does not exist." },
        { status: 404 }
      );
    }

    // Requirement 10: Expire access when the emergency is resolved
    if (session.status !== "ACTIVE") {
      return NextResponse.json({
        success: true,
        isExpired: true,
        status: session.status,
        studentName: session.user.fullName,
        resolvedAt: session.resolvedAt,
        resolvedReason: session.resolvedReason || "Student has marked themselves safe and ended the emergency session.",
        message: "This emergency tracking link has expired because the emergency has been resolved.",
      });
    }

    // Active session details
    return NextResponse.json({
      success: true,
      isExpired: false,
      session: {
        id: session.id,
        status: session.status,
        callingStatus: session.callingStatus,
        triggerReason: session.triggerReason,
        createdAt: session.createdAt,
        studentName: session.user.fullName,
        studentId: session.user.studentId,
        gpsStatus: session.gpsStatus || "PENDING",
        latestLocation:
          session.latestLatitude !== null && session.latestLongitude !== null
            ? {
                latitude: session.latestLatitude,
                longitude: session.latestLongitude,
                accuracy: session.latestAccuracy,
                timestamp: session.latestLocationAt || session.createdAt,
              }
            : null,
        breadcrumbs: session.locationUpdates.map((u) => ({
          latitude: u.latitude,
          longitude: u.longitude,
          accuracy: u.accuracy,
          timestamp: u.timestamp,
        })),
        recentCalls: session.callAttempts.map((c) => ({
          contactName: c.contactName,
          status: c.status,
          priority: c.priority,
          time: c.createdAt,
        })),
      },
    });
  } catch (err) {
    console.error("Error reading emergency tracking:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error fetching emergency tracking." },
      { status: 500 }
    );
  }
}

