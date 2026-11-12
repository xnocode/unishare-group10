import Link from "next/link";
import { UniShareMark } from "../components/UniShareMark";
import "../auth.css";

export default function HelpPage() {
  return (
    <div className="unishare-auth">
      <header>
        <div className="wrap">
          <Link href="/" className="logo">
            <UniShareMark size={28} />
            <span>UniShare</span>
          </Link>
          <nav>
            <Link href="/home" className="nav-link">
              Home
            </Link>
            <Link href="/marketplace" className="nav-link">
              Marketplace
            </Link>
            <Link href="/login" className="btn">
              Log in
            </Link>
          </nav>
        </div>
      </header>

      <main className="wrap" style={{ padding: "40px 20px 64px", maxWidth: "820px" }}>
        <p className="eyebrow" style={{ color: "var(--brand)", fontWeight: 700, fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          UniShare Campus Help Center
        </p>
        <h1 style={{ marginTop: "8px", fontSize: "clamp(28px, 4vw, 38px)" }}>
          How can we help?
        </h1>
        <p className="sub" style={{ marginTop: "10px", fontSize: "15px", color: "var(--muted)", lineHeight: 1.6 }}>
          Quick answers for account verification, Marketplace rentals, Ride sharing, Campus Tokens, and SOS tools.
        </p>

        <div className="card" style={{ marginTop: "24px", padding: "28px", display: "grid", gap: "18px" }}>
          <section>
            <h3 style={{ fontSize: "17px", marginBottom: "6px" }}>Didn&apos;t receive your 6-digit email code?</h3>
            <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.65 }}>
              Check your Spam or Promotions folder, confirm your exact university email spelling, and use <strong>Resend code</strong> on the{" "}
              <Link href="/confirm-email" style={{ color: "var(--brand)", fontWeight: 700, textDecoration: "underline" }}>
                Confirm email
              </Link>{" "}
              page.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: "17px", marginBottom: "6px" }}>How do token deposits work for rentals?</h3>
            <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.65 }}>
              When you request to borrow an item, the rental fee + refundable deposit is safely held from your{" "}
              <Link href="/wallet" style={{ color: "var(--brand)", fontWeight: 700, textDecoration: "underline" }}>
                Campus Wallet
              </Link>
              . Once the lender marks the item returned in{" "}
              <Link href="/my-products" style={{ color: "var(--brand)", fontWeight: 700, textDecoration: "underline" }}>
                My Products
              </Link>
              , your full deposit automatically returns to your balance.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: "17px", marginBottom: "6px" }}>Can&apos;t see live peers on Ride Sharing?</h3>
            <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.65 }}>
              Make sure your Student ID verification is completed and your pickup/destination is posted on{" "}
              <Link href="/rides" style={{ color: "var(--brand)", fontWeight: 700, textDecoration: "underline" }}>
                Ride Sharing
              </Link>
              . Peers filtered by &ldquo;Women only&rdquo; or &ldquo;Men only&rdquo; also require selecting your gender in{" "}
              <Link href="/settings" style={{ color: "var(--brand)", fontWeight: 700, textDecoration: "underline" }}>
                Settings
              </Link>
              .
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: "17px", marginBottom: "6px" }}>Need direct campus support?</h3>
            <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.65 }}>
              Email us at{" "}
              <a href="mailto:support@unishare.online" style={{ color: "var(--brand)", fontWeight: 700, textDecoration: "underline" }}>
                support@unishare.online
              </a>{" "}
              from your registered student email, or call Bangladesh National Emergency Service <strong>999</strong> immediately during any physical emergency.
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

