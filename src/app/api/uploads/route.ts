import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import { uploadImageSafely, UploadKind } from "@/app/lib/cloud-storage";

const VALID_KINDS = new Set<UploadKind>(["product", "kyc-id", "kyc-face"]);

// POST /api/uploads — Authenticated cloud image upload (product photos + private KYC ID/selfie)
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized: Please log in to upload files." },
        { status: 401 }
      );
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { ok: false, error: "Multipart form-data request is required." },
        { status: 400 }
      );
    }

    const rawKind = String(formData.get("kind") || "product").trim() as UploadKind;
    if (!VALID_KINDS.has(rawKind)) {
      return NextResponse.json(
        { ok: false, error: "Upload kind must be 'product', 'kyc-id', or 'kyc-face'." },
        { status: 400 }
      );
    }

    const fileEntry = formData.get("file");
    if (!fileEntry || !(fileEntry instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Image file is required." },
        { status: 400 }
      );
    }

    const arrayBuffer = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadImageSafely({
      kind: rawKind,
      userId: user.id,
      buffer,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || "Upload validation failed." },
        { status: result.status || 400 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        kind: rawKind,
        mode: result.mode,
        path: result.path,
        url: result.publicUrl, // Present only for public product photos; undefined for private KYC
        mime: result.mime,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/uploads error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to process uploaded image right now." },
      { status: 500 }
    );
  }
}

