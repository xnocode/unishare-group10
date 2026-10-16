"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "../auth.css";
import {
  BD_UNIVERSITIES,
  BdUniversity,
  matchesUniversityEmail,
} from "../lib/bd-universities";

const COMMON_DOMAIN_SEGMENTS = new Set([
  "edu",
  "ac",
  "bd",
  "int",
  "org",
  "com",
  "net",
  "gov",
  "student",
  "mail",
]);

function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9@.\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getUniversityMatchScore(
  uni: BdUniversity,
  rawQuery: string
): number | null {
  const q = normalizeSearch(rawQuery);
  if (!q) return null;

  const shortNorm = normalizeSearch(uni.shortName);
  const nameNorm = normalizeSearch(uni.name);
  const aliasNorms = (uni.aliases ?? []).map(normalizeSearch);

  if (shortNorm === q) return 0;
  if (shortNorm.startsWith(q)) return 1;
  if (nameNorm.startsWith(q) || aliasNorms.some((a) => a.startsWith(q))) {
    return 2;
  }

  const nameAndAliasWords = [nameNorm, ...aliasNorms].flatMap((s) =>
    s.split(" ")
  );
  const domainLabels = uni.domains.flatMap((d) =>
    d
      .toLowerCase()
      .split(".")
      .filter((seg) => !COMMON_DOMAIN_SEGMENTS.has(seg))
  );

  if (
    nameAndAliasWords.some((w) => w.startsWith(q)) ||
    domainLabels.some((seg) => seg.startsWith(q))
  ) {
    return 3;
  }

  const rawLower = rawQuery.trim().toLowerCase();
  const domainMatched =
    rawLower.includes("@") || rawLower.includes(".")
      ? uni.domains.some((d) =>
          d.toLowerCase().includes(rawLower.replace(/^@/, ""))
        )
      : domainLabels.some((seg) => seg.includes(q));

  if (
    shortNorm.includes(q) ||
    nameNorm.includes(q) ||
    aliasNorms.some((a) => a.includes(q)) ||
    domainMatched
  ) {
    return 4;
  }

  return null;
}

export default function RegisterPage() {
  const router = useRouter();
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const shouldFocusSearchRef = useRef(false);

  // University autocomplete state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUniId, setSelectedUniId] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});

  // Account form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [universityError, setUniversityError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [bannerError, setBannerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedUniversity: BdUniversity | undefined = useMemo(
    () => BD_UNIVERSITIES.find((u) => u.id === selectedUniId),
    [selectedUniId]
  );

  const trimmedQuery = searchQuery.trim();
  const showDropdown = !selectedUniversity && dropdownOpen && trimmedQuery.length > 0;

  const { matches, totalMatches, firstMatch } = useMemo(() => {
    if (!trimmedQuery) {
      return {
        matches: [] as BdUniversity[],
        totalMatches: 0,
        firstMatch: undefined as BdUniversity | undefined,
      };
    }

    const scored = BD_UNIVERSITIES.flatMap((u) => {
      const score = getUniversityMatchScore(u, trimmedQuery);
      return score === null ? [] : [{ uni: u, score }];
    })
      .sort((a, b) => a.score - b.score)
      .map((item) => item.uni);

    return {
      matches: scored,
      totalMatches: scored.length,
      firstMatch: scored[0],
    };
  }, [trimmedQuery]);

  useEffect(() => {
    const handleOutsideMouseDown = (event: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideMouseDown);
    return () => document.removeEventListener("mousedown", handleOutsideMouseDown);
  }, []);

  useEffect(() => {
    if (!selectedUniId && shouldFocusSearchRef.current) {
      shouldFocusSearchRef.current = false;
      searchInputRef.current?.focus();
    }
  }, [selectedUniId]);

  const handleSelectUniversity = (uni: BdUniversity) => {
    setSelectedUniId(uni.id);
    setSearchQuery("");
    setDropdownOpen(false);
    setUniversityError("");
    setEmailError("");
    setBannerError("");
  };

  const handleChangeUniversity = () => {
    shouldFocusSearchRef.current = true;
    setSelectedUniId("");
    setSearchQuery("");
    setDropdownOpen(false);
    setUniversityError("");
    setEmailError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage("");
    setBannerError("");

    const trimmedEmail = email.trim();
    let isValid = true;

    if (!selectedUniversity) {
      setUniversityError("Search for and select your university first.");
      isValid = false;
    } else {
      setUniversityError("");
    }

    // Email format + selected university domain validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setEmailError("Enter a valid university email address.");
      isValid = false;
    } else if (
      selectedUniversity &&
      !matchesUniversityEmail(trimmedEmail, selectedUniversity)
    ) {
      const domainLabel = selectedUniversity.domains
        .map((d) => `@${d}`)
        .join(" or ");
      setEmailError(
        `Use your ${selectedUniversity.shortName} email (${domainLabel}).`
      );
      isValid = false;
    } else {
      setEmailError("");
    }

    // Password validation: at least 8 chars, must include letter and number
    const passwordValid =
      password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
    if (!passwordValid) {
      setPasswordError("Use at least 8 characters with a letter and a number.");
      isValid = false;
    } else {
      setPasswordError("");
    }

    // Confirm password matching
    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password.");
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords don’t match.");
      isValid = false;
    } else {
      setConfirmPasswordError("");
    }

    if (!isValid) return;

    if (!agreed) {
      setBannerError(
        "Please agree to the Terms of use and Privacy policy to continue."
      );
      return;
    }

    // Success response matching the sample flow and navigate to Step 2
    setSuccessMessage(`Next: we’ll send a 6-digit code to ${trimmedEmail}.`);
    setTimeout(() => {
      const nextParams = new URLSearchParams({ email: trimmedEmail });
      if (selectedUniversity) {
        nextParams.set("university", selectedUniversity.name);
      }
      router.push(`/confirm-email?${nextParams.toString()}`);
    }, 600);
  };

  const renderUniversityLogo = (uni: BdUniversity) => {
    const logoFailed = failedLogos[uni.id];
    return (
      <span className="univ-logo-box">
        {uni.logo && !logoFailed ? (
          <img
            src={uni.logo}
            alt={`${uni.name} logo`}
            loading="lazy"
            onError={() =>
              setFailedLogos((prev) => ({ ...prev, [uni.id]: true }))
            }
          />
        ) : (
          <span className="univ-logo-fallback">{uni.shortName}</span>
        )}
      </span>
    );
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

      {/* Main Content Area */}
      <main className="wrap">
        {/* Progress Steps */}
        <ol className="steps" aria-label="Sign-up progress">
          <li className="on" aria-current="step">
            <span>1</span>
            <em>Create account</em>
          </li>
          <li>
            <span>2</span>
            <em>Confirm email</em>
          </li>
          <li>
            <span>3</span>
            <em>Student verification</em>
          </li>
          <li>
            <span>4</span>
            <em>Review pending</em>
          </li>
        </ol>

        {/* 2-Column Grid */}
        <div className="grid">
          {/* Left Column: Community Info & Value Prop */}
          <section>
            <p className="kicker">JOIN YOUR CAMPUS COMMUNITY</p>
            <h1>
              Create your account{" "}
              <em>
                and start sharing <br className="hidden md:inline" />
                with your campus.
              </em>
            </h1>
            <p className="lead">
              Use your university email to create an account, then borrow, lend,
              and connect with students from your own campus.
            </p>

            <div className="panel">
              <h2>What you can do after signup</h2>
              <p>
                Once your account is created, you can browse items, request a
                pickup, and connect with students from your university.
              </p>
              <ol>
                <li>
                  <b>1</b>
                  <span>
                    Borrow books, gear, and other items from students on your
                    campus.
                  </span>
                </li>
                <li>
                  <b>2</b>
                  <span>
                    Lend what you no longer need and help someone else on campus.
                  </span>
                </li>
                <li>
                  <b>3</b>
                  <span>
                    Share rides, notes, and campus resources with people you
                    trust.
                  </span>
                </li>
              </ol>
            </div>
            <p className="note">
              Your university email helps keep the community safe and local.
            </p>
          </section>

          {/* Right Column: Sign Up Card */}
          <section className="card" aria-labelledby="form-title">
            <h2 id="form-title">Create your campus account</h2>
            <p className="sub">
              Use your university email to create your account. We’ll send a
              6-digit code to confirm it’s really you.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              {/* University Autocomplete / Selected Pill */}
              <div className="univ-field-wrap">
                <div className="univ-section-head">
                  {selectedUniversity ? (
                    <span className="univ-field-label">Your university</span>
                  ) : (
                    <>
                      <label htmlFor="univ-search">Select your university</label>
                      <span className="univ-count">
                        {trimmedQuery
                          ? `${totalMatches} ${totalMatches === 1 ? "match" : "matches"}`
                          : `${BD_UNIVERSITIES.length} universities`}
                      </span>
                    </>
                  )}
                </div>

                {selectedUniversity ? (
                  <div className="selected-uni-pill">
                    {renderUniversityLogo(selectedUniversity)}
                    <span className="univ-meta">
                      <span className="univ-name">
                        {selectedUniversity.name}
                      </span>
                      <span className="univ-sub">
                        @{selectedUniversity.domains[0]}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="selected-uni-change"
                      onClick={handleChangeUniversity}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="univ-autocomplete" ref={autocompleteRef}>
                      <div
                        className={`univ-search-box ${universityError ? "error" : ""}`}
                      >
                        <span className="search-ic" aria-hidden="true">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.3-4.3" />
                          </svg>
                        </span>
                        <input
                          ref={searchInputRef}
                          id="univ-search"
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSearchQuery(val);
                            setDropdownOpen(val.trim().length > 0);
                            if (universityError) setUniversityError("");
                          }}
                          onFocus={() => {
                            if (searchQuery.trim().length > 0) {
                              setDropdownOpen(true);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setDropdownOpen(false);
                            } else if (e.key === "Enter" && showDropdown) {
                              e.preventDefault();
                              if (firstMatch) {
                                handleSelectUniversity(firstMatch);
                              }
                            }
                          }}
                          placeholder="Search for your university..."
                          autoComplete="off"
                          role="combobox"
                          aria-expanded={showDropdown}
                          aria-controls="univ-dropdown-list"
                          aria-autocomplete="list"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            className="univ-clear-btn"
                            onClick={() => {
                              setSearchQuery("");
                              setDropdownOpen(false);
                              searchInputRef.current?.focus();
                            }}
                            aria-label="Clear university search"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                            >
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {showDropdown && (
                        <div
                          id="univ-dropdown-list"
                          className="univ-list"
                          role="listbox"
                          aria-label="Matching universities"
                        >
                          {totalMatches === 0 ? (
                            <div className="univ-empty">
                              No university matched &ldquo;{trimmedQuery}&rdquo;.
                              Try a different name or acronym.
                            </div>
                          ) : (
                            matches.map((uni) => (
                              <button
                                key={uni.id}
                                type="button"
                                className="univ-row"
                                onClick={() => handleSelectUniversity(uni)}
                              >
                                {renderUniversityLogo(uni)}
                                <span className="univ-meta">
                                  <span className="univ-name">{uni.name}</span>
                                  <span className="univ-sub">
                                    {uni.shortName} · @{uni.domains[0]}
                                  </span>
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <p
                      className={`hint ${universityError ? "error" : ""}`}
                      style={{ marginTop: "6px", marginBottom: 0 }}
                    >
                      {universityError ||
                        "Start typing your university name or acronym to select it."}
                    </p>
                  </>
                )}
              </div>

              {/* University Email */}
              <label className="l" htmlFor="email">
                University email address
              </label>
              <div className="field">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  placeholder={
                    selectedUniversity
                      ? `name@${selectedUniversity.domains[0]}`
                      : "name@university.edu"
                  }
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
              <p className={`hint ${emailError ? "error" : ""}`}>
                {emailError ||
                  (selectedUniversity
                    ? `Use your ${selectedUniversity.shortName} email (${selectedUniversity.domains
                        .map((d) => `@${d}`)
                        .join(" or ")}).`
                    : "Use the email address issued by your university.")}
              </p>

              {/* Password */}
              <label className="l" htmlFor="pw">
                Create a password
              </label>
              <div className="field">
                <input
                  id="pw"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
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
              <p className={`hint ${passwordError ? "error" : ""}`}>
                {passwordError ||
                  "Use at least 8 characters and include a letter and a number."}
              </p>

              {/* Confirm Password */}
              <label className="l" htmlFor="pw2">
                Confirm your password
              </label>
              <div className="field">
                <input
                  id="pw2"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmPasswordError) setConfirmPasswordError("");
                  }}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="ic"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
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
              <p
                className={`hint ${confirmPasswordError ? "error" : ""}`}
                style={{ marginBottom: "16px" }}
              >
                {confirmPasswordError}
              </p>

              {/* Terms Checkbox */}
              <label className="agree">
                <input
                  type="checkbox"
                  id="agree"
                  checked={agreed}
                  onChange={(e) => {
                    setAgreed(e.target.checked);
                    if (bannerError) setBannerError("");
                  }}
                />
                <span>
                  I agree to the <Link href="#">Terms of use</Link> and{" "}
                  <Link href="#">Privacy policy</Link> and confirm I am a
                  university student.
                </span>
              </label>

              {/* Submit Button */}
              <button className="btn btn-lg" type="submit">
                <span>Continue</span>
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

              <p className="center">
                We’ll send a 6-digit code to confirm your university email
                address.
              </p>

              {bannerError && (
                <div className="err-banner" role="alert">
                  {bannerError}
                </div>
              )}

              {successMessage && (
                <div className="ok" role="status">
                  {successMessage}
                </div>
              )}

              <p className="center big">
                Already have an account? <Link href="/login">Log in</Link>
              </p>
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
