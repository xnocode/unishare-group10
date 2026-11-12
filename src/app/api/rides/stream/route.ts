import { NextRequest } from "next/server";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import {
  VALID_GENDER_PREFERENCES,
  GenderPreference,
  validateGenderFilterAccess,
  queryMatchedPartners,
} from "@/app/lib/ride-matching";

// GET /api/rides/stream — Server-Sent Events real-time companion feed
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedRideUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const destination = searchParams.get("destination")?.trim() || "";
  const origin = searchParams.get("origin")?.trim() || "";
  const genderPrefParam = (searchParams.get("genderPreference") || "no_preference").trim().toLowerCase();
  const genderPreference = VALID_GENDER_PREFERENCES.includes(genderPrefParam as GenderPreference)
    ? (genderPrefParam as GenderPreference)
    : "no_preference";

  const policyError = validateGenderFilterAccess(user.gender, genderPreference, "search");
  if (policyError) {
    return new Response(JSON.stringify({ success: false, error: policyError }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const destLat = parseFloat(searchParams.get("destLat") || "");
  const destLng = parseFloat(searchParams.get("destLng") || "");
  const originLat = parseFloat(searchParams.get("originLat") || "");
  const originLng = parseFloat(searchParams.get("originLng") || "");

  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;

  const fetchMatches = () =>
    queryMatchedPartners({
      user,
      browseMode: false,
      destination,
      origin,
      genderPreference,
      destLat: Number.isFinite(destLat) ? destLat : undefined,
      destLng: Number.isFinite(destLng) ? destLng : undefined,
      originLat: Number.isFinite(originLat) ? originLat : undefined,
      originLng: Number.isFinite(originLng) ? originLng : undefined,
      includeActiveExplorers: true,
    });

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "connected", timestamp: Date.now() })}\n\n`)
      );

      if (destination.length >= 2) {
        try {
          const partners = await fetchMatches();
          controller.enqueue(
            encoder.encode(
              `event: matches\ndata: ${JSON.stringify({
                count: partners.length,
                partners,
                timestamp: Date.now(),
              })}\n\n`
            )
          );
        } catch (err) {
          console.error("Initial SSE live match fetch error:", err);
        }
      }

      intervalId = setInterval(async () => {
        if (req.signal.aborted) {
          if (intervalId) clearInterval(intervalId);
          return;
        }

        if (destination.length >= 2) {
          try {
            const partners = await fetchMatches();
            controller.enqueue(
              encoder.encode(
                `event: matches\ndata: ${JSON.stringify({
                  count: partners.length,
                  partners,
                  timestamp: Date.now(),
                })}\n\n`
              )
            );
          } catch (err) {
            console.error("SSE interval fetch error:", err);
          }
        }
      }, 5000);
    },
    cancel() {
      if (intervalId) clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
