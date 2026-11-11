import crypto from "crypto";

export type UploadKind = "product" | "kyc-id" | "kyc-face";

interface DetectedImage {
  mime: "image/jpeg" | "image/png" | "image/webp";
  ext: "jpg" | "png" | "webp";
}

interface SupabaseStorageConfig {
  url: string;
  serviceRoleKey: string;
  productsBucket: string;
  kycBucket: string;
}

const MAX_SIZE_BYTES: Record<UploadKind, number> = {
  product: 2_000_000, // 2 MB
  "kyc-id": 4_000_000, // 4 MB
  "kyc-face": 4_000_000, // 4 MB
};

/** Inspect binary header bytes so fake file extensions and SVG/script uploads are rejected. */
export function detectImageFormat(buffer: Buffer): DetectedImage | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }

  return null;
}

export function getSupabaseStorageConfig(): SupabaseStorageConfig | null {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  const serviceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  ).trim();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return {
    url,
    serviceRoleKey,
    productsBucket: (process.env.SUPABASE_PRODUCTS_BUCKET || "product-photos").trim(),
    kycBucket: (process.env.SUPABASE_KYC_BUCKET || "kyc-documents").trim(),
  };
}

function buildSupabaseAuthHeaders(
  apiKey: string,
  extra?: Record<string, string>
): Record<string, string> {
  // New opaque sb_secret_ keys authenticate via `apikey`; sending them as Bearer tokens fails JWT parsing.
  const baseHeaders: Record<string, string> = apiKey.startsWith("sb_secret_")
    ? { apikey: apiKey }
    : {
        Authorization: `Bearer ${apiKey}`,
        apikey: apiKey,
      };
  return extra ? { ...baseHeaders, ...extra } : baseHeaders;
}

async function ensureBucketExists(
  cfg: SupabaseStorageConfig,
  bucketName: string,
  isPublic: boolean
) {
  const checkRes = await fetch(`${cfg.url}/storage/v1/bucket/${encodeURIComponent(bucketName)}`, {
    method: "GET",
    headers: buildSupabaseAuthHeaders(cfg.serviceRoleKey),
  });

  if (checkRes.ok) return;

  await fetch(`${cfg.url}/storage/v1/bucket`, {
    method: "POST",
    headers: buildSupabaseAuthHeaders(cfg.serviceRoleKey, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      id: bucketName,
      name: bucketName,
      public: isPublic,
      file_size_limit: isPublic ? 2_097_152 : 4_194_304,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
    }),
  });
}

export interface CloudUploadResult {
  ok: boolean;
  mode?: "supabase" | "inline-fallback";
  bucket?: string;
  path?: string;
  publicUrl?: string;
  mime?: string;
  error?: string;
  status?: number;
}

/**
 * Validates raw uploaded image bytes and pushes to Supabase private/public storage buckets.
 * Falls back cleanly in local development when cloud credentials are not configured yet,
 * without storing sensitive raw KYC images onto the local PC filesystem.
 */
export async function uploadImageSafely(params: {
  kind: UploadKind;
  userId: string;
  buffer: Buffer;
}): Promise<CloudUploadResult> {
  const { kind, userId, buffer } = params;
  const maxBytes = MAX_SIZE_BYTES[kind];

  if (buffer.length === 0) {
    return { ok: false, error: "Uploaded image file is empty.", status: 400 };
  }

  if (buffer.length > maxBytes) {
    const mb = (maxBytes / 1_000_000).toFixed(1);
    return {
      ok: false,
      error: `Image size exceeds ${mb} MB limit.`,
      status: 400,
    };
  }

  const detected = detectImageFormat(buffer);
  if (!detected) {
    return {
      ok: false,
      error: "Only genuine JPG, PNG, or WebP images are supported (SVG/HTML blocked for security).",
      status: 400,
    };
  }

  const safeUserFolder = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "student";
  const fileKey = `${kind === "product" ? "products" : "kyc"}/${safeUserFolder}/${kind}-${crypto.randomUUID()}.${detected.ext}`;
  const isPublicBucket = kind === "product";

  const supabase = getSupabaseStorageConfig();
  if (supabase) {
    const bucket = isPublicBucket ? supabase.productsBucket : supabase.kycBucket;
    try {
      await ensureBucketExists(supabase, bucket, isPublicBucket);

      const uploadRes = await fetch(
        `${supabase.url}/storage/v1/object/${encodeURIComponent(bucket)}/${fileKey}`,
        {
          method: "POST",
          headers: buildSupabaseAuthHeaders(supabase.serviceRoleKey, {
            "Content-Type": detected.mime,
            "x-upsert": "false",
          }),
          body: new Uint8Array(buffer),
        }
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => "");
        console.error("Supabase Storage upload error:", uploadRes.status, errText);
        return {
          ok: false,
          error: "Cloud storage upload failed. Verify your Supabase bucket configuration.",
          status: 502,
        };
      }

      return {
        ok: true,
        mode: "supabase",
        bucket,
        path: fileKey,
        // Strictly omit publicUrl for private KYC verification photos
        publicUrl: isPublicBucket
          ? `${supabase.url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${fileKey}`
          : undefined,
        mime: detected.mime,
      };
    } catch (err) {
      console.error("Cloud upload network failure:", err);
      return {
        ok: false,
        error: "Unable to reach cloud object storage right now.",
        status: 502,
      };
    }
  }

  // Fallback when Supabase storage keys are not set yet (keeps zero user photos saved on local PC disk)
  if (isPublicBucket) {
    const dataUri = `data:${detected.mime};base64,${buffer.toString("base64")}`;
    return {
      ok: true,
      mode: "inline-fallback",
      path: fileKey,
      publicUrl: dataUri,
      mime: detected.mime,
    };
  }

  return {
    ok: true,
    mode: "inline-fallback",
    path: `verified-upload://${fileKey}`,
    mime: detected.mime,
  };
}

/** Generate a short-lived signed download URL for private Student ID / selfie photos. */
export async function createPrivateKycSignedUrl(
  objectPath: string,
  expiresInSeconds = 60
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!objectPath || objectPath.startsWith("verified-upload://")) {
    return {
      ok: false,
      error: "File preview requires Supabase private storage keys to be configured.",
    };
  }

  const supabase = getSupabaseStorageConfig();
  if (!supabase) {
    return {
      ok: false,
      error: "Supabase storage environment variables are not configured.",
    };
  }

  try {
    const res = await fetch(
      `${supabase.url}/storage/v1/object/sign/${encodeURIComponent(supabase.kycBucket)}/${objectPath}`,
      {
        method: "POST",
        headers: buildSupabaseAuthHeaders(supabase.serviceRoleKey, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ expiresIn: expiresInSeconds }),
      }
    );

    const data = (await res.json().catch(() => null)) as { signedURL?: string } | null;
    if (!res.ok || !data?.signedURL) {
      return { ok: false, error: "Could not issue signed private preview URL." };
    }

    const fullSigned = data.signedURL.startsWith("http")
      ? data.signedURL
      : `${supabase.url}/storage/v1${data.signedURL}`;

    return { ok: true, url: fullSigned };
  } catch (err) {
    console.error("Signed URL error:", err);
    return { ok: false, error: "Failed to generate signed URL." };
  }
}

