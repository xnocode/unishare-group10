import Link from "next/link";
import { UniShareMark } from "../components/UniShareMark";
import "../auth.css";

export default function PrivacyPage() {
  return (
    <div className="unishare-auth">
      <header>
        <div className="wrap">
          <Link href="/" className="logo">
            <UniShareMark size={28} />
            <span>UniShare</span>
          </Link>
          <nav>
            <Link href="/marketplace" className="nav-link">
              Marketplace
            </Link>
            <Link href="/rides" className="nav-link">
              Ride sharing
            </Link>
            <Link href="/login" className="btn">
              Log in
            </Link>
          </nav>
        </div>
      </header>

      <main className="wrap" style={{ padding: "40px 20px 64px", maxWidth: "780px" }}>
        <p className="eyebrow" style={{ color: "var(--brand)", fontWeight: 700, fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          UniShare Campus Trust &amp; Privacy
        </p>
        <h1 style={{ marginTop: "8px", fontSize: "clamp(28px, 4vw, 38px)" }}>
          Privacy Policy
        </h1>
        <p className="sub" style={{ marginTop: "10px", fontSize: "15px", color: "var(--muted)", lineHeight: 1.6 }}>
          How UniShare protects your student identity, verification documents, live ride coordinates, and campus account data.
        </p>

        <div className="card" style={{ marginTop: "24px", padding: "28px", display: "grid", gap: "20px" }}>
          <section>
            <h3 style={{ fontSize: "17px", marginBottom: "6px" }}>1. Student Identity &amp; Private KYC Bucket</h3>
            <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.65 }}>
              Uploaded student ID card photos and selfie verification images are stored in a strictly private Supabase storage bucket (`kyc-documents`) and are never exposed on public product or profile pages. Only time-limited signed URLs are used for authorized verification access.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: "17px", marginBottom: "6px" }}>2. Password &amp; Session Security</h3>
            <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.65 }}>
              Passwords are salted and hashed with `scrypt` before being saved to PostgreSQL. Active sessions use HTTP-only HMAC-signed cookies with zero plaintext password storage.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: "17px", marginBottom: "6px" }}>3. Ride Sharing &amp; SOS Location Data</h3>
            <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.65 }}>
              Live ride-partner GPS coordinates are shared strictly inside mutual consented trip sessions and stop immediately when either partner ends tracking. Gender preferences (`Women only` / `Men only`) are used strictly for route-matching safety filters.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: "17px", marginBottom: "6px" }}>4. Managing or Removing Your Data</h3>
            <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.65 }}>
              You can update your profile details, academic department, ride safety preference, or emergency contacts anytime from{" "}
              <Link href="/settings" style={{ color: "var(--brand)", fontWeight: 700, textDecoration: "underline" }}>
                Account Settings
              </Link>
              .
            </p>
          </section>
        </div>
      </main>

      <footer>
        <div className="wrap">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <nav>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/help">Get help</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

