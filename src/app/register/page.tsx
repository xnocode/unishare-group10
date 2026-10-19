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

function deriveCustomShortName(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(of|and|for|the|at|in)$/i.test(w));
  if (words.length === 0) return "UNI";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function RegisterPage() {
  const router = useRouter();
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const shouldFocusSearchRef = useRef(false);

  // University autocomplete & manual custom entry state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUniId, setSelectedUniId] = useState<string>("");
  const [customUniName, setCustomUniName] = useState<string>("");
  const [manualMode, setManualMode] = useState(false);
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
  const [accountExistsError, setAccountExistsError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedUniversity: BdUniversity | undefined = useMemo(
    () => BD_UNIVERSITIES.find((u) => u.id === selectedUniId),
    [selectedUniId]
  );

  const activeCustomUniName = customUniName.trim();
  const isCustomUniversityActive = Boolean(activeCustomUniName) || manualMode;
  const effectiveUniName = selectedUniversity
    ? selectedUniversity.name
    : activeCustomUniName;

  const trimmedQuery = searchQuery.trim();
  const showDropdown =
    !selectedUniversity &&
    !activeCustomUniName &&
    !manualMode &&
    dropdownOpen &&
    trimmedQuery.length > 0;

  const { matches, totalMatches, firstMatch, hasExactNameMatch } = useMemo(() => {
    if (!trimmedQuery) {
      return {
        matches: [] as BdUniversity[],
        totalMatches: 0,
        firstMatch: undefined as BdUniversity | undefined,
        hasExactNameMatch: false,
      };
    }

    const qNorm = normalizeSearch(trimmedQuery);
    const scored = BD_UNIVERSITIES.flatMap((u) => {
      const score = getUniversityMatchScore(u, trimmedQuery);
      return score === null ? [] : [{ uni: u, score }];
    })
      .sort((a, b) => a.score - b.score)
      .map((item) => item.uni);

    const exact = scored.some((u) => normalizeSearch(u.name) === qNorm);

    return {
      matches: scored,
      totalMatches: scored.length,
      firstMatch: scored[0],
      hasExactNameMatch: exact,
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
    if (!selectedUniId && !customUniName && shouldFocusSearchRef.current) {
      shouldFocusSearchRef.current = false;
      searchInputRef.current?.focus();
    }
  }, [selectedUniId, customUniName, manualMode]);

  const handleSelectUniversity = (uni: BdUniversity) => {
    setSelectedUniId(uni.id);
    setCustomUniName("");
    setManualMode(false);
    setSearchQuery("");
    setDropdownOpen(false);
    setUniversityError("");
    setEmailError("");
    setBannerError("");
  };

  const handleSelectCustomUniversity = (name: string) => {
    const cleaned = name.trim();
    if (cleaned.length < 2) {
      setUniversityError("Please enter your full university name (at least 2 characters).");
      return;
    }
    setSelectedUniId("");
    setCustomUniName(cleaned);
    setManualMode(false);
    setSearchQuery("");
    setDropdownOpen(false);
    setUniversityError("");
    setEmailError("");
    setBannerError("");
  };

  const handleChangeUniversity = () => {
    shouldFocusSearchRef.current = true;
    setSelectedUniId("");
    setCustomUniName("");
    setManualMode(false);
    setSearchQuery("");
    setDropdownOpen(false);
    setUniversityError("");
    setEmailError("");
  };

  const handleSwitchToManual = () => {
    shouldFocusSearchRef.current = true;
    setSelectedUniId("");
    setCustomUniName(trimmedQuery);
    setManualMode(true);
    setSearchQuery("");
    setDropdownOpen(false);
    setUniversityError("");
    setEmailError("");
  };

  const handleSwitchToSearchList = () => {
    shouldFocusSearchRef.current = true;
    setManualMode(false);
    setCustomUniName("");
    setSearchQuery("");
    setUniversityError("");
    setEmailError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage("");
    setBannerError("");
    setAccountExistsError(false);

    const trimmedEmail = email.trim().toLowerCase();
    let isValid = true;

    if (!effectiveUniName || effectiveUniName.length < 2) {
      setUniversityError(
        manualMode
          ? "Please type your university name (at least 2 characters)."
          : "Search for your university, or click “Enter manually” if it isn’t listed."
      );
      isValid = false;
    } else {
      setUniversityError("");
    }

    // Email format + listed university domain check (custom university accepts any valid email)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      setEmailError("Enter a valid email address.");
      isValid = false;
    } else if (
      selectedUniversity &&
      !matchesUniversityEmail(trimmedEmail, selectedUniversity)
    ) {
      const domainLabel = selectedUniversity.domains
        .map((d) => `@${d}`)
        .join(" or ");
      setEmailError(
        `Use your ${selectedUniversity.shortName} email (${domainLabel}), or type a custom university if yours isn’t listed.`
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

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          universityName: effectiveUniName,
          universityId: selectedUniversity ? selectedUniversity.id : "custom",
          isCustomUniversity: !selectedUniversity,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        email?: string;
        university?: string;
        provider?: string;
        isLiveEmail?: boolean;
        previewUrl?: string;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        if (res.status === 409) {
          setAccountExistsError(true);
        }
        setBannerError(
          data.error || "Unable to create your account. Please try again."
        );
        return;
      }

      try {
        sessionStorage.setItem(
          "unishare_pending_mail_meta",
          JSON.stringify({
            email: data.email || trimmedEmail,
            university: data.university || effectiveUniName,
            provider: data.provider,
            isLiveEmail: Boolean(data.isLiveEmail),
            previewUrl: data.previewUrl || "",
          })
        );
      } catch {
        // ignore sessionStorage restriction
      }

      setSuccessMessage(
        data.isLiveEmail
          ? `Verification code sent to ${trimmedEmail}. Redirecting...`
          : `Verification code generated for ${trimmedEmail}. Redirecting...`
      );

      const nextParams = new URLSearchParams({
        email: data.email || trimmedEmail,
        university: data.university || effectiveUniName,
      });
      setTimeout(() => {
        router.push(`/confirm-email?${nextParams.toString()}`);
      }, 350);
    } catch {
      setBannerError(
        "Network error while creating your account. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
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
              {/* University Autocomplete / Manual Custom / Selected Pill */}
              <div className="univ-field-wrap">
                <div className="univ-section-head">
                  {selectedUniversity || (activeCustomUniName && !manualMode) ? (
                    <span className="univ-field-label">Your university</span>
                  ) : manualMode ? (
                    <>
                      <label htmlFor="univ-manual">Type your university name</label>
                      <button
                        type="button"
                        className="univ-manual-toggle"
                        onClick={handleSwitchToSearchList}
                      >
                        Back to university list
                      </button>
                    </>
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
                ) : activeCustomUniName && !manualMode ? (
                  <div className="selected-uni-pill">
                    <span className="univ-logo-box univ-logo-custom">
                      <span className="univ-logo-fallback">
                        {deriveCustomShortName(activeCustomUniName)}
                      </span>
                    </span>
                    <span className="univ-meta">
                      <span className="univ-name">{activeCustomUniName}</span>
                      <span className="univ-sub">
                        Custom university · Enter your email below
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
                ) : manualMode ? (
                  <>
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
                          <path d="M12 3 2 8l10 5 10-5-10-5z" />
                          <path d="M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5" />
                        </svg>
                      </span>
                      <input
                        ref={searchInputRef}
                        id="univ-manual"
                        type="text"
                        value={customUniName}
                        onChange={(e) => {
                          setCustomUniName(e.target.value);
                          if (universityError) setUniversityError("");
                        }}
                        placeholder="e.g., Dhaka City College or your university"
                        autoComplete="organization"
                      />
                      {customUniName && (
                        <button
                          type="button"
                          className="univ-clear-btn"
                          onClick={() => {
                            setCustomUniName("");
                            searchInputRef.current?.focus();
                          }}
                          aria-label="Clear university name"
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
                    <p
                      className={`hint ${universityError ? "error" : ""}`}
                      style={{ marginTop: "6px", marginBottom: 0 }}
                    >
                      {universityError ||
                        "Using an unlisted university lets you sign up with your own email address."}
                    </p>
                  </>
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
                              } else if (trimmedQuery.length >= 2) {
                                handleSelectCustomUniversity(trimmedQuery);
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
                            <>
                              <div className="univ-empty">
                                No university matched &ldquo;{trimmedQuery}&rdquo;.
                              </div>
                              {trimmedQuery.length >= 2 && (
                                <button
                                  type="button"
                                  className="univ-row univ-custom-row"
                                  onClick={() =>
                                    handleSelectCustomUniversity(trimmedQuery)
                                  }
                                >
                                  <span className="univ-logo-box univ-logo-custom">
                                    <span className="univ-logo-fallback">
                                      {deriveCustomShortName(trimmedQuery)}
                                    </span>
                                  </span>
                                  <span className="univ-meta">
                                    <span className="univ-name">
                                      Use &ldquo;{trimmedQuery}&rdquo; as my
                                      university
                                    </span>
                                    <span className="univ-sub">
                                      Not listed · Enter your own email below
                                    </span>
                                  </span>
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              {matches.map((uni) => (
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
                              ))}
                              {!hasExactNameMatch && trimmedQuery.length >= 2 && (
                                <div className="univ-custom-divider">
                                  <button
                                    type="button"
                                    className="univ-row univ-custom-row"
                                    onClick={() =>
                                      handleSelectCustomUniversity(trimmedQuery)
                                    }
                                  >
                                    <span className="univ-logo-box univ-logo-custom">
                                      <span className="univ-logo-fallback">
                                        {deriveCustomShortName(trimmedQuery)}
                                      </span>
                                    </span>
                                    <span className="univ-meta">
                                      <span className="univ-name">
                                        Can&apos;t find yours? Use &ldquo;
                                        {trimmedQuery}&rdquo;
                                      </span>
                                      <span className="univ-sub">
                                        Add custom university · Use your own email
                                      </span>
                                    </span>
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="univ-hint-row">
                      <p
                        className={`hint ${universityError ? "error" : ""}`}
                        style={{ marginTop: 0, marginBottom: 0 }}
                      >
                        {universityError ||
                          "Start typing to pick your university."}
                      </p>
                      <button
                        type="button"
                        className="univ-manual-toggle"
                        onClick={handleSwitchToManual}
                      >
                        Not listed? Type manually
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* University Email */}
              <label className="l" htmlFor="email">
                {isCustomUniversityActive
                  ? "Email address"
                  : "University email address"}
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
                      : "name@university.edu or your email"
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
                    : isCustomUniversityActive
                    ? "Enter your university or personal email to receive the 6-digit code."
                    : "Use the email address issued by your university (or any valid email for unlisted universities).")}
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
              <button className="btn btn-lg" type="submit" disabled={isSubmitting}>
                <span>{isSubmitting ? "Sending code..." : "Continue"}</span>
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
                We’ll send a 6-digit code to confirm your email address.
              </p>

              {bannerError && (
                <div className="err-banner" role="alert">
                  {bannerError}
                  {accountExistsError && (
                    <>
                      {" "}
                      <Link
                        href={`/login?email=${encodeURIComponent(email.trim().toLowerCase())}`}
                        style={{ color: "inherit", fontWeight: 700, textDecoration: "underline" }}
                      >
                        Go to Log in →
                      </Link>
                    </>
                  )}
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
