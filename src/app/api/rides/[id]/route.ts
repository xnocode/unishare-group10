import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

const VALID_VEHICLES = ["Car", "Rickshaw", "Bike"] as const;
const VALID_GENDER_PREFERENCES = [
  "any",
  "women_only",
  "men_only",
  "no_preference",
] as const;
const VALID_STATUSES = ["SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"] as const;

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/rides/[id] — View specific ride details
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Please log in to view ride details.",
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Ride ID is required." },
        { status: 400 }
      );
    }

    const ride = await db.ride.findUnique({
      where: { id },
      include: {
        host: {
          select: {
            id: true,
            fullName: true,
            email: true,
            university: true,
            department: true,
            studentId: true,
            verified: true,
            tokenBalance: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                university: true,
                department: true,
                verified: true,
              },
            },
          },
        },
        requests: {
          where:
            user.id === (await db.ride.findUnique({ where: { id }, select: { hostId: true } }))?.hostId
              ? undefined // Host sees all requests
              : { passengerId: user.id }, // Regular passenger only sees their own requests
          include: {
            passenger: {
              select: {
                id: true,
                fullName: true,
                university: true,
                verified: true,
              },
            },
          },
        },
      },
    });

    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride offer not found." },
        { status: 404 }
      );
    }

    const isHost = ride.hostId === user.id;
    const isParticipant = ride.participants.some((p) => p.userId === user.id);

    return NextResponse.json({
      success: true,
      ride,
      viewerRole: isHost ? "HOST" : isParticipant ? "PARTICIPANT" : "PASSENGER",
    });
  } catch (error) {
    console.error("GET /api/rides/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error fetching ride details." },
      { status: 500 }
    );
  }
}

// PATCH /api/rides/[id] — Update ride information (Host only)
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Please log in to update ride information.",
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Ride ID is required." },
        { status: 400 }
      );
    }

    // Check ride existence and verify authorization
    const existingRide = await db.ride.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!existingRide) {
      return NextResponse.json(
        { success: false, error: "Ride offer not found." },
        { status: 404 }
      );
    }

    // Authorization: Only the creator/host can update ride details
    if (existingRide.hostId !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: You are not authorized to update this ride.",
        },
        { status: 403 }
      );
    }

    // State check: Cannot edit finished or cancelled rides
    if (existingRide.status === "CANCELLED" || existingRide.status === "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot modify a ride that is already ${existingRide.status.toLowerCase()}.`,
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid JSON update payload provided." },
        { status: 400 }
      );
    }

    const {
      origin,
      destination,
      departureTime,
      vehicle,
      vehicleModel,
      totalSeats,
      genderPreference,
      fareTokens,
      status,
      notes,
    } = body;

    const dataToUpdate: Record<string, unknown> = {};

    // Validate origin
    if (origin !== undefined) {
      if (typeof origin !== "string" || origin.trim().length < 2) {
        return NextResponse.json(
          { success: false, error: "Origin must be at least 2 characters." },
          { status: 400 }
        );
      }
      dataToUpdate.origin = origin.trim();
    }

    // Validate destination
    if (destination !== undefined) {
      if (typeof destination !== "string" || destination.trim().length < 2) {
        return NextResponse.json(
          {
            success: false,
            error: "Destination must be at least 2 characters.",
          },
          { status: 400 }
        );
      }
      dataToUpdate.destination = destination.trim();
    }

    if (
      (dataToUpdate.origin || existingRide.origin) ===
      (dataToUpdate.destination || existingRide.destination)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Origin and destination cannot be identical.",
        },
        { status: 400 }
      );
    }

    // Validate departure time
    if (departureTime !== undefined) {
      if (isNaN(Date.parse(departureTime))) {
        return NextResponse.json(
          { success: false, error: "Invalid departure time format." },
          { status: 400 }
        );
      }
      const parsedTime = new Date(departureTime);
      if (parsedTime.getTime() < Date.now() - 15 * 60 * 1000) {
        return NextResponse.json(
          { success: false, error: "Departure time cannot be in the past." },
          { status: 400 }
        );
      }
      dataToUpdate.departureTime = parsedTime;
    }

    // Validate vehicle
    if (vehicle !== undefined) {
      if (!VALID_VEHICLES.includes(vehicle as (typeof VALID_VEHICLES)[number])) {
        return NextResponse.json(
          {
            success: false,
            error: `Vehicle must be one of: ${VALID_VEHICLES.join(", ")}.`,
          },
          { status: 400 }
        );
      }
      dataToUpdate.vehicle = vehicle;
    }

    // Validate vehicle model
    if (vehicleModel !== undefined) {
      if (typeof vehicleModel !== "string" || vehicleModel.trim().length < 2) {
        return NextResponse.json(
          {
            success: false,
            error: "Vehicle model must be at least 2 characters.",
          },
          { status: 400 }
        );
      }
      dataToUpdate.vehicleModel = vehicleModel.trim();
    }

    // Validate seats
    if (totalSeats !== undefined) {
      const newTotal = Number(totalSeats);
      if (!Number.isInteger(newTotal) || newTotal < 1 || newTotal > 6) {
        return NextResponse.json(
          {
            success: false,
            error: "Total seats must be an integer between 1 and 6.",
          },
          { status: 400 }
        );
      }

      // Calculate seats currently occupied by passengers
      const occupiedSeats = existingRide.totalSeats - existingRide.seatsLeft;
      if (newTotal < occupiedSeats) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot reduce total seats to ${newTotal} because ${occupiedSeats} seats are already booked.`,
          },
          { status: 400 }
        );
      }

      dataToUpdate.totalSeats = newTotal;
      dataToUpdate.seatsLeft = newTotal - occupiedSeats;
    }

    // Validate gender preference
    if (genderPreference !== undefined) {
      if (
        !VALID_GENDER_PREFERENCES.includes(
          genderPreference as (typeof VALID_GENDER_PREFERENCES)[number]
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Gender preference must be one of: ${VALID_GENDER_PREFERENCES.join(
              ", "
            )}.`,
          },
          { status: 400 }
        );
      }
      dataToUpdate.genderPreference = genderPreference;
    }

    // Validate fare tokens
    if (fareTokens !== undefined) {
      const fareNum = Number(fareTokens);
      if (isNaN(fareNum) || fareNum < 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Fare tokens must be a non-negative number.",
          },
          { status: 400 }
        );
      }
      dataToUpdate.fareTokens = Math.floor(fareNum);
    }

    // Validate status
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
        return NextResponse.json(
          {
            success: false,
            error: `Status must be one of: ${VALID_STATUSES.join(", ")}.`,
          },
          { status: 400 }
        );
      }
      dataToUpdate.status = status;
    }

    // Optional notes
    if (notes !== undefined) {
      dataToUpdate.notes =
        typeof notes === "string" ? notes.trim() : null;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields provided for update." },
        { status: 400 }
      );
    }

    const updatedRide = await db.ride.update({
      where: { id },
      data: dataToUpdate,
      include: {
        host: {
          select: {
            id: true,
            fullName: true,
            email: true,
            university: true,
            verified: true,
          },
        },
        participants: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Ride information updated successfully.",
      ride: updatedRide,
    });
  } catch (error) {
    console.error("PATCH /api/rides/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error updating ride." },
      { status: 500 }
    );
  }
}

// DELETE /api/rides/[id] — Cancel a ride (Host only)
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Please log in to cancel this ride.",
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Ride ID is required." },
        { status: 400 }
      );
    }

    const ride = await db.ride.findUnique({
      where: { id },
    });

    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride offer not found." },
        { status: 404 }
      );
    }

    // Authorization: Only the creator/host can cancel their ride
    if (ride.hostId !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Only the ride host can cancel this ride offer.",
        },
        { status: 403 }
      );
    }

    if (ride.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "Ride is already cancelled." },
        { status: 400 }
      );
    }

    if (ride.status === "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot cancel a ride that has already been completed.",
        },
        { status: 400 }
      );
    }

    // Cancel the ride and cascade cancellation to pending requests
    const cancelledRide = await db.$transaction(async (tx) => {
      // 1. Mark ride as CANCELLED
      const updated = await tx.ride.update({
        where: { id },
        data: {
          status: "CANCELLED",
          seatsLeft: 0,
        },
      });

      // 2. Mark any non-rejected requests as CANCELLED
      await tx.rideRequest.updateMany({
        where: {
          rideId: id,
          status: { in: ["PENDING", "ACCEPTED"] },
        },
        data: {
          status: "CANCELLED",
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: "Ride has been successfully cancelled.",
      rideId: cancelledRide.id,
      status: cancelledRide.status,
    });
  } catch (error) {
    console.error("DELETE /api/rides/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error cancelling ride." },
      { status: 500 }
    );
  }
}
