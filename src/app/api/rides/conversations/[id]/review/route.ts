import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/rides/conversations/[id]/review — Fetch review status for this journey
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;
    const conversation = await db.travelConversation.findUnique({
      where: { id },
      include: {
        tracking: true,
        reviews: true,
      },
    });

    if (!conversation) {
      return NextResponse.json({ success: false, error: "Conversation not found." }, { status: 404 });
    }

    const isP1 = conversation.participant1Id === user.id;
    const isP2 = conversation.participant2Id === user.id;
    if (!isP1 && !isP2) {
      return NextResponse.json({ success: false, error: "Forbidden: Not a participant." }, { status: 403 });
    }

    const isJourneyCompleted =
      conversation.tracking?.journeyStatus === "COMPLETED" || conversation.status === "COMPLETED";

    const myReview = conversation.reviews.find((r) => r.reviewerId === user.id) || null;
    const partnerId = isP1 ? conversation.participant2Id : conversation.participant1Id;
    const partner = await db.user.findUnique({
      where: { id: partnerId },
      select: { id: true, fullName: true, university: true, department: true, verified: true },
    });

    return NextResponse.json({
      success: true,
      canReview: isJourneyCompleted,
      isJourneyCompleted,
      myReview,
      hasReviewed: myReview !== null,
      partner: {
        id: partnerId,
        fullName: partner?.fullName || "Travel Partner",
        university: partner?.university || "University of Dhaka",
        department: partner?.department || "Academic Department",
        badge: partner?.verified ? "Verified Student" : "Student",
      },
    });
  } catch (error) {
    console.error("GET /api/rides/conversations/[id]/review error:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}

// POST /api/rides/conversations/[id]/review — Submit rating, written feedback & safety report
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
        reviews: true,
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
        { success: false, error: "Forbidden: Only participants of this journey can submit reviews." },
        { status: 403 }
      );
    }

    // STRICT GUARD: Only completed journeys can be reviewed!
    const isCompleted =
      conversation.tracking?.journeyStatus === "COMPLETED" || conversation.status === "COMPLETED";
    if (!isCompleted) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Reviews can only be submitted after a journey has been marked completed.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rating = Number(body.rating);

    if (isNaN(rating) || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json(
        { success: false, error: "Rating must be an integer between 1 and 5." },
        { status: 400 }
      );
    }

    const feedback = typeof body.feedback === "string" ? body.feedback.trim().slice(0, 1000) : null;
    const reported = Boolean(body.reported);
    const reportCategory = typeof body.reportCategory === "string" ? body.reportCategory.trim().slice(0, 100) : null;
    const reportDetails = typeof body.reportDetails === "string" ? body.reportDetails.trim().slice(0, 2000) : null;

    if (reported && !reportCategory) {
      return NextResponse.json(
        { success: false, error: "Please select a category for the safety report." },
        { status: 400 }
      );
    }

    const partnerId = isP1 ? conversation.participant2Id : conversation.participant1Id;

    // Create or update review
    const review = await db.travelReview.upsert({
      where: {
        conversationId_reviewerId: {
          conversationId: id,
          reviewerId: user.id,
        },
      },
      update: {
        rating,
        feedback,
        reported,
        reportCategory,
        reportDetails,
      },
      create: {
        conversationId: id,
        reviewerId: user.id,
        partnerId,
        rating,
        feedback,
        reported,
        reportCategory,
        reportDetails,
      },
    });

    // If report was submitted, log confidentially
    if (reported) {
      await db.travelMessage.create({
        data: {
          conversationId: id,
          senderId: "system",
          senderName: "Campus Safety Team",
          text: `🛡️ Confidential feedback received. UniShare Safety moderation has been alerted.`,
          messageType: "STATUS_UPDATE",
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: reported
        ? "Your review and safety report have been securely recorded. Thank you for keeping our campus safe."
        : "Thank you for rating your travel partner!",
      review: {
        id: review.id,
        rating: review.rating,
        feedback: review.feedback,
        reported: review.reported,
        reportCategory: review.reportCategory,
        createdAt: review.createdAt,
      },
    });
  } catch (error) {
    console.error("POST /api/rides/conversations/[id]/review error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
