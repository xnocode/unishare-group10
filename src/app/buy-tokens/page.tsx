"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNavbar from "../components/AppNavbar";
import {
  clearClientSession,
  saveClientUser,
  useCurrentUser,
  useRequireAuth,
  type ClientUser,
} from "../lib/user-client";
import "./buy-tokens.css";

const PACKAGE_META: Record<
  number,
  { id: "starter" | "campus" | "scholar"; bonus: number; bdt: number }
> = {
  100: { id: "starter", bonus: 0, bdt: 100 },
  250: { id: "campus", bonus: 15, bdt: 250 },
  500: { id: "scholar", bonus: 40, bdt: 500 },
};

export default function BuyTokensPage() {
  const router = useRouter();
  const { resolvedUser, firstName } = useCurrentUser();
  const isAuthenticated = useRequireAuth("/buy-tokens");
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTokens, setSelectedTokens] = useState(250);
  const [selectedPayment, setSelectedPayment] = useState("bKash");
  const [senderPhone, setSenderPhone] = useState("");
  const [trxId, setTrxId] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [creditedAmount, setCreditedAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchedBalance, setFetchedBalance] = useState<number | null>(null);
  const balance = fetchedBalance ?? resolvedUser.tokenBalance;
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !resolvedUser.email) return;
    let active = true;
    fetch("/api/wallet", {
      headers: { "x-user-email": resolvedUser.email },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ok?: boolean; tokenBalance?: number } | null) => {
        if (active && d?.ok && typeof d.tokenBalance === "number") {
          setFetchedBalance(d.tokenBalance);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAuthenticated, resolvedUser.email]);

  const uniPrefix = (
    resolvedUser.universityId ||
    resolvedUser.university
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 4) ||
    "UNI"
  )
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const refTag = `${uniPrefix || "UNI"}-${firstName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")}`;

  const selectedMeta = PACKAGE_META[selectedTokens] || PACKAGE_META[250];
  const expectedTotalTokens = selectedTokens + selectedMeta.bonus;

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2600);
  };

  const handleLogout = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    clearClientSession();
    router.push("/login");
  };

  const handlePackageSelect = (tokens: number) => {
    setSelectedTokens(tokens);
    setCurrentStep(2);
    triggerToast(`Selected ${tokens} tokens package`);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const cleanPhone = senderPhone.replace(/[\s-]/g, "");
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      triggerToast("Enter a valid 11-digit Bangladesh mobile number (e.g., 017XXXXXXXX).");
      return;
    }
    const cleanTrx = trxId.trim();
    if (cleanTrx.length < 4) {
      triggerToast("Please enter a valid payment Transaction ID (min 4 characters).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": resolvedUser.email,
        },
        body: JSON.stringify({
          packageId: selectedMeta.id,
          method: selectedPayment,
          senderPhone: cleanPhone,
          trxRef: cleanTrx,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        creditedTokens?: number;
        tokenBalance?: number;
        user?: ClientUser;
      } | null;

      if (!res.ok || !data?.ok) {
        triggerToast(data?.error || "Could not process token top-up.");
        return;
      }

      if (data.user) saveClientUser(data.user);
      if (typeof data.tokenBalance === "number") setFetchedBalance(data.tokenBalance);
      setCreditedAmount(data.creditedTokens || expectedTotalTokens);
      setPaymentRef(cleanTrx);
      setCurrentStep(5);
      triggerToast(`+${data.creditedTokens || expectedTotalTokens} tokens credited to your wallet!`);
    } catch {
      triggerToast("Network error while processing token top-up.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="unishare-buy-tokens" style={{ minHeight: "100vh", background: "#ffffff" }}>
        <AppNavbar activeNav="wallet" />
        <main style={{ maxWidth: "1000px", width: "100%", margin: "24px auto", padding: "0 24px" }}>
          <div style={{ height: "38px", width: "240px", borderRadius: "8px", background: "#f5f7f6", marginBottom: "18px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px" }}>
            <div style={{ height: "260px", borderRadius: "12px", background: "#e9f2ef" }} />
            <div style={{ height: "260px", borderRadius: "12px", background: "#f5f7f6", border: "1px solid #d5dcda" }} />
            <div style={{ height: "260px", borderRadius: "12px", background: "#f5f7f6", border: "1px solid #d5dcda" }} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="unishare-buy-tokens">
      <AppNavbar
        activeNav="wallet"
        user={{ tokenBalance: balance }}
        onLogout={handleLogout}
        onSos={() =>
          triggerToast("Emergency Campus SOS: Campus security contacted.")
        }
      />

      {/* Main Content */}
      <main>
        {/* Breadcrumbs */}
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/home">Home</Link>
          <span>›</span>
          <Link href="/wallet">Wallet</Link>
          <span>›</span>
          <span className="cur">Token packages</span>
        </nav>

        <div className="eyebrow">{resolvedUser.university} · Verified students only</div>

        {/* Title Row */}
        <div className="title-row">
          <div>
            <h1>Token packages</h1>
            <p className="sub-title">
              Choose how many tokens you’d like to add to your wallet.
            </p>
          </div>
          <span className="pill">{balance} available tokens</span>
        </div>

        {/* Campus Banner */}
        <div className="campus">
          <div className="l">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0b5d5b"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" />
              <path d="M8.5 12l2.5 2.5 4.5-5" />
            </svg>
            <b>{resolvedUser.university}</b>
            <span>
              Your wallet for sharing with verified students on your campus.
            </span>
          </div>
          <div className="r">
            {resolvedUser.verified ? "Verified student" : "Student member"}
          </div>
        </div>

        {/* 5-Step Stepper */}
        <div className="stepper">
          <div
            className={`step ${currentStep === 1 ? "on" : currentStep > 1 ? "done" : ""}`}
            onClick={() => setCurrentStep(1)}
          >
            <span className="n">{currentStep > 1 ? "✓" : "1"}</span>
            Package
          </div>
          <div className="bar" />

          <div
            className={`step ${currentStep === 2 ? "on" : currentStep > 2 ? "done" : ""}`}
            onClick={() => setCurrentStep(2)}
          >
            <span className="n">{currentStep > 2 ? "✓" : "2"}</span>
            Order review
          </div>
          <div className="bar" />

          <div
            className={`step ${currentStep === 3 ? "on" : currentStep > 3 ? "done" : ""}`}
            onClick={() => setCurrentStep(3)}
          >
            <span className="n">{currentStep > 3 ? "✓" : "3"}</span>
            Payment method
          </div>
          <div className="bar" />

          <div
            className={`step ${currentStep === 4 ? "on" : currentStep > 4 ? "done" : ""}`}
            onClick={() => setCurrentStep(4)}
          >
            <span className="n">{currentStep > 4 ? "✓" : "4"}</span>
            Submit details
          </div>
          <div className="bar" />

          <div className={`step ${currentStep === 5 ? "on" : ""}`}>
            <span className="n">5</span>
            Verification
          </div>
        </div>

        {/* Step 1: Package Selection */}
        {currentStep === 1 && (
          <>
            <h2 className="sec">Pick your next top-up</h2>
            <p className="note">
              Illustrative token quantities. Your external payment amount is shown
              at checkout.
            </p>

            <div className="cards">
              {/* 100 Tokens */}
              <div
                className={`card ${selectedTokens === 100 ? "sel" : ""}`}
                onClick={() => setSelectedTokens(100)}
              >
                <div className="top">
                  <span className="tag">A little top-up</span>
                  {selectedTokens === 100 && (
                    <span className="badge">Selected</span>
                  )}
                </div>
                <div className="coins">
                  <svg width="130" height="64" viewBox="0 0 130 64">
                    <ellipse cx="65" cy="52" rx="58" ry="5" fill="#e4efec" />
                    <circle
                      cx="76"
                      cy="27"
                      r="21"
                      fill="#0b5d5b"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="76"
                      cy="27"
                      r="14"
                      fill="none"
                      stroke="#fff"
                      strokeOpacity=".35"
                      strokeWidth="1"
                    />
                    <text
                      x="76"
                      y="34"
                      textAnchor="middle"
                      fontFamily="var(--font-bricolage), Bricolage Grotesque, sans-serif"
                      fontWeight="700"
                      fontSize="20"
                      fill="#fff"
                    >
                      u
                    </text>
                    <circle
                      cx="42"
                      cy="35"
                      r="20"
                      fill="#fff"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <text
                      x="42"
                      y="42"
                      textAnchor="middle"
                      fontFamily="var(--font-bricolage), Bricolage Grotesque, sans-serif"
                      fontWeight="700"
                      fontSize="20"
                      fill="#0b5d5b"
                    >
                      u
                    </text>
                  </svg>
                </div>
                <div className="amount">100 tokens</div>
                <p className="desc">
                  Keep a few extra tokens ready for your next campus plan.
                </p>
                <hr className="rule" />
                <div className="pay">Payment amount provided at checkout</div>
                <button
                  className={`btn ${selectedTokens === 100 ? "primary" : ""}`}
                  type="button"
                  onClick={() => handlePackageSelect(100)}
                >
                  {selectedTokens === 100
                    ? "Continue with 100 tokens"
                    : "Choose 100 tokens"}
                </button>
              </div>

              {/* 250 Tokens */}
              <div
                className={`card ${selectedTokens === 250 ? "sel" : ""}`}
                onClick={() => setSelectedTokens(250)}
              >
                <div className="top">
                  <span className="tag">Ready for the week</span>
                  {selectedTokens === 250 && (
                    <span className="badge">Selected</span>
                  )}
                </div>
                <div className="coins">
                  <svg width="130" height="64" viewBox="0 0 130 64">
                    <ellipse cx="65" cy="52" rx="58" ry="5" fill="#e4efec" />
                    <circle
                      cx="92"
                      cy="21"
                      r="20"
                      fill="#fff"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <text
                      x="96"
                      y="28"
                      textAnchor="middle"
                      fontFamily="var(--font-bricolage), Bricolage Grotesque, sans-serif"
                      fontWeight="700"
                      fontSize="20"
                      fill="#0b5d5b"
                    >
                      u
                    </text>
                    <circle
                      cx="68"
                      cy="29"
                      r="21"
                      fill="#0b5d5b"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="68"
                      cy="29"
                      r="14"
                      fill="none"
                      stroke="#fff"
                      strokeOpacity=".35"
                      strokeWidth="1"
                    />
                    <text
                      x="68"
                      y="36"
                      textAnchor="middle"
                      fontFamily="var(--font-bricolage), Bricolage Grotesque, sans-serif"
                      fontWeight="700"
                      fontSize="20"
                      fill="#fff"
                    >
                      u
                    </text>
                    <circle
                      cx="40"
                      cy="37"
                      r="20"
                      fill="#fff"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <text
                      x="40"
                      y="44"
                      textAnchor="middle"
                      fontFamily="var(--font-bricolage), Bricolage Grotesque, sans-serif"
                      fontWeight="700"
                      fontSize="20"
                      fill="#0b5d5b"
                    >
                      u
                    </text>
                  </svg>
                </div>
                <div className="amount">250 tokens</div>
                <p className="desc">
                  A comfortable top-up (+15 bonus tokens) for borrowing and shared journeys.
                </p>
                <hr className="rule" />
                <div className="pay">৳250 BDT · 265 total tokens credited</div>
                <button
                  className={`btn ${selectedTokens === 250 ? "primary" : ""}`}
                  type="button"
                  onClick={() => handlePackageSelect(250)}
                >
                  {selectedTokens === 250
                    ? "Continue with 250 tokens"
                    : "Choose 250 tokens"}
                </button>
              </div>

              {/* 500 Tokens */}
              <div
                className={`card ${selectedTokens === 500 ? "sel" : ""}`}
                onClick={() => setSelectedTokens(500)}
              >
                <div className="top">
                  <span className="tag">More room to share</span>
                  {selectedTokens === 500 && (
                    <span className="badge">Selected</span>
                  )}
                </div>
                <div className="coins">
                  <svg width="134" height="68" viewBox="0 -4 134 68">
                    <ellipse cx="65" cy="52" rx="60" ry="5" fill="#e4efec" />
                    <circle
                      cx="108"
                      cy="17"
                      r="19"
                      fill="#fff"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <text
                      x="112"
                      y="24"
                      textAnchor="middle"
                      fontFamily="var(--font-bricolage), Bricolage Grotesque, sans-serif"
                      fontWeight="700"
                      fontSize="19"
                      fill="#0b5d5b"
                    >
                      u
                    </text>
                    <circle
                      cx="86"
                      cy="24"
                      r="19"
                      fill="#fff"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <text
                      x="90"
                      y="31"
                      textAnchor="middle"
                      fontFamily="var(--font-bricolage), Bricolage Grotesque, sans-serif"
                      fontWeight="700"
                      fontSize="19"
                      fill="#0b5d5b"
                    >
                      u
                    </text>
                    <circle
                      cx="62"
                      cy="31"
                      r="20"
                      fill="#0b5d5b"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="62"
                      cy="31"
                      r="13"
                      fill="none"
                      stroke="#fff"
                      strokeOpacity=".35"
                      strokeWidth="1"
                    />
                    <text
                      x="62"
                      y="38"
                      textAnchor="middle"
                      fontFamily="var(--font-bricolage), Bricolage Grotesque, sans-serif"
                      fontWeight="700"
                      fontSize="20"
                      fill="#fff"
                    >
                      u
                    </text>
                    <circle
                      cx="36"
                      cy="38"
                      r="19"
                      fill="#fff"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <text
                      x="36"
                      y="45"
                      textAnchor="middle"
                      fontFamily="var(--font-bricolage), Bricolage Grotesque, sans-serif"
                      fontWeight="700"
                      fontSize="19"
                      fill="#0b5d5b"
                    >
                      u
                    </text>
                  </svg>
                </div>
                <div className="amount">500 tokens</div>
                <p className="desc">
                  Stock up your wallet (+40 bonus tokens) for the campus plans ahead.
                </p>
                <hr className="rule" />
                <div className="pay">৳500 BDT · 540 total tokens credited</div>
                <button
                  className={`btn ${selectedTokens === 500 ? "primary" : ""}`}
                  type="button"
                  onClick={() => handlePackageSelect(500)}
                >
                  {selectedTokens === 500
                    ? "Continue with 500 tokens"
                    : "Choose 500 tokens"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Order Review */}
        {currentStep === 2 && (
          <div className="step-panel">
            <h3>Step 2: Order Review</h3>
            <p>Review your token package summary before proceeding to payment.</p>
            <div
              style={{
                background: "var(--teal-faint)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span>Selected Package:</span>
                <b>{selectedTokens} Tokens</b>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span>Campus Rate:</span>
                <span>1 Token = 1 BDT</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span>Campus Bonus:</span>
                <span style={{ color: "var(--teal)", fontWeight: 600 }}>
                  {selectedMeta.bonus > 0 ? `+${selectedMeta.bonus} bonus tokens` : "Standard pack"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span>Total Credited:</span>
                <b>{expectedTotalTokens} Tokens</b>
              </div>
              <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "12px 0" }} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "15px",
                }}
              >
                <b>Total Payable:</b>
                <b style={{ color: "var(--teal)", fontSize: "18px" }}>৳{selectedTokens} BDT</b>
              </div>
            </div>
            <div className="step-actions">
              <button
                className="btn"
                type="button"
                onClick={() => setCurrentStep(1)}
              >
                ← Back to packages
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={() => setCurrentStep(3)}
              >
                Proceed to Payment Method →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Payment Method Selection */}
        {currentStep === 3 && (
          <div className="step-panel">
            <h3>Step 3: Select Payment Method</h3>
            <p>Choose your preferred mobile wallet or bank for token top-up.</p>
            <div className="pay-methods">
              {["bKash", "Nagad", "Rocket"].map((method) => (
                <div
                  key={method}
                  className={`pay-card ${selectedPayment === method ? "active" : ""}`}
                  onClick={() => setSelectedPayment(method)}
                >
                  <b>{method}</b>
                  <small>Instant Mobile Wallet</small>
                </div>
              ))}
            </div>

            <div
              style={{
                background: "var(--teal-soft)",
                borderRadius: "8px",
                padding: "14px",
                marginBottom: "20px",
              }}
            >
              <b style={{ color: "var(--teal)", display: "block", marginBottom: "4px" }}>
                Payment Instructions for {selectedPayment}:
              </b>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                Send <b>৳{selectedTokens}</b> via {selectedPayment} &quot;Send Money&quot; to UniShare Campus Account:{" "}
                <b style={{ color: "var(--ink)" }}>01712-345678</b> (Reference: {refTag}).
              </p>
            </div>

            <div className="step-actions">
              <button
                className="btn"
                type="button"
                onClick={() => setCurrentStep(2)}
              >
                ← Back
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={() => setCurrentStep(4)}
              >
                Continue with {selectedPayment} →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Submit Payment Details */}
        {currentStep === 4 && (
          <div className="step-panel">
            <h3>Step 4: Submit Payment Verification Details</h3>
            <p>Enter your payment sender number and transaction ID.</p>
            <form onSubmit={handleSubmitPayment}>
              <div className="form-group">
                <label>Your {selectedPayment} Mobile Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 017XXXXXXXX"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Transaction ID (TrxID)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9J2K4L1M"
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                />
              </div>

              <div className="step-actions">
                <button
                  className="btn"
                  type="button"
                  onClick={() => setCurrentStep(3)}
                >
                  ← Back
                </button>
                <button className="btn primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Verifying & crediting..." : "Submit Payment Details"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 5: Verification Confirmation */}
        {currentStep === 5 && (
          <div className="step-panel" style={{ textAlign: "center", padding: "36px 24px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "var(--teal-soft)",
                color: "var(--teal)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px",
                fontSize: "24px",
                fontWeight: "bold",
              }}
            >
              ✓
            </div>
            <h3 style={{ fontSize: "22px" }}>Tokens Credited to Your Wallet</h3>
            <p style={{ maxWidth: "440px", margin: "8px auto 20px" }}>
              Thank you, {firstName}! <b>+{creditedAmount || expectedTotalTokens} tokens</b> have been added to your {resolvedUser.university} wallet. Available balance: <b>{balance} tokens</b>.
            </p>
            <div
              style={{
                display: "inline-block",
                background: "var(--teal-faint)",
                border: "1px solid var(--line)",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "12px",
                marginBottom: "24px",
              }}
            >
              Reference: <b>{paymentRef || refTag}</b> · Status: <span style={{ color: "var(--teal)", fontWeight: 700 }}>Credited</span>
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <Link className="btn primary" href="/wallet">
                Back to Wallet
              </Link>
              <Link className="btn" href="/home">
                Go to Home
              </Link>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="info">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0b5d5b"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <circle cx="12" cy="7.8" r=".6" fill="#0b5d5b" />
          </svg>
          <div>
            <b>Tokens arrive after review, not when you select a package.</b>
            <span>
              Pay externally by bank or mobile payment, submit your payment
              reference, and wait for approval. Your available balance stays at {balance}
              tokens until the purchase is approved.
            </span>
          </div>
        </div>

        {/* Three Things to Know */}
        <h3 className="know">Three things to know before you buy</h3>
        <div className="know-grid">
          <div className="know-item">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0b5d5b"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="10" cy="10" r="6.5" />
              <path d="M10 7v3l2 1.5" />
              <path d="M6.5 17.5L5 21l4-1.5" />
              <path d="M15 15a4 4 0 0 0 5 3" />
            </svg>
            <div>
              <b>Tokens stay on campus</b>
              <p>
                Use your balance for rentals, rides and transfers with verified {resolvedUser.university}
                students.
              </p>
            </div>
          </div>
          <div className="know-item">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0b5d5b"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9.5L12 4l9 5.5" />
              <path d="M4.5 20h15" />
              <path d="M6 11v6M10 11v6M14 11v6M18 11v6" />
            </svg>
            <div>
              <b>External payment is separate</b>
              <p>The payment instructions and amount are provided at checkout.</p>
            </div>
          </div>
          <div className="know-item">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0b5d5b"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" />
              <path d="M8.5 12l2.5 2.5 4.5-5" />
            </svg>
            <div>
              <b>Every payment is reviewed</b>
              <p>
                Only an approved purchase adds tokens to your available wallet
                balance.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer>
        <div className="foot">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <nav>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/help">Get help</Link>
            <a href="#" onClick={handleLogout}>
              Log out
            </a>
          </nav>
        </div>
      </footer>

      {/* Toast */}
      <div
        className={`toast ${showToast ? "on" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toastMsg}
      </div>
    </div>
  );
}

