import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import { deriveInitials } from "@/app/lib/user-client";

interface PeerCandidate {
  id: string;
  fullName: string;
  initials: string;
  email: string;
  university: string;
  relation: string;
}

// GET /api/wallet/peers — Verified student lookup for peer token transfers (privacy-minimized)
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const q = (new URL(req.url).searchParams.get("q") || "").trim();

    const [recentConvos, recentRentals] = await Promise.all([
      db.travelConversation.findMany({
        where: { OR: [{ participant1Id: user.id }, { participant2Id: user.id }] },
        select: { participant1Id: true, participant2Id: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      db.marketplaceRental.findMany({
        where: { OR: [{ borrowerId: user.id }, { lenderId: user.id }] },
        select: { borrowerId: true, lenderId: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const recentPeerIds = new Set<string>();
    for (const c of recentConvos) {
      const otherId = c.participant1Id === user.id ? c.participant2Id : c.participant1Id;
      if (otherId && otherId !== user.id) recentPeerIds.add(otherId);
    }
    for (const r of recentRentals) {
      const otherId = r.borrowerId === user.id ? r.lenderId : r.borrowerId;
      if (otherId && otherId !== user.id) recentPeerIds.add(otherId);
    }

    const rows = await db.user.findMany({
      where: {
        id: { not: user.id },
        verified: true,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { university: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        university: true,
      },
      orderBy: { createdAt: "desc" },
      take: 24,
    });

    const userUni = (user.university || "").toLowerCase();
    const sorted = [...rows].sort((a, b) => {
      const aRecent = recentPeerIds.has(a.id) ? 1 : 0;
      const bRecent = recentPeerIds.has(b.id) ? 1 : 0;
      if (aRecent !== bRecent) return bRecent - aRecent;

      const aSameUni = (a.university || "").toLowerCase() === userUni ? 1 : 0;
      const bSameUni = (b.university || "").toLowerCase() === userUni ? 1 : 0;
      if (aSameUni !== bSameUni) return bSameUni - aSameUni;

      return a.fullName.localeCompare(b.fullName);
    });

    const peers: PeerCandidate[] = sorted.slice(0, 8).map((row) => ({
      id: row.id,
      fullName: row.fullName,
      initials: deriveInitials(row.fullName),
      email: row.email,
      university: row.university || "Verified Campus",
      relation: recentPeerIds.has(row.id)
        ? "Recent peer"
        : (row.university || "").toLowerCase() === userUni
        ? "Same campus"
        : "Verified student",
    }));

    return NextResponse.json({ ok: true, peers });
  } catch (err) {
    console.error("GET /api/wallet/peers error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to load campus classmates right now." },
      { status: 500 }
    );
  }
}

