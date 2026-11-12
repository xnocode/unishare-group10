import Link from "next/link";
import { UniShareMark } from "../components/UniShareMark";
import "../auth.css";

export default function TermsPage() {
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
          UniShare Community Guidelines
        </p>
        <h1 style={{ marginTop: "8px", fontSize: "clamp(28px, 4vw, 38px)" }}>
          Terms of Use
        </h1>
        <p className="sub" style={{ marginTop: "10px", fontSize: "15px", color: "var(--muted)", lineHeight: 1.6 }}>
          Clear rules to keep peer-to-peer campus rentals, shared rides, and safety tools trustworthy for every verified student.
        </p>

        <div className="card" style={{ marginTop: "24px", padding: "28px", display: "grid", gap: "20px" }}>
          <section>
            <h3 style={{ fontSize: "17px", marginBottom: "6px" }}>1. Verified Student Eligibility</h3>
            <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.65 }}>
              UniShare is reserved strictly for currently enrolled university and college students. Impersonation, fake academic IDs, or multi-account spam results in immediate suspension.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: "17px", marginBottom: "6px" }}>2. Campus Marketplace &amp; Deposit Escrows</h3>
            <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.65 }}>
              Lenders must post accurate item condition, daily token rates, and handover areas on campus. Borrowers must inspect items at handover and return them in agreed condition before deposits are released back to their Campus Wallet.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: "17px", marginBottom: "6px" }}>3. Peer Ride-Partner Code of Conduct</h3>
            <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.65 }}>
              UniShare ride matching pairs verified peers traveling on common routes (CNG, rickshaw, bus, or car share). Always meet at busy on-campus spots and respect gender-only safety preferences.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: "17px", marginBottom: "6px" }}>4. Emergency SOS Responsibility</h3>
            <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.65 }}>
              Reserve SOS alerts for genuine safety situations. Configure trusted family or friend contacts inside{" "}
              <Link href="/sos" style={{ color: "var(--brand)", fontWeight: 700, textDecoration: "underline" }}>
                Campus SOS Settings
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

