"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import AppNavbar from "../components/AppNavbar";
import {
  clearClientSession,
  getUserScopedKey,
  saveClientUser,
  useCurrentUser,
  useLocalStorageRaw,
  useRequireAuth,
  writeUserScopedJson,
  type ClientUser,
} from "../lib/user-client";
import {
  CATEGORIES,
  MarketplaceItem,
  removeMarketplaceItem,
  upsertMarketplaceItem,
} from "../marketplace/marketplace-data";
import "./my-products.css";

interface ProductItem {
  id: string;
  name: string;
  category: string;
  condition: string;
  state: "active" | "paused" | "draft";
  isRentedOut?: boolean;
  rate: number;
  deposit: number;
  area?: string;
  maxRentalDays?: number;
  description?: string;
  image: string;
  note: string;
  availText: string;
  owner: string;
}

interface RentalRecord {
  id: string;
  listingId: string;
  listingTitle: string;
  borrowerName: string;
  borrowerEmail: string;
  lenderName: string;
  startDate: string;
  endDate: string;
  days: number;
  rentalFee: number;
  depositAmount: number;
  totalLocked: number;
  note?: string | null;
  status: string;
}

export default function MyProductsPage() {
  const router = useRouter();
  const { resolvedUser, isDemoUser } = useCurrentUser();
  const [filterTab, setFilterTab] = useState<"all" | "active" | "paused" | "draft">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortOption, setSortOption] = useState<"recent" | "low" | "high">("recent");

  const productsKey = getUserScopedKey(
    "unishare_my_products",
    resolvedUser.email,
    isDemoUser
  );
  const rawProductsJson = useLocalStorageRaw(productsKey);
  const [serverProducts, setServerProducts] = useState<ProductItem[]>([]);
  const [lentRentals, setLentRentals] = useState<RentalRecord[]>([]);
  const [borrowedRentals, setBorrowedRentals] = useState<RentalRecord[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [busyRentalId, setBusyRentalId] = useState<string | null>(null);

  const loadMyData = React.useCallback(async () => {
    if (!resolvedUser.email) return;
    try {
      const [prodRes, rentRes] = await Promise.all([
        fetch("/api/marketplace?mine=true", {
          headers: { "x-user-email": resolvedUser.email },
        }),
        fetch("/api/marketplace/rentals", {
          headers: { "x-user-email": resolvedUser.email },
        }),
      ]);
      const prodData = (await prodRes.json().catch(() => null)) as {
        ok?: boolean;
        myProducts?: ProductItem[];
      } | null;
      if (prodRes.ok && prodData?.ok && Array.isArray(prodData.myProducts)) {
        setServerProducts(prodData.myProducts);
      }

      const rentData = (await rentRes.json().catch(() => null)) as {
        ok?: boolean;
        lent?: RentalRecord[];
        borrowed?: RentalRecord[];
        totalEarned?: number;
      } | null;
      if (rentRes.ok && rentData?.ok) {
        setLentRentals(rentData.lent || []);
        setBorrowedRentals(rentData.borrowed || []);
        setTotalEarned(rentData.totalEarned || 0);
      }
    } catch {
      // ignore offline
    }
  }, [resolvedUser.email]);

  useEffect(() => {
    if (!resolvedUser.email) return;
    let active = true;
    const run = async () => {
      try {
        const [prodRes, rentRes] = await Promise.all([
          fetch("/api/marketplace?mine=true", {
            headers: { "x-user-email": resolvedUser.email },
          }),
          fetch("/api/marketplace/rentals", {
            headers: { "x-user-email": resolvedUser.email },
          }),
        ]);
        const prodData = (await prodRes.json().catch(() => null)) as {
          ok?: boolean;
          myProducts?: ProductItem[];
        } | null;
        if (active && prodRes.ok && prodData?.ok && Array.isArray(prodData.myProducts)) {
          setServerProducts(prodData.myProducts);
        }

        const rentData = (await rentRes.json().catch(() => null)) as {
          ok?: boolean;
          lent?: RentalRecord[];
          borrowed?: RentalRecord[];
          totalEarned?: number;
        } | null;
        if (active && rentRes.ok && rentData?.ok) {
          setLentRentals(rentData.lent || []);
          setBorrowedRentals(rentData.borrowed || []);
          setTotalEarned(rentData.totalEarned || 0);
        }
      } catch {
        // ignore offline
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [resolvedUser.email]);

  const products: ProductItem[] = useMemo(() => {
    let localList: ProductItem[] = [];
    if (rawProductsJson) {
      try {
        const parsed = JSON.parse(rawProductsJson);
        if (Array.isArray(parsed)) {
          localList = (parsed as ProductItem[]).filter((p) => !/^p-[0-3]$/.test(p.id));
        }
      } catch {}
    }

    if (serverProducts.length === 0) return localList;
    const seen = new Set(serverProducts.map((p) => p.id));
    return [...serverProducts, ...localList.filter((p) => !seen.has(p.id))];
  }, [rawProductsJson, serverProducts]);

  const setProducts = (updater: (prev: ProductItem[]) => ProductItem[]) => {
    const next = updater(products);
    setServerProducts(next);
    writeUserScopedJson(productsKey, next);
  };

  // Modals & toast states
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showDatesModal, setShowDatesModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductItem | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Pricing edit inputs
  const [editRate, setEditRate] = useState("60");
  const [editDeposit, setEditDeposit] = useState("300");

  const isAuthenticated = useRequireAuth("/my-products");

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2400);
  };

  const syncListingToMarketplace = (
    item: ProductItem,
    nextState: "active" | "paused" | "draft",
    nextRate = item.rate,
    nextDeposit = item.deposit
  ) => {
    if (nextState === "draft") {
      removeMarketplaceItem(item.id);
      return;
    }
    const marketItem: MarketplaceItem = {
      id: item.id,
      name: item.name,
      category: item.category,
      price: nextRate,
      deposit: nextDeposit,
      area: item.area || "TSC",
      owner: resolvedUser.name,
      ownerEmail: resolvedUser.email,
      university: resolvedUser.university,
      initials: resolvedUser.initials,
      image: item.image,
      available: nextState === "active" && !item.isRentedOut,
      condition: item.condition,
      maxRentalDays: item.maxRentalDays || 7,
      description: item.description || `${item.condition} condition ${item.name}. ${item.note}`,
    };
    upsertMarketplaceItem(marketItem);
  };

  // State toggles (awaited with explicit API verification)
  const handleToggleState = async (item: ProductItem) => {
    const nextState: "active" | "paused" = item.state === "paused" ? "active" : "paused";
    try {
      const res = await fetch(`/api/marketplace/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(resolvedUser.email ? { "x-user-email": resolvedUser.email } : {}),
        },
        body: JSON.stringify({ status: nextState }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        myProduct?: ProductItem;
      } | null;

      if (!res.ok || !data?.ok) {
        triggerToast(data?.error || "Could not update listing status.");
        return;
      }

      const updatedItem = data.myProduct || {
        ...item,
        state: nextState,
        availText:
          nextState === "paused"
            ? "Not accepting bookings"
            : item.isRentedOut
            ? "Currently rented"
            : "Available today",
        note:
          nextState === "paused"
            ? "Paused by you"
            : `Published to ${resolvedUser.university} shelf`,
      };
      setProducts((prev) => prev.map((p) => (p.id === item.id ? updatedItem : p)));
      syncListingToMarketplace(updatedItem, nextState);
      triggerToast(
        nextState === "paused"
          ? `Listing "${item.name}" paused.`
          : `Listing "${item.name}" resumed and active.`
      );
    } catch {
      triggerToast("Network error updating listing.");
    }
  };

  const confirmDeleteProduct = async () => {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    try {
      const res = await fetch(`/api/marketplace/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: resolvedUser.email ? { "x-user-email": resolvedUser.email } : undefined,
      });
      if (!res.ok && res.status !== 404) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        triggerToast(d?.error || "Unable to delete listing.");
        return;
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
      removeMarketplaceItem(id);
      setDeleteTarget(null);
      triggerToast(`"${name}" deleted.`);
    } catch {
      triggerToast("Network error deleting listing.");
    }
  };

  const handleFinishDraft = async (item: ProductItem) => {
    try {
      const res = await fetch(`/api/marketplace/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(resolvedUser.email ? { "x-user-email": resolvedUser.email } : {}),
        },
        body: JSON.stringify({ status: "active" }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        myProduct?: ProductItem;
      } | null;
      if (!res.ok || !data?.ok) {
        triggerToast(data?.error || "Unable to publish draft.");
        return;
      }
      const nextItem = data.myProduct || {
        ...item,
        state: "active" as const,
        availText: "Available today",
        note: `Published to ${resolvedUser.university} shelf`,
      };
      setProducts((prev) => prev.map((p) => (p.id === item.id ? nextItem : p)));
      syncListingToMarketplace(nextItem, "active");
      triggerToast(`Draft "${item.name}" finished and published!`);
    } catch {
      triggerToast("Network error publishing draft.");
    }
  };

  const openPricingModal = (item: ProductItem) => {
    setSelectedProduct(item);
    setEditRate(item.rate.toString());
    setEditDeposit(item.deposit.toString());
    setShowPriceModal(true);
  };

  const savePricing = async () => {
    if (!selectedProduct) return;
    const r = Math.round(Number(editRate));
    const d = Math.round(Number(editDeposit));
    if (!Number.isFinite(r) || r < 5 || r > 500) {
      triggerToast("Daily rental rate must be between 5 and 500 tokens.");
      return;
    }
    if (!Number.isFinite(d) || d < 0 || d > 2000) {
      triggerToast("Security deposit must be between 0 and 2000 tokens.");
      return;
    }

    try {
      const res = await fetch(`/api/marketplace/${encodeURIComponent(selectedProduct.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(resolvedUser.email ? { "x-user-email": resolvedUser.email } : {}),
        },
        body: JSON.stringify({ rate: r, deposit: d }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        myProduct?: ProductItem;
      } | null;
      if (!res.ok || !data?.ok) {
        triggerToast(data?.error || "Could not update pricing.");
        return;
      }

      const nextProd = data.myProduct || { ...selectedProduct, rate: r, deposit: d };
      setProducts((prev) => prev.map((p) => (p.id === selectedProduct.id ? nextProd : p)));
      syncListingToMarketplace(nextProd, nextProd.state, r, d);
      setShowPriceModal(false);
      triggerToast(`Updated pricing for ${selectedProduct.name}.`);
    } catch {
      triggerToast("Network error saving pricing.");
    }
  };

  const openDatesModal = (item: ProductItem) => {
    setSelectedProduct(item);
    setShowDatesModal(true);
  };

  const handleRentalAction = async (
    rentalId: string,
    action: "approve" | "decline" | "return" | "cancel"
  ) => {
    if (busyRentalId) return;
    setBusyRentalId(rentalId);
    try {
      const res = await fetch(`/api/marketplace/rentals/${encodeURIComponent(rentalId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(resolvedUser.email ? { "x-user-email": resolvedUser.email } : {}),
        },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        triggerToast(data?.error || "Could not update rental.");
        return;
      }

      // Refresh wallet balance & listings/rentals
      const meRes = await fetch("/api/auth/me").catch(() => null);
      if (meRes?.ok) {
        const meData = (await meRes.json().catch(() => null)) as { user?: ClientUser } | null;
        if (meData?.user) saveClientUser(meData.user);
      }
      await loadMyData();
      const labels = {
        approve: "Rental approved & item marked rented out!",
        decline: "Request declined & borrower escrow refunded.",
        return: "Return confirmed! Deposit released & earnings credited.",
        cancel: "Borrow request cancelled & tokens refunded.",
      };
      triggerToast(labels[action]);
    } catch {
      triggerToast("Network error updating rental status.");
    } finally {
      setBusyRentalId(null);
    }
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    clearClientSession();
    router.push("/login");
  };

  // Dynamic calculations for stats & tabs
  const counts = useMemo(() => {
    const active = products.filter((p) => p.state === "active").length;
    const paused = products.filter((p) => p.state === "paused").length;
    const draft = products.filter((p) => p.state === "draft").length;
    const total = products.length;
    const available = products.filter(
      (p) => p.state === "active" && !p.isRentedOut
    ).length;
    const rentedOut = products.filter(
      (p) => p.state === "active" && p.isRentedOut
    ).length;
    return { active, paused, draft, total, available, rentedOut };
  }, [products]);

  // Filtered & sorted products list
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (filterTab !== "all" && p.state !== filterTab) return false;
        if (
          categoryFilter !== "all" &&
          p.category.toLowerCase() !== categoryFilter.toLowerCase()
        )
          return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOption === "low") return a.rate - b.rate;
        if (sortOption === "high") return b.rate - a.rate;
        return 0;
      });
  }, [products, filterTab, categoryFilter, searchQuery, sortOption]);

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#fff",
          fontFamily: "system-ui, sans-serif",
          color: "#0b5b57",
          fontWeight: 600,
        }}
      >
        Checking campus authorization...
      </div>
    );
  }

  return (
    <div className="unishare-myproducts">
      {/* Toast Notification */}
      {showToast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#14201e",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            zIndex: 9999,
            boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
            animation: "fadeIn 0.2s ease",
          }}
        >
          {toastMsg}
        </div>
      )}

      <AppNavbar
        activeNav="my-products"
        user={resolvedUser}
        onLogout={() => {
          clearClientSession();
          router.push("/login");
        }}
        onOpenProfile={() => setShowProfileModal(true)}
        onSos={() =>
          triggerToast("Emergency Campus SOS: Campus security contacted.")
        }
      />

      {/* Main Content */}
      <main className="wrap">
        {/* Breadcrumb */}
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/home">Home</Link>
          <span>›</span>
          <span className="current">My products</span>
        </nav>

        {/* Header Title & Add Product Button */}
        <div className="eyebrow">
          {resolvedUser.university} · Verified students only
        </div>
        <div className="head">
          <div>
            <h1>My products</h1>
            <p className="lede">
              Your shared shelf. Manage listings, prices and the days you can
              lend.
            </p>
          </div>
          <Link
            className="btn solid"
            href="/marketplace/list"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add product
          </Link>
        </div>

        {/* 4 Summary Stat Cards */}
        <section className="stats" aria-label="Summary">
          <div className="stat">
            <small>Total products</small>
            <b id="sTotal">{counts.total}</b>
            <span>All owned by you</span>
          </div>
          <div className="stat">
            <small>Live listings</small>
            <b id="sLive">{counts.active}</b>
            <span>
              {counts.available} available · {counts.rentedOut} rented out
            </span>
          </div>
          <div className="stat">
            <small>Paused &amp; drafts</small>
            <b id="sOff">{counts.paused + counts.draft}</b>
            <span id="sOffTxt">
              {counts.paused} paused · {counts.draft}{" "}
              {counts.draft === 1 ? "draft" : "drafts"}
            </span>
          </div>
          <div className="stat">
            <small>Rental earnings</small>
            <b>{totalEarned} tokens</b>
            <span>{lentRentals.filter((r) => r.status === "RETURNED").length} completed returns</span>
          </div>
        </section>

        {/* Filter Tabs */}
        <div className="tabs" id="tabs" role="tablist">
          <button
            className={filterTab === "all" ? "on" : ""}
            role="tab"
            type="button"
            id="tAll"
            onClick={() => setFilterTab("all")}
          >
            All products ({counts.total})
          </button>
          <button
            className={filterTab === "active" ? "on" : ""}
            role="tab"
            type="button"
            id="tActive"
            onClick={() => setFilterTab("active")}
          >
            Active ({counts.active})
          </button>
          <button
            className={filterTab === "paused" ? "on" : ""}
            role="tab"
            type="button"
            id="tPaused"
            onClick={() => setFilterTab("paused")}
          >
            Paused ({counts.paused})
          </button>
          <button
            className={filterTab === "draft" ? "on" : ""}
            role="tab"
            type="button"
            id="tDraft"
            onClick={() => setFilterTab("draft")}
          >
            Drafts ({counts.draft})
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="bar">
          <label className="search">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
            >
              <circle cx="12" cy="12" r="6" />
            </svg>
            <input
              id="q"
              type="search"
              placeholder="Search your products"
              aria-label="Search your products"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          <label className="fb">
            <select
              id="cat"
              aria-label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {CATEGORIES.filter((c) => c !== "All items").map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </label>
          <label className="fb">
            <select
              id="sort"
              aria-label="Sort"
              value={sortOption}
              onChange={(e) =>
                setSortOption(e.target.value as "recent" | "low" | "high")
              }
            >
              <option value="recent">Sort: Recently updated</option>
              <option value="low">Sort: Price, low to high</option>
              <option value="high">Sort: Price, high to low</option>
            </select>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </label>
        </div>

        {/* Products Table */}
        <section className="table" aria-label="Products">
          <div className="thead">
            <span>Product / Condition</span>
            <span>Token pricing</span>
            <span>Availability</span>
            <span style={{ textAlign: "left" }}>Manage</span>
          </div>

          <ul className="rows" id="rows">
            {filteredProducts.map((p) => (
              <li key={p.id} className="prow">
                <div className="c prod">
                  <Link href={`/product-details/${p.id}`} style={{ flexShrink: 0 }}>
                    <Image
                      src={p.image}
                      alt={p.name}
                      width={68}
                      height={54}
                      unoptimized
                      style={{ objectFit: "cover", borderRadius: 8, display: "block" }}
                    />
                  </Link>
                  <div>
                    <small>
                      {p.category} · {p.condition}
                    </small>
                    <h3>
                      <Link href={`/product-details/${p.id}`}>{p.name}</Link>
                    </h3>
                    <p>{p.owner}</p>
                    <p className="note">{p.note}</p>
                  </div>
                </div>

                <div className="c price">
                  <b>{p.rate} tokens / day</b>
                  <span>{p.deposit} tokens deposit</span>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      openPricingModal(p);
                    }}
                  >
                    Edit pricing →
                  </a>
                </div>

                <div className="c avail">
                  <span
                    className={`badge ${
                      p.state === "active"
                        ? p.isRentedOut
                          ? "b-rentedout"
                          : "b-active"
                        : p.state === "paused"
                        ? "b-paused"
                        : "b-draft"
                    }`}
                  >
                    {p.state === "active"
                      ? p.isRentedOut
                        ? "Rented out"
                        : "Active"
                      : p.state === "paused"
                      ? "Paused"
                      : "Draft"}
                  </span>
                  <span className="av">{p.availText}</span>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      openDatesModal(p);
                    }}
                  >
                    Manage dates →
                  </a>
                </div>

                <div className="c manage">
                  {p.state === "draft" ? (
                    <>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleFinishDraft(p)}
                      >
                        Finish draft
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ borderColor: "#c0392b", color: "#c0392b" }}
                        onClick={() => setDeleteTarget(p)}
                      >
                        Delete draft
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/marketplace/list?edit=${encodeURIComponent(p.id)}`}
                        className="btn"
                      >
                        Edit product
                      </Link>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleToggleState(p)}
                      >
                        {p.state === "paused" ? "Resume" : "Pause listing"}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ borderColor: "#c0392b", color: "#c0392b" }}
                        onClick={() => setDeleteTarget(p)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {filteredProducts.length === 0 && (
            <div className="empty" style={{ display: "block" }}>
              <b>No products here</b>
              Try another filter or add a new product.
            </div>
          )}
        </section>

        {/* Live Rental Requests & Escrows */}
        {(lentRentals.length > 0 || borrowedRentals.length > 0) && (
          <section className="table" aria-label="Rental requests" style={{ padding: "18px 20px" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              Rental Requests &amp; Active Escrows
            </h2>

            {lentRentals.length > 0 && (
              <div style={{ marginBottom: borrowedRentals.length > 0 ? 18 : 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase" }}>
                  Requests for your items
                </p>
                <div style={{ display: "grid", gap: 10 }}>
                  {lentRentals.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 12,
                        border: "1px solid var(--hair)",
                        borderRadius: 10,
                        padding: "12px 14px",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 14 }}>{r.listingTitle}</strong>
                        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                          Borrower: <b>{r.borrowerName}</b> ({r.borrowerEmail}) · {r.startDate} → {r.endDate} ({r.days}d) · {r.rentalFee} tokens fee + {r.depositAmount} deposit
                        </div>
                        {r.note && (
                          <div style={{ fontSize: 12, color: "var(--teal)", marginTop: 3 }}>
                            Note: &ldquo;{r.note}&rdquo;
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span className={`badge ${r.status === "ACTIVE" ? "b-rentedout" : r.status === "RETURNED" ? "b-active" : "b-draft"}`}>
                          {r.status}
                        </span>
                        {r.status === "PENDING" && (
                          <>
                            <button
                              type="button"
                              className="btn solid"
                              disabled={busyRentalId === r.id}
                              onClick={() => handleRentalAction(r.id, "approve")}
                            >
                              Approve handoff
                            </button>
                            <button
                              type="button"
                              className="btn"
                              disabled={busyRentalId === r.id}
                              onClick={() => handleRentalAction(r.id, "decline")}
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {r.status === "ACTIVE" && (
                          <button
                            type="button"
                            className="btn solid"
                            disabled={busyRentalId === r.id}
                            onClick={() => handleRentalAction(r.id, "return")}
                          >
                            Confirm return &amp; settle
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {borrowedRentals.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase" }}>
                  Items you requested / borrowed
                </p>
                <div style={{ display: "grid", gap: 10 }}>
                  {borrowedRentals.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 12,
                        border: "1px solid var(--hair)",
                        borderRadius: 10,
                        padding: "12px 14px",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 14 }}>{r.listingTitle}</strong>
                        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                          Lender: <b>{r.lenderName}</b> · {r.startDate} → {r.endDate} ({r.days}d) · Escrow: {r.totalLocked} tokens
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={`badge ${r.status === "ACTIVE" ? "b-rentedout" : r.status === "RETURNED" ? "b-active" : "b-draft"}`}>
                          {r.status}
                        </span>
                        {r.status === "PENDING" && (
                          <button
                            type="button"
                            className="btn"
                            disabled={busyRentalId === r.id}
                            onClick={() => handleRentalAction(r.id, "cancel")}
                          >
                            Cancel &amp; refund
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Notice Banner */}
        <div className="notice" role="note">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <div>
            <b>Your listings are visible only to verified {resolvedUser.university} students.</b>
            <span>
              Keep condition, photos and availability up to date. Pausing stops
              new requests without cancelling confirmed rentals.
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer>
        <div className="wrap">
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

      {/* Modal: Confirm Delete */}
      {deleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "400px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              border: "1.5px solid var(--line)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "17px", fontWeight: 700, marginBottom: "8px" }}>
              Delete listing?
            </h3>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "18px", lineHeight: 1.5 }}>
              Are you sure you want to remove <strong>{deleteTarget.name}</strong> from your campus shelf? This action cannot be undone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: "#c0392b", borderColor: "#c0392b", color: "#fff" }}
                onClick={confirmDeleteProduct}
              >
                Delete product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Pricing */}
      {showPriceModal && selectedProduct && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => setShowPriceModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "400px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              border: "1.5px solid var(--line)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>
              Edit Token Pricing
            </h3>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "16px" }}>
              {selectedProduct.name}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                  Rental rate (tokens / day)
                </label>
                <input
                  type="number"
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  style={{
                    width: "100%",
                    border: "1px solid var(--hair)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                  Security deposit (tokens held)
                </label>
                <input
                  type="number"
                  value={editDeposit}
                  onChange={(e) => setEditDeposit(e.target.value)}
                  style={{
                    width: "100%",
                    border: "1px solid var(--hair)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "13px",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowPriceModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn solid"
                onClick={savePricing}
              >
                Save pricing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Manage Dates */}
      {showDatesModal && selectedProduct && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => setShowDatesModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "400px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              border: "1.5px solid var(--line)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>
              Manage Availability Dates
            </h3>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "16px" }}>
              {selectedProduct.name}
            </p>

            <div
              style={{
                background: "var(--teal-soft)",
                borderRadius: "8px",
                padding: "12px 14px",
                fontSize: "12px",
                color: "var(--teal)",
                marginBottom: "16px",
                lineHeight: "1.5",
              }}
            >
              Current status: <b>{selectedProduct.availText}</b>
              <br />
              {selectedProduct.note}
            </div>

            <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "16px" }}>
              Pause bookings when you need this item for personal use, or resume to accept campus requests immediately.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowDatesModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn solid"
                onClick={async () => {
                  const target = selectedProduct;
                  setShowDatesModal(false);
                  if (target) {
                    await handleToggleState(target);
                  }
                }}
              >
                {selectedProduct.state === "paused" ? "Resume bookings" : "Pause bookings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Farhana Rahman Profile */}
      {showProfileModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => setShowProfileModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "14px",
              padding: "24px",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              border: "1.5px solid var(--line)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "var(--teal-soft)",
                  border: "1.5px solid var(--teal)",
                  color: "var(--teal)",
                  fontWeight: 700,
                  fontSize: "18px",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {resolvedUser.initials}
              </div>
              <div>
                <b style={{ fontSize: "16px", display: "block" }}>{resolvedUser.name}</b>
                <small style={{ color: "var(--muted)", fontSize: "12px" }}>{resolvedUser.email}</small>
                <div style={{ fontSize: "11px", color: "var(--teal)", fontWeight: 700, marginTop: "2px" }}>
                  {resolvedUser.university} ·{" "}
                  {resolvedUser.verified ? "Verified Member 🛡️" : "Student Member"}
                </div>
              </div>
            </div>

            <div
              style={{
                background: "var(--panel)",
                borderRadius: "8px",
                padding: "12px 14px",
                fontSize: "12px",
                lineHeight: "1.6",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Student ID:</span>
                <b>{resolvedUser.studentId || "Not submitted yet"}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Department:</span>
                <b>{resolvedUser.department || "Not provided yet"}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Active Products:</span>
                <b>{counts.active} live listings</b>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowProfileModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn"
                style={{ borderColor: "#c0392b", color: "#c0392b" }}
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
