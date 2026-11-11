import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/rides/conversations/[id]/tracking/stream — Real-time SSE stream of live location telemetry
export async function GET(req: NextRequest, context: RouteContext) {
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

    let intervalId: NodeJS.Timeout | null = null;
    let isClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (event: string, data: Record<string, unknown>) => {
          if (isClosed) return;
          try {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
            );
          } catch {
            isClosed = true;
            if (intervalId) clearInterval(intervalId);
          }
        };

        // Send initial connected handshake
        sendEvent("connected", {
          success: true,
          conversationId: id,
          timestamp: new Date().toISOString(),
        });

        const checkAndSendLocation = async () => {
          if (isClosed) return;
          try {
            const currentTracking = await db.travelLiveTracking.findUnique({
              where: { conversationId: id },
            });

            if (!currentTracking) return;

            const myConsent = isP1 ? currentTracking.participant1Consent : currentTracking.participant2Consent;
            const partnerConsent = isP1 ? currentTracking.participant2Consent : currentTracking.participant1Consent;
            const bothConsented = currentTracking.participant1Consent && currentTracking.participant2Consent;
            const mySharing = isP1 ? currentTracking.participant1Sharing : currentTracking.participant2Sharing;
            const partnerSharing = isP1 ? currentTracking.participant2Sharing : currentTracking.participant1Sharing;

            let partnerLocation = null;
            let freshnessSeconds: number | null = null;
            let isStale = false;

            const partnerUpdated = isP1 ? currentTracking.p2UpdatedAt : currentTracking.p1UpdatedAt;
            const partnerLat = isP1 ? currentTracking.p2Lat : currentTracking.p1Lat;
            const partnerLng = isP1 ? currentTracking.p2Lng : currentTracking.p1Lng;
            const partnerAcc = isP1 ? currentTracking.p2Accuracy : currentTracking.p1Accuracy;
            const partnerHeading = isP1 ? currentTracking.p2Heading : currentTracking.p1Heading;
            const partnerSpeed = isP1 ? currentTracking.p2Speed : currentTracking.p1Speed;

            if (bothConsented && partnerSharing && partnerLat !== null && partnerLng !== null && currentTracking.journeyStatus === "IN_PROGRESS") {
              const now = Date.now();
              const updatedTime = partnerUpdated ? new Date(partnerUpdated).getTime() : 0;
              freshnessSeconds = updatedTime > 0 ? Math.max(0, Math.round((now - updatedTime) / 1000)) : null;
              isStale = freshnessSeconds !== null ? freshnessSeconds > 45 : true;

              partnerLocation = {
                lat: partnerLat,
                lng: partnerLng,
                accuracy: partnerAcc,
                heading: partnerHeading,
                speed: partnerSpeed,
                updatedAt: partnerUpdated,
                freshnessSeconds,
                isStale,
              };
            }

            let connectionStatus: "NOT_STARTED" | "AWAITING_CONSENT" | "LIVE" | "STALE" | "PAUSED" | "COMPLETED" = "NOT_STARTED";
            if (currentTracking.journeyStatus === "COMPLETED") {
              connectionStatus = "COMPLETED";
            } else if (!bothConsented) {
              connectionStatus = "AWAITING_CONSENT";
            } else if (!partnerSharing || !mySharing) {
              connectionStatus = "PAUSED";
            } else if (isStale || freshnessSeconds === null) {
              connectionStatus = "STALE";
            } else {
              connectionStatus = "LIVE";
            }

            sendEvent("location_update", {
              conversationId: id,
              journeyStatus: currentTracking.journeyStatus,
              myConsent,
              partnerConsent,
              bothConsented,
              mySharing,
              partnerSharing,
              partnerLocation,
              connectionStatus,
              freshnessSeconds,
              timestamp: new Date().toISOString(),
            });

            if (currentTracking.journeyStatus === "COMPLETED") {
              sendEvent("journey_ended", { conversationId: id, completedAt: currentTracking.completedAt });
              isClosed = true;
              if (intervalId) clearInterval(intervalId);
              try { controller.close(); } catch {}
            }
          } catch (err) {
            console.error("Tracking stream poll error:", err);
          }
        };

        // Run immediately then poll every 1500ms
        await checkAndSendLocation();
        intervalId = setInterval(checkAndSendLocation, 1500);
      },
      cancel() {
        isClosed = true;
        if (intervalId) clearInterval(intervalId);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("GET /api/rides/conversations/[id]/tracking/stream error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
