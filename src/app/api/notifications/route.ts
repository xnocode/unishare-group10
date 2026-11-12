import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

// GET /api/notifications — Fetch authenticated user's persistent notifications & unread count
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));

    const [items, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      db.notification.count({ where: { userId: user.id } }),
      db.notification.count({ where: { userId: user.id, unread: true } }),
    ]);

    return NextResponse.json({
      ok: true,
      notifications: items,
      unreadCount,
      total,
      hasMore: offset + items.length < total,
    });
  } catch (err) {
    console.error("GET /api/notifications error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to load notifications." },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications — Mark one or all notifications as read
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      action?: "mark_all_read";
      id?: string;
    } | null;

    if (body?.action === "mark_all_read") {
      await db.notification.updateMany({
        where: { userId: user.id, unread: true },
        data: { unread: false },
      });
    } else if (body?.id) {
      await db.notification.updateMany({
        where: { id: body.id, userId: user.id },
        data: { unread: false },
      });
    } else {
      return NextResponse.json({ ok: false, error: "Provide action or notification id." }, { status: 400 });
    }

    const unreadCount = await db.notification.count({
      where: { userId: user.id, unread: true },
    });

    return NextResponse.json({ ok: true, unreadCount });
  } catch (err) {
    console.error("PATCH /api/notifications error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to update notification status." },
      { status: 500 }
    );
  }
}

