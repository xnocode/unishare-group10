"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import "../auth.css";

function VerificationPendingContent() {
  const searchParams = useSearchParams();

  const nameParam = searchParams.get("name") || "Farhana Rahman";
  const emailParam = searchParams.get("email") || "farhana@std.du.ac.bd";
  const universityParam = searchParams.get("university") || "University of Dhaka";
  const studentIdParam = searchParams.get("studentId") || "2023-114-028";

  const firstName = nameParam.split(" ")[0] || "Farhana";

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
        {/* Progress Stepper */}
        <ol className="steps" aria-label="Sign-up progress">
          <li className="done">
            <span aria-label="Step 1 completed">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                aria-hidden="true"
              >
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
            <em>Create account</em>
          </li>
          <li className="done">
            <span aria-label="Step 2 completed">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                aria-hidden="true"
              >
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
            <em>Confirm email</em>
          </li>
          <li className="done">
            <span aria-label="Step 3 completed">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                aria-hidden="true"
              >
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
            <em>Student verification</em>
          </li>
          <li className="on" aria-current="step">
            <span>4</span>
            <em>Review pending</em>
          </li>
        </ol>

        {/* Hero Section */}
        <div className="pending-hero">
          <div className="pending-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="5" y="4" width="14" height="17" rx="2" />
              <path d="M9 4V3h6v1" />
              <path d="M9 13l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1>You’re on your way, {firstName}.</h1>
            <p className="lead">
              Your student verification has been submitted. We’ll take it from here.
            </p>
          </div>
        </div>

        {/* Two-Column Pending Panel */}
        <div className="pending-panel">
          {/* Left: What happens next */}
          <section className="pending-left">
            <span className="status-pill">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              Verification pending
            </span>

            <h2>What happens next?</h2>

            <div className="next-steps-list">
              <div className="next-step-item">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 12l3 3 5-6" />
                </svg>
                <div>
                  <strong>Your details are with us</strong>
                  <p>Student details, ID card and face photo received.</p>
                </div>
              </div>

              <div className="next-step-item">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
                  <circle cx="12" cy="12" r="3" />
                  <path d="M15 15l2 2" />
                </svg>
                <div>
                  <strong>We review your student status</strong>
                  <p>We check that your photos and details match.</p>
                </div>
              </div>

              <div className="next-step-item">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="1.5" />
                  <path d="M3 6l9 7 9-7" />
                </svg>
                <div>
                  <strong>Look out for an email</strong>
                  <p>We’ll email you when you’re approved or if we need anything else.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Right: Your submission */}
          <aside className="pending-right">
            <h2>Your submission</h2>
            <div className="sub-row">
              <small>Student</small>
              <b>{nameParam}</b>
            </div>
            <div className="sub-row">
              <small>University</small>
              <b>{universityParam}</b>
            </div>
            <div className="sub-row">
              <small>University email</small>
              <b>{emailParam}</b>
            </div>
            <div className="sub-row">
              <small>Student ID</small>
              <b>{studentIdParam}</b>
            </div>
            <div className="received-tags">
              <span>✓ ID card received</span>
              <span>✓ Face photo received</span>
            </div>
          </aside>
        </div>

        {/* Bottom Shelf Protection Notice */}
        <div className="shelf-notice">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <div>
            <strong>Your shared shelf opens after approval</strong>
            <p>
              Once approved, you’ll only see items and rides from {universityParam}.
              You won’t be able to rent, lend or share a ride while your
              verification is pending.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pending-foot-actions">
          <div className="left-acts">
            <Link className="btn ghost-home" href="/">
              Back to home
            </Link>
            <Link className="logout-link" href="/login">
              Log out
            </Link>
          </div>
          <p className="help-text">
            Have a question? <Link href="#">Contact support</Link>
          </p>
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

export default function VerificationPendingPage() {
  return (
    <Suspense
      fallback={
        <div className="unishare-auth">
          <div className="wrap" style={{ padding: "80px 0", textAlign: "center" }}>
            Loading...
          </div>
        </div>
      }
    >
      <VerificationPendingContent />
    </Suspense>
  );
}
