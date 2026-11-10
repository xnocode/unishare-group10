import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import { createPrivateKycSignedUrl } from "@/app/lib/cloud-storage";

// GET /api/uploads/signed-url?kind=idCard|face — Issue 60s private preview link strictly to document owner
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind");
    if (kind !== "idCard" && kind !== "face") {
      return NextResponse.json(
        { ok: false, error: "Specify kind=idCard or kind=face." },
        { status: 400 }
      );
    }

    const record = await db.user.findUnique({
      where: { id: user.id },
      select: { idCardPhotoPath: true, facePhotoPath: true },
    });

    const objectPath = kind === "idCard" ? record?.idCardPhotoPath : record?.facePhotoPath;
    if (!objectPath) {
      return NextResponse.json(
        { ok: false, error: "No uploaded verification document found." },
        { status: 404 }
      );
    }

    const signed = await createPrivateKycSignedUrl(objectPath, 60);
    if (!signed.ok || !signed.url) {
      return NextResponse.json(
        { ok: false, error: signed.error || "Unable to issue signed preview URL." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      url: signed.url,
      expiresInSeconds: 60,
    });
  } catch (err) {
    console.error("GET /api/uploads/signed-url error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to create signed URL." },
      { status: 500 }
    );
  }
}

