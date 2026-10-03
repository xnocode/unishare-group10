"use client";

import { useState } from "react";
import Link from "next/link";
import "../auth.css";

export default function LoginPage() {
  const [email, setEmail] = useState("farhana@std.du.ac.bd");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email.trim() || !password) {
      setErrorMsg("Please enter both your university email and password.");
      return;
    }

    setIsLoggingIn(true);
    setTimeout(() => {
      setIsLoggingIn(false);
      setSuccessMsg("Logged in successfully! Redirecting to campus shelf...");
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
            <Link href="/login" className="nav-link" style={{ color: "var(--brand)" }}>
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
        <div className="login-grid">
          {/* Left Column */}
          <section>
            <p className="kicker">GOOD TO HAVE YOU BACK</p>
            <h1>
              Your campus.
              <span style={{ display: "block", color: "var(--brand)" }}>
                Still sharing.
              </span>
            </h1>
            <p className="lead">
              Sign in to access your shared items, manage requests, and keep your
              campus activity organized.
            </p>
            <p className="note" style={{ marginTop: "20px" }}>
              Only your university. Only verified students.
            </p>

            <p
              className="kicker"
              style={{
                marginTop: "32px",
                marginBottom: "12px",
                letterSpacing: "0.08em",
              }}
            >
              WHAT YOU CAN DO
            </p>
            <ul className="login-features">
              <li>
                <span className="f-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
                    <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
                  </svg>
                </span>
                <div>
                  <h3>Access your items</h3>
                  <p>
                    See what you’ve shared, borrowed, and requested in one place.
                  </p>
                </div>
              </li>

              <li>
                <span className="f-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="9" cy="8" r="3.5" />
                    <path d="M2.5 20v-1a6 6 0 0 1 6-6h1a6 6 0 0 1 6 6v1" />
                    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
                    <path d="M21.5 20v-1a6 6 0 0 0-3.5-5.4" />
                  </svg>
                </span>
                <div>
                  <h3>Manage requests</h3>
                  <p>
                    Review incoming requests, approve handoffs, and keep conversations
                    organized.
                  </p>
                </div>
              </li>

              <li>
                <span className="f-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" />
                    <path d="M9 12l2.2 2.2L15.5 10" />
                  </svg>
                </span>
                <div>
                  <h3>Keep your campus activity secure</h3>
                  <p>
                    Only verified students can access your shared items and
                    requests.
                  </p>
                </div>
              </li>
            </ul>
          </section>

          {/* Right Column: Login Card */}
          <section className="card" aria-labelledby="login-title">
            <h2 id="login-title">Welcome back</h2>
            <p className="sub">
              Log in to your UniShare account with your university email.
            </p>

            <form onSubmit={handleLogin} noValidate>
              {/* University Email */}
              <label className="l" htmlFor="email">
                University email
              </label>
              <div className="field">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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

              {/* Password */}
              <label className="l" htmlFor="password" style={{ marginTop: "18px" }}>
                Password
              </label>
              <div className="field">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="ic"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-3.2 3.7M6.6 6.7A16 16 0 0 0 3 12s4 6 9 6c1.5 0 2.8-.4 4-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Keep logged in and Forgot password */}
              <div className="login-row">
                <label className="agree" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Keep me logged in</span>
                </label>
                <Link href="#" className="forgot-link">
                  Forgot password?
                </Link>
              </div>

              {errorMsg && (
                <div className="err-banner" role="alert" style={{ marginTop: "16px" }}>
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="ok" role="status" style={{ marginTop: "16px" }}>
                  {successMsg}
                </div>
              )}

              {/* Submit Button */}
              <button
                className="btn btn-lg"
                type="submit"
                disabled={isLoggingIn}
                style={{ marginTop: "22px" }}
              >
                <span>{isLoggingIn ? "Logging in..." : "Log in"}</span>
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

              <p className="center big" style={{ marginTop: "20px" }}>
                New to UniShare? <Link href="/register">Create account</Link>
              </p>

              {/* Not Verified Yet Box */}
              <div className="verify-notice">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" />
                  <path d="M9 12l2.2 2.2L15.5 10" />
                </svg>
                <div>
                  <strong>Not verified yet? No worries.</strong>
                  <p>
                    Log in to finish your student verification or check whether your
                    submission is still under review.
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
