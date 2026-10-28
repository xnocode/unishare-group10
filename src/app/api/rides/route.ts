import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import { Prisma } from "@prisma/client";

const VALID_VEHICLES = ["Car", "Rickshaw", "Bike"] as const;
const VALID_GENDER_PREFERENCES = [
  "any",
  "women_only",
  "men_only",
  "no_preference",
] as const;

// POST /api/rides — Create a new ride offer
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Please log in to create a ride offer.",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body provided." },
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
      genderPreference = "any",
      fareTokens = 0,
      notes,
    } = body;

    // Server-side validation
    if (!origin || typeof origin !== "string" || origin.trim().length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid pickup location (origin) is required (min 2 characters).",
        },
        { status: 400 }
      );
    }

    if (
      !destination ||
      typeof destination !== "string" ||
      destination.trim().length < 2
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Valid dropoff location (destination) is required (min 2 characters).",
        },
        { status: 400 }
      );
    }

    if (origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          error: "Origin and destination cannot be the same location.",
        },
        { status: 400 }
      );
    }

    if (!departureTime || isNaN(Date.parse(departureTime))) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid departure date and time format is required (ISO 8601 string).",
        },
        { status: 400 }
      );
    }

    const parsedDepartureTime = new Date(departureTime);
    // Allow up to 15 minutes grace period for clock drift, but reject clearly past rides
    if (parsedDepartureTime.getTime() < Date.now() - 15 * 60 * 1000) {
      return NextResponse.json(
        {
          success: false,
          error: "Departure time cannot be in the past.",
        },
        { status: 400 }
      );
    }

    if (!vehicle || !VALID_VEHICLES.includes(vehicle as (typeof VALID_VEHICLES)[number])) {
      return NextResponse.json(
        {
          success: false,
          error: `Vehicle must be one of: ${VALID_VEHICLES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    if (
      !vehicleModel ||
      typeof vehicleModel !== "string" ||
      vehicleModel.trim().length < 2
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Vehicle model and license/color details are required (min 2 characters).",
        },
        { status: 400 }
      );
    }

    const seatsNum = Number(totalSeats);
    if (!Number.isInteger(seatsNum) || seatsNum < 1 || seatsNum > 6) {
      return NextResponse.json(
        {
          success: false,
          error: "Total available seats must be an integer between 1 and 6.",
        },
        { status: 400 }
      );
    }

    if (
      genderPreference &&
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

    // Atomic transaction: Create ride and enroll host as initial participant
    const ride = await db.ride.create({
      data: {
        hostId: user.id,
        vehicle,
        vehicleModel: vehicleModel.trim(),
        origin: origin.trim(),
        destination: destination.trim(),
        departureTime: parsedDepartureTime,
        totalSeats: seatsNum,
        seatsLeft: seatsNum,
        genderPreference: genderPreference || "any",
        fareTokens: Math.floor(fareNum),
        status: "SCHEDULED",
        notes: notes && typeof notes === "string" ? notes.trim() : null,
        participants: {
          create: {
            userId: user.id,
            role: "HOST",
            seatsOccupied: 0,
            pickupLocation: origin.trim(),
            dropoffLocation: destination.trim(),
            farePaid: 0,
          },
        },
      },
      include: {
        host: {
          select: {
            id: true,
            fullName: true,
            email: true,
            university: true,
            department: true,
            verified: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                university: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Ride offer created successfully.",
        ride,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/rides error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error creating ride." },
      { status: 500 }
    );
  }
}

// GET /api/rides — View available rides with filtering
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Please log in to view rides.",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const origin = searchParams.get("origin")?.trim();
    const destination = searchParams.get("destination")?.trim();
    const vehicle = searchParams.get("vehicle")?.trim();
    const genderPreference = searchParams.get("genderPreference")?.trim();
    const sameUniversityOnly = searchParams.get("sameUniversityOnly") === "true";
    const myRides = searchParams.get("myRides") === "true";
    const status = searchParams.get("status")?.trim() || "SCHEDULED";
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const where: Prisma.RideWhereInput = {};

    if (myRides) {
      // Return rides where the user is either the host or a participant
      where.OR = [
        { hostId: user.id },
        { participants: { some: { userId: user.id } } },
      ];
      if (status !== "ALL") {
        where.status = status;
      }
    } else {
      // Only show scheduled rides with remaining seats
      where.status = status === "ALL" ? undefined : status;
      where.seatsLeft = { gt: 0 };
      // Include rides departing within the future or past 30 minutes
      where.departureTime = { gte: new Date(Date.now() - 30 * 60 * 1000) };

      if (origin) {
        where.origin = { contains: origin };
      }

      if (destination) {
        where.destination = { contains: destination };
      }

      if (vehicle && VALID_VEHICLES.includes(vehicle as (typeof VALID_VEHICLES)[number])) {
        where.vehicle = vehicle;
      }

      if (
        genderPreference &&
        VALID_GENDER_PREFERENCES.includes(
          genderPreference as (typeof VALID_GENDER_PREFERENCES)[number]
        )
      ) {
        where.genderPreference = genderPreference;
      }

      if (sameUniversityOnly && user.university) {
        where.host = {
          university: user.university,
        };
      }
    }

    const rides = await db.ride.findMany({
      where,
      orderBy: { departureTime: "asc" },
      take: limit,
      include: {
        host: {
          select: {
            id: true,
            fullName: true,
            email: true,
            university: true,
            department: true,
            verified: true,
          },
        },
        participants: {
          select: {
            id: true,
            userId: true,
            role: true,
            seatsOccupied: true,
            user: {
              select: {
                id: true,
                fullName: true,
                university: true,
              },
            },
          },
        },
        _count: {
          select: {
            requests: true,
            participants: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: rides.length,
      rides,
    });
  } catch (error) {
    console.error("GET /api/rides error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error fetching rides." },
      { status: 500 }
    );
  }
}
