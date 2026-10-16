"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNavbar from "../components/AppNavbar";
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
  image: string;
  note: string;
  availText: string;
  owner: string;
}

const INITIAL_PRODUCTS: ProductItem[] = [
  {
    id: "p-0",
    name: "Canon EOS 200D",
    category: "Cameras",
    condition: "Good",
    state: "active",
    isRentedOut: false,
    rate: 60,
    deposit: 300,
    image: "/images/products/product-1.jpeg",
    note: "Booked 16–18 Oct · 1 pending request",
    availText: "Available today",
    owner: "Farhana Rahman · You",
  },
  {
    id: "p-1",
    name: "Adjustable study lamp",
    category: "Study essentials",
    condition: "Good",
    state: "active",
    isRentedOut: true,
    rate: 20,
    deposit: 80,
    image: "/images/products/product-2.jpeg",
    note: "With Nabila Sultana · Return 16 Oct",
    availText: "Available 17 Oct",
    owner: "Farhana Rahman · You",
  },
  {
    id: "p-2",
    name: "Compact camera tripod",
    category: "Camera accessories",
    condition: "Good",
    state: "paused",
    isRentedOut: false,
    rate: 25,
    deposit: 100,
    image: "/images/products/product-3.jpeg",
    note: "Paused by you on 11 Oct",
    availText: "Not accepting bookings",
    owner: "Farhana Rahman · You",
  },
  {
    id: "p-3",
    name: "Weekend hiking backpack",
    category: "Travel essentials",
    condition: "Like new",
    state: "draft",
    isRentedOut: false,
    rate: 30,
    deposit: 100,
    image: "/images/products/product-4.jpeg",
    note: "Add availability to finish your listing",
    availText: "Not published",
    owner: "Farhana Rahman · You",
  },
];

export default function MyProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [filterTab, setFilterTab] = useState<"all" | "active" | "paused" | "draft">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortOption, setSortOption] = useState<"recent" | "low" | "high">("recent");

  // Modals & toast states
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showDatesModal, setShowDatesModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Form inputs
  const [newTitle, setNewTitle] = useState("");
  const [newCat, setNewCat] = useState("Cameras");
  const [newCondition, setNewCondition] = useState("Good");
  const [newRate, setNewRate] = useState("40");
  const [newDeposit, setNewDeposit] = useState("200");
  const [editRate, setEditRate] = useState("60");
  const [editDeposit, setEditDeposit] = useState("300");

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    try {
      const loggedIn =
        localStorage.getItem("unishare_logged_in") === "true" ||
        document.cookie.includes("unishare_logged_in=true");
      if (!loggedIn) {
        router.replace("/login?redirect=/my-products");
      } else {
        setIsAuthenticated(true);
      }
    } catch {
      setIsAuthenticated(true);
    }
  }, [router]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2200);
  };

  // State toggles
  const handleToggleState = (item: ProductItem) => {
    if (item.state === "paused") {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === item.id
            ? {
                ...p,
                state: "active",
                availText: "Available today",
                note: "Resumed by you today",
              }
            : p
        )
      );
      triggerToast(`Listing "${item.name}" resumed and active.`);
    } else if (item.state === "active") {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === item.id
            ? {
                ...p,
                state: "paused",
                availText: "Not accepting bookings",
                note: "Paused by you today",
              }
            : p
        )
      );
      triggerToast(`Listing "${item.name}" paused.`);
    }
  };

  const handleDeleteDraft = (id: string, name: string) => {
    if (window.confirm(`Delete the draft "${name}"?`)) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      triggerToast(`Draft "${name}" was deleted.`);
    }
  };

  const handleFinishDraft = (item: ProductItem) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === item.id
          ? {
              ...p,
              state: "active",
              availText: "Available today",
              note: "Published to DU Campus shelf today",
            }
          : p
      )
    );
    triggerToast(`Draft "${item.name}" finished and published!`);
  };

  const openPricingModal = (item: ProductItem) => {
    setSelectedProduct(item);
    setEditRate(item.rate.toString());
    setEditDeposit(item.deposit.toString());
    setShowPriceModal(true);
  };

  const savePricing = () => {
    if (!selectedProduct) return;
    const r = parseInt(editRate, 10);
    const d = parseInt(editDeposit, 10);
    if (isNaN(r) || r <= 0 || isNaN(d) || d < 0) {
      triggerToast("Please enter valid positive token values.");
      return;
    }
    setProducts((prev) =>
      prev.map((p) =>
        p.id === selectedProduct.id ? { ...p, rate: r, deposit: d } : p
      )
    );
    setShowPriceModal(false);
    triggerToast(`Updated pricing for ${selectedProduct.name}.`);
  };

  const openDatesModal = (item: ProductItem) => {
    setSelectedProduct(item);
    setShowDatesModal(true);
  };

  const handleCreateProduct = (asDraft = false) => {
    if (!newTitle.trim()) {
      triggerToast("Please provide a product title.");
      return;
    }
    const r = parseInt(newRate, 10) || 30;
    const d = parseInt(newDeposit, 10) || 100;
    const newItem: ProductItem = {
      id: `p-${Date.now()}`,
      name: newTitle.trim(),
      category: newCat,
      condition: newCondition,
      state: asDraft ? "draft" : "active",
      rate: r,
      deposit: d,
      image:
        newCat === "Cameras"
          ? "/images/products/product-1.jpeg"
          : newCat === "Study essentials"
          ? "/images/products/product-2.jpeg"
          : newCat === "Camera accessories"
          ? "/images/products/product-3.jpeg"
          : "/images/products/product-4.jpeg",
      note: asDraft
        ? "Add availability to finish your listing"
        : "Listed by you today",
      availText: asDraft ? "Not published" : "Available today",
      owner: "Farhana Rahman · You",
    };
    setProducts((prev) => [newItem, ...prev]);
    setShowAddModal(false);
    setNewTitle("");
    triggerToast(asDraft ? "Saved new draft listing." : `Published "${newItem.name}"!`);
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      localStorage.removeItem("unishare_logged_in");
      localStorage.removeItem("unishare_user");
      document.cookie = "unishare_logged_in=; path=/; max-age=0";
    } catch {}
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
          <span>My products</span>
        </nav>

        {/* Header Title & Add Product Button */}
        <div className="head">
          <div>
            <div className="eyebrow">
              University of Dhaka · Verified students only
            </div>
            <h1>My products</h1>
            <p className="lede">
              Your shared shelf. Manage listings, prices and the days you can
              lend.
            </p>
          </div>
          <button
            className="btn solid"
            type="button"
            onClick={() => setShowAddModal(true)}
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
          </button>
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
            <b>360 tokens</b>
            <span>This month</span>
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
            <select
              id="cat"
              aria-label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              <option value="Cameras">Cameras</option>
              <option value="Study essentials">Study essentials</option>
              <option value="Camera accessories">Camera accessories</option>
              <option value="Travel essentials">Travel essentials</option>
            </select>
          </label>
          <label className="fb">
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
                  <img src={p.image} alt={p.name} />
                  <div>
                    <small>
                      {p.category} · {p.condition}
                    </small>
                    <h3>{p.name}</h3>
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
                        onClick={() => handleDeleteDraft(p.id, p.name)}
                      >
                        Delete draft
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          triggerToast(
                            `Editing details for "${p.name}". Photo & title ready.`
                          )
                        }
                      >
                        Edit product
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleToggleState(p)}
                      >
                        {p.state === "paused" ? "Resume" : "Pause listing"}
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
            <b>Your listings are visible only to verified DU students.</b>
            <span>
              Keep condition, photos and availability up to date. Pausing stops
              new requests without cancelling confirmed rentals.
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer>
        <span>UniShare. Made for university students in Bangladesh.</span>
        <nav>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              triggerToast("Campus Privacy Policy: Student data is protected.");
            }}
          >
            Privacy
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              triggerToast("University of Dhaka Sharing Honor Code.");
            }}
          >
            Terms
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              triggerToast("Campus Helpdesk: support@unishare.du.ac.bd");
            }}
          >
            Get help
          </a>
          <a href="#" onClick={handleLogout}>
            Log out
          </a>
        </nav>
      </footer>

      {/* Modal: Add Product */}
      {showAddModal && (
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
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              border: "1.5px solid var(--line)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "14px" }}>
              Add a new product
            </h3>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "16px" }}>
              Share items you own with fellow verified DU students.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                  Product title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scientific Calculator fx-991EX"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: "100%",
                    border: "1px solid var(--hair)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                    Category
                  </label>
                  <select
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    style={{
                      width: "100%",
                      border: "1px solid var(--hair)",
                      borderRadius: "6px",
                      padding: "8px",
                      fontSize: "12px",
                    }}
                  >
                    <option>Cameras</option>
                    <option>Study essentials</option>
                    <option>Camera accessories</option>
                    <option>Travel essentials</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                    Condition
                  </label>
                  <select
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value)}
                    style={{
                      width: "100%",
                      border: "1px solid var(--hair)",
                      borderRadius: "6px",
                      padding: "8px",
                      fontSize: "12px",
                    }}
                  >
                    <option>Like new</option>
                    <option>Good</option>
                    <option>Fair</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                    Tokens / day
                  </label>
                  <input
                    type="number"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
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
                    Deposit (tokens)
                  </label>
                  <input
                    type="number"
                    value={newDeposit}
                    onChange={(e) => setNewDeposit(e.target.value)}
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
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => handleCreateProduct(true)}
              >
                Save as draft
              </button>
              <button
                type="button"
                className="btn solid"
                onClick={() => handleCreateProduct(false)}
              >
                Publish now
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
              Block out exam weeks or dates when you will need this item for personal use.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
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
                onClick={() => {
                  setShowDatesModal(false);
                  triggerToast("Calendar availability updated for campus borrowers.");
                }}
              >
                Confirm dates
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
                FR
              </div>
              <div>
                <b style={{ fontSize: "16px", display: "block" }}>Farhana Rahman</b>
                <small style={{ color: "var(--muted)", fontSize: "12px" }}>farhana@std.du.ac.bd</small>
                <div style={{ fontSize: "11px", color: "var(--teal)", fontWeight: 700, marginTop: "2px" }}>
                  University of Dhaka · Verified Member 🛡️
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
                <b>2021-DU-8491</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Department:</span>
                <b>Computer Science &amp; Eng.</b>
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
