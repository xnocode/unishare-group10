"use client";

import { useState } from "react";
import Link from "next/link";
import "../auth.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("farhana@std.du.ac.bd");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg("Please enter a valid university email.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMsg(`Reset link sent to ${trimmed}. Check your university inbox.`);
    }, 600);
  };

  return (
    <div className="unishare-auth">
      {/* Top Header */}
      <header>
        <div className="wrap">
          <Link href="/" className="logo">
            <svg
              width="22"
              height="14"
              viewBox="0 0 22 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              aria-hidden="true"
            >
              <circle cx="6.5" cy="7" r="4.5" />
              <circle cx="15.5" cy="7" r="4.5" />
            </svg>
            <span>UniShare</span>
          </Link>
          <nav>
            <Link href="/login" className="nav-link">
              Log in
            </Link>
            <Link href="/register" className="btn">
              Create account
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="wrap">
        <div className="grid" style={{ margin: "56px 0 72px" }}>
          {/* Left Column */}
          <section>
            <div className="badge" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="15" cy="9" r="4.5" />
                <path d="M11.8 12.2L4 20v-2.5h2.5V15H9l1.5-1.5M15.5 7.2v.1" />
              </svg>
            </div>

            <h1>
              Can’t remember?
              <br />
              <span style={{ color: "var(--brand)" }}>Let’s get you back.</span>
            </h1>

            <p className="lead" style={{ marginTop: "24px" }}>
              Your campus community isn’t going anywhere. We’ll help you get back
              to your UniShare account.
            </p>

            <div className="next-box" style={{ marginTop: "36px" }}>
              <p className="eyebrow">ACCOUNT RECOVERY</p>
              <h3>Start with your university email.</h3>
              <p>
                Use the same university email you signed up with. We’ll send a link
                to that inbox so you can choose a new password.
              </p>
            </div>
          </section>

          {/* Right Column: Card */}
          <section className="card" aria-labelledby="forgot-title">
            <h2 id="forgot-title">Forgot password?</h2>
            <p className="sub">
              Enter your university email and we’ll send you a password reset link.
            </p>

            <form onSubmit={handleSubmit} noValidate style={{ marginTop: "20px" }}>
              <label className="l" htmlFor="femail">
                University email
              </label>
              <div className="field">
                <input
                  id="femail"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  placeholder="name@university.edu"
                  autoComplete="email"
                  required
                />
                <span className="ic static" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </span>
              </div>
              <p className={`hint ${errorMsg ? "error" : ""}`}>
                {errorMsg ||
                  "Use the university email linked to your UniShare account, not your personal email."}
              </p>

              <button
                className="btn btn-lg"
                type="submit"
                disabled={isSubmitting}
                style={{ marginTop: "12px" }}
              >
                <span>{isSubmitting ? "Sending link..." : "Send reset link"}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </button>

              {successMsg && (
                <div className="ok" role="status" style={{ marginTop: "14px" }}>
                  <p>{successMsg}</p>
                  <Link
                    href={`/reset-password?email=${encodeURIComponent(email)}`}
                    style={{
                      display: "inline-block",
                      marginTop: "8px",
                      textDecoration: "underline",
                      fontWeight: 600,
                    }}
                  >
                    Open reset password page (Demo) →
                  </Link>
                </div>
              )}

              <p className="center" style={{ marginTop: "20px" }}>
                <Link href="/login" className="back-login-link">
                  Back to log in
                </Link>
              </p>

              {/* Info banner */}
              <div className="card-info-box">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="2" y="5" width="20" height="14" rx="1.5" />
                  <path d="M2 6l10 7 10-7" />
                </svg>
                <div>
                  <b>Check your university inbox</b>
                  <p>
                    If an account exists for this email, you’ll receive a reset link.
                    Check your spam folder too.
                  </p>
                </div>
              </div>
            </form>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <nav>
            <Link href="#">Privacy</Link>
            <Link href="#">Terms</Link>
            <Link href="#">Get help</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

