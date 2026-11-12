"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import AppNavbar from "../../components/AppNavbar";
import {
  CATEGORIES,
  getDefaultImageForCategory,
  ITEM_CONDITIONS,
  MarketplaceItem,
  MyProductRecord,
  PICKUP_AREAS,
  PRESET_PRODUCT_PHOTOS,
  upsertMarketplaceItem,
} from "../marketplace-data";
import {
  clearClientSession,
  getUserScopedKey,
  useCurrentUser,
  useLocalStorageRaw,
  useRequireAuth,
  writeUserScopedJson,
} from "../../lib/user-client";
import { validateImageUpload } from "../../lib/validation";
import "./list.css";

function ListMarketplaceItemContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = (searchParams.get("edit") || "").trim();
  const isAuthenticated = useRequireAuth(
    editId ? `/marketplace/list?edit=${encodeURIComponent(editId)}` : "/marketplace/list"
  );
  const { resolvedUser, isDemoUser } = useCurrentUser();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Calculators");
  const [condition, setCondition] = useState<string>("Good");
  const [pricePerDay, setPricePerDay] = useState("40");
  const [deposit, setDeposit] = useState("100");
  const [pickupArea, setPickupArea] = useState("TSC");
  const [maxRentalDays, setMaxRentalDays] = useState("7");
  const [description, setDescription] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState(
    getDefaultImageForCategory("Calculators")
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customPhotoUsed, setCustomPhotoUsed] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(Boolean(editId));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!editId || !isAuthenticated) return;
    let active = true;
    fetch(`/api/marketplace/${encodeURIComponent(editId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; marketItem?: MarketplaceItem } | null) => {
        if (!active) return;
        if (data?.ok && data.marketItem) {
          const item = data.marketItem;
          setTitle(item.name);
          setCategory(item.category);
          setCondition(item.condition || "Good");
          setPricePerDay(String(item.price));
          setDeposit(String(item.deposit));
          setPickupArea(item.area || "TSC");
          setMaxRentalDays(String(item.maxRentalDays || 7));
          setDescription(item.description || "");
          if (item.image) {
            setSelectedPhoto(item.image);
            setCustomPhotoUsed(true);
          }
        } else {
          setErrorMsg("Could not load listing details for editing.");
        }
      })
      .catch(() => {
        if (active) setErrorMsg("Unable to load listing details right now.");
      })
      .finally(() => {
        if (active) setIsLoadingEdit(false);
      });
    return () => {
      active = false;
    };
  }, [editId, isAuthenticated]);

  const productsKey = getUserScopedKey(
    "unishare_my_products",
    resolvedUser.email,
    isDemoUser
  );
  const rawProductsJson = useLocalStorageRaw(productsKey);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2400);
  };

  const handleCategoryChange = (nextCategory: string) => {
    setCategory(nextCategory);
    if (!customPhotoUsed) {
      setSelectedPhoto(getDefaultImageForCategory(nextCategory));
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const check = validateImageUpload(file, 2 * 1024 * 1024);
    if (!check.valid) {
      setSelectedFile(null);
      setErrorMsg(check.error || "Please upload a JPG, PNG, or WebP image under 2 MB.");
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSelectedPhoto(reader.result);
        setCustomPhotoUsed(true);
        setErrorMsg("");
      }
    };
    reader.readAsDataURL(file);
  };

  const saveListing = async (asDraft: boolean) => {
    setErrorMsg("");
    const cleanTitle = title.trim();
    if (cleanTitle.length < 3 || cleanTitle.length > 90) {
      setErrorMsg("Please enter an item title between 3 and 90 characters.");
      return;
    }

    const rateNum = Math.round(Number(pricePerDay));
    const depositNum = Math.round(Number(deposit));
    const maxDaysNum = Math.round(Number(maxRentalDays));

    if (!Number.isFinite(rateNum) || rateNum < 5 || rateNum > 500) {
      setErrorMsg("Daily rental rate must be between 5 and 500 tokens.");
      return;
    }
    if (!Number.isFinite(depositNum) || depositNum < 0 || depositNum > 2000) {
      setErrorMsg("Refundable deposit must be between 0 and 2000 tokens.");
      return;
    }
    if (!Number.isFinite(maxDaysNum) || maxDaysNum < 1 || maxDaysNum > 30) {
      setErrorMsg("Maximum rental duration must be between 1 and 30 days.");
      return;
    }

    setIsSaving(true);
    try {
      let resolvedImageUrl = selectedPhoto;

      if (selectedFile) {
        const fd = new FormData();
        fd.append("kind", "product");
        fd.append("file", selectedFile);
        const uploadRes = await fetch("/api/uploads", {
          method: "POST",
          headers: resolvedUser.email ? { "x-user-email": resolvedUser.email } : undefined,
          body: fd,
        });
        const uploadData = (await uploadRes.json().catch(() => null)) as {
          ok?: boolean;
          url?: string;
          error?: string;
        } | null;
        if (!uploadRes.ok || !uploadData?.ok || !uploadData.url) {
          setErrorMsg(uploadData?.error || "Failed to upload product photo.");
          setIsSaving(false);
          return;
        }
        resolvedImageUrl = uploadData.url;
      }

      const cleanDesc =
        description.trim() ||
        `${condition} condition ${cleanTitle}. Pickup at ${pickupArea}.`;

      const endpoint = editId
        ? `/api/marketplace/${encodeURIComponent(editId)}`
        : "/api/marketplace";
      const method = editId ? "PATCH" : "POST";

      const apiRes = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(resolvedUser.email ? { "x-user-email": resolvedUser.email } : {}),
        },
        body: JSON.stringify({
          title: cleanTitle,
          category,
          condition,
          rate: rateNum,
          deposit: depositNum,
          area: pickupArea,
          maxRentalDays: maxDaysNum,
          description: cleanDesc,
          imageUrl: resolvedImageUrl,
          status: asDraft ? "draft" : "active",
        }),
      });

      const apiData = (await apiRes.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        marketItem?: MarketplaceItem;
        myProduct?: MyProductRecord;
      } | null;

      if (!apiRes.ok || !apiData?.ok || !apiData.myProduct || !apiData.marketItem) {
        setErrorMsg(apiData?.error || "Unable to save listing.");
        setIsSaving(false);
        return;
      }

      let existingProducts: MyProductRecord[] = [];
      if (rawProductsJson) {
        try {
          const parsed = JSON.parse(rawProductsJson);
          if (Array.isArray(parsed)) existingProducts = parsed as MyProductRecord[];
        } catch {}
      }
      writeUserScopedJson(productsKey, [
        apiData.myProduct,
        ...existingProducts.filter((p) => p.id !== apiData.myProduct!.id),
      ]);

      if (!asDraft) {
        upsertMarketplaceItem(apiData.marketItem);
        triggerToast(editId ? `"${cleanTitle}" updated!` : `"${cleanTitle}" published to Marketplace!`);
        setTimeout(() => router.push(editId ? "/my-products" : "/marketplace"), 550);
      } else {
        triggerToast(`Saved "${cleanTitle}" as draft.`);
        setTimeout(() => router.push("/my-products"), 550);
      }
    } catch {
      setErrorMsg("Network error while saving listing.");
      setIsSaving(false);
    }
  };

  const handleLogout = (e?: React.MouseEvent) => {
    e?.preventDefault();
    clearClientSession();
    router.push("/login");
  };

  if (!isAuthenticated) {
    return (
      <div className="unishare-list-page" style={{ minHeight: "100vh", background: "#ffffff" }}>
        <AppNavbar activeNav="marketplace" />
        <main className="wrap">
          <div style={{ height: 34, width: 220, background: "#f5f7f6", borderRadius: 8, marginBottom: 18 }} />
          <div style={{ height: 320, background: "#f5f7f6", borderRadius: 12, border: "1px solid #d5dcda" }} />
        </main>
      </div>
    );
  }

  const parsedRate = Number(pricePerDay) || 0;
  const parsedDeposit = Number(deposit) || 0;
  const parsedMaxDays = Number(maxRentalDays) || 7;

  return (
    <div className="unishare-list-page">
      <AppNavbar
        activeNav="marketplace"
        user={{ tokenBalance: resolvedUser.tokenBalance }}
        onLogout={handleLogout}
        onSos={() =>
          triggerToast(`Emergency Campus SOS: ${resolvedUser.university} security contacted.`)
        }
      />

      <main className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/home">Home</Link>
          <span>›</span>
          <Link href="/marketplace">Marketplace</Link>
          <span>›</span>
          <span className="current">{editId ? "Edit listing" : "List an item"}</span>
        </nav>

        <div className="eyebrow">{resolvedUser.university} · Verified students only</div>
        <div className="hero-row">
          <div>
            <h1>{editId ? "Edit your listing" : "List an item"}</h1>
            <p className="sub">
              {isLoadingEdit
                ? "Loading saved listing details..."
                : `Add clear details, choose a campus meetup spot, and earn tokens from verified ${resolvedUser.university} students.`}
            </p>
          </div>
          <Link href="/my-products" className="btn outline">
            Manage my listings
          </Link>
        </div>

        <div className="band">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <div>
            <b>Deposit-protected campus lending</b>
            <p>
              Every borrower pays upfront with tokens, and their refundable deposit is held safely until return.
            </p>
          </div>
          <span className="band-tag">
            {resolvedUser.verified ? "Verified lender" : "Campus member"}
          </span>
        </div>

        <div className="list-layout">
          <form
            className="form-col"
            onSubmit={(e) => {
              e.preventDefault();
              saveListing(false);
            }}
          >
            <section className="panel">
              <div className="panel-head">
                <h2>1. Item details &amp; photo</h2>
                <p>Tell borrowers exactly what they are getting and its current condition.</p>
              </div>

              <div className="field">
                <label htmlFor="list-title">Item title *</label>
                <input
                  id="list-title"
                  type="text"
                  placeholder="e.g. Scientific calculator fx-991EX ClassWiz"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  required
                />
              </div>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="list-category">Category</label>
                  <select
                    id="list-category"
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    {CATEGORIES.filter((c) => c !== "All items").map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="list-condition">Condition</label>
                  <select
                    id="list-condition"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                  >
                    {ITEM_CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="list-desc">Description &amp; included accessories</label>
                <textarea
                  id="list-desc"
                  rows={3}
                  placeholder="Mention model number, cables/case included, battery health, or usage notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={400}
                />
              </div>

              <div className="field">
                <label>Item photo</label>
                <p className="hint" style={{ marginTop: 0 }}>
                  Select a campus preset photo or upload your own photo from this device.
                </p>
                <div className="photo-thumbs">
                  {PRESET_PRODUCT_PHOTOS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      className={`photo-thumb ${selectedPhoto === preset.url ? "on" : ""}`}
                      onClick={() => {
                        setSelectedPhoto(preset.url);
                        setSelectedFile(null);
                        setCustomPhotoUsed(false);
                      }}
                      title={preset.label}
                      aria-label={`Choose ${preset.label} photo`}
                    >
                      <Image src={preset.url} alt={preset.label} fill sizes="100px" unoptimized />
                    </button>
                  ))}
                </div>

                <div className="upload-row">
                  <label className="upload-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>Upload own photo</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} />
                  </label>
                  {customPhotoUsed && (
                    <button
                      type="button"
                      className="btn outline"
                      style={{ padding: "6px 12px", fontSize: 12 }}
                      onClick={() => {
                        setCustomPhotoUsed(false);
                        setSelectedFile(null);
                        setSelectedPhoto(getDefaultImageForCategory(category));
                      }}
                    >
                      Reset to category photo
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>2. Pricing, deposit &amp; campus handoff</h2>
                <p>Set fair student token rates and pick a public campus meetup location.</p>
              </div>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="list-rate">Tokens per day *</label>
                  <input
                    id="list-rate"
                    type="number"
                    min={5}
                    max={500}
                    step={1}
                    value={pricePerDay}
                    onChange={(e) => setPricePerDay(e.target.value)}
                    required
                  />
                  <div className="hint">Most campus essentials rent for 20–80 tokens/day.</div>
                </div>

                <div className="field">
                  <label htmlFor="list-deposit">Refundable deposit (tokens) *</label>
                  <input
                    id="list-deposit"
                    type="number"
                    min={0}
                    max={2000}
                    step={1}
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    required
                  />
                  <div className="hint">Held in escrow and returned on safe handback.</div>
                </div>
              </div>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="list-area">Preferred campus pickup spot</label>
                  <select
                    id="list-area"
                    value={pickupArea}
                    onChange={(e) => setPickupArea(e.target.value)}
                  >
                    {PICKUP_AREAS.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="list-maxdays">Maximum rental duration</label>
                  <select
                    id="list-maxdays"
                    value={maxRentalDays}
                    onChange={(e) => setMaxRentalDays(e.target.value)}
                  >
                    <option value="1">Up to 1 day</option>
                    <option value="3">Up to 3 days</option>
                    <option value="5">Up to 5 days</option>
                    <option value="7">Up to 7 days</option>
                    <option value="14">Up to 14 days</option>
                  </select>
                </div>
              </div>

              {errorMsg && <div className="error-text" role="alert">{errorMsg}</div>}
            </section>

            <div className="actions-bar">
              <Link href="/marketplace" className="btn outline">
                Cancel
              </Link>
              <button
                type="button"
                className="btn outline"
                disabled={isSaving}
                onClick={() => saveListing(true)}
              >
                {isSaving ? "Saving..." : "Save as draft"}
              </button>
              <button type="submit" className="btn" disabled={isSaving || isLoadingEdit}>
                {isSaving
                  ? editId
                    ? "Saving..."
                    : "Publishing..."
                  : editId
                  ? "Save changes"
                  : "Publish listing"}
              </button>
            </div>
          </form>

          <aside className="side-col">
            <div>
              <div className="preview-label">Live Marketplace Card Preview</div>
              <article className="preview-card">
                <div className="preview-img-wrap">
                  <Image src={selectedPhoto} alt={title || "Item preview"} fill sizes="380px" unoptimized />
                  <span className="preview-pill">Available today</span>
                </div>
                <div className="preview-body">
                  <small className="preview-cat">{category}</small>
                  <h3>{title.trim() || "Your item title"}</h3>
                  <div className="preview-price">
                    <b>{parsedRate}</b>
                    <span>tokens / day</span>
                  </div>
                  <div className="preview-meta">
                    {parsedDeposit} tokens refundable deposit · Max {parsedMaxDays}d
                  </div>
                  <div className="preview-meta">
                    Pickup: {pickupArea} · {condition}
                  </div>
                  <div className="preview-owner">
                    <span className="preview-avatar">{resolvedUser.initials}</span>
                    <div>
                      <strong style={{ display: "block", fontSize: 13 }}>{resolvedUser.name}</strong>
                      <small style={{ fontSize: 11.5, color: "var(--muted)" }}>
                        Verified {resolvedUser.university} student
                      </small>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            <div className="guide-box">
              <h3>How to list properly on UniShare</h3>
              <div className="guide-step">
                <span className="guide-num">1</span>
                <div>
                  <b>Include accessories &amp; condition</b>
                  State whether chargers, cases, or batteries are included so requests go smoothly.
                </div>
              </div>
              <div className="guide-step">
                <span className="guide-num">2</span>
                <div>
                  <b>Choose a public campus spot</b>
                  Meet in well-lit public areas like libraries, TSC, or faculty lobbies.
                </div>
              </div>
              <div className="guide-step">
                <span className="guide-num">3</span>
                <div>
                  <b>Inspect before &amp; after return</b>
                  Check the item together at handoff and confirm return in My Products to settle tokens.
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer>
        <div className="wrap">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <div>
            <Link href="/marketplace">Marketplace</Link>
            <Link href="/my-products">My products</Link>
            <Link href="/settings">Settings</Link>
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </footer>

      <div className={`toast ${showToast ? "on" : ""}`} role="status">
        {toastMsg}
      </div>
    </div>
  );
}

export default function ListMarketplaceItemPage() {
  return (
    <Suspense fallback={<div className="unishare-list-page"><div className="wrap" style={{ padding: "80px 0", textAlign: "center" }}>Loading...</div></div>}>
      <ListMarketplaceItemContent />
    </Suspense>
  );
}
