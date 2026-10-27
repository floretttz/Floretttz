"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  Check,
  Edit3,
  ExternalLink,
  FolderTree,
  Image as ImageIcon,
  Layers,
  Lock,
  LogOut,
  Minus,
  Package,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { PhoneInput } from "@/components/phone-input";
import {
  adminLogin,
  createAdminCategory,
  createAdminProduct,
  createAdminVariant,
  deleteAdminVariant,
  fetchAdminOrders,
  fetchAdminOverview,
  fetchAdminProducts,
  fetchAuthMe,
  fetchNotionStatus,
  formatINR,
  getCategories,
  getWhatsAppChannelUrl,
  getWhatsAppGroupUrl,
  getWhatsAppNumber,
  isPlaceholderWhatsAppNumber,
  updateAdminOrderStatus,
  updateAdminProduct,
  uploadAdminImage,
} from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";
import type { AdminOrder, AdminOverview, Category, Product } from "@/lib/types";

type AdminTab = "overview" | "products" | "orders" | "categories" | "settings";

export default function AdminPage() {
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string>("");

  // Sign in form state (for direct admin sign-in)
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  // Overview metrics
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Product Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Add Product form fields
  const [newSku, setNewSku] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<number | undefined>(undefined);
  const [newPublished, setNewPublished] = useState(true);
  const [newOrderable, setNewOrderable] = useState(true);
  const [newFeatured, setNewFeatured] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");

  // Variant addition form inside edit modal
  const [variantSku, setVariantSku] = useState("");
  const [variantName, setVariantName] = useState("");
  const [variantPrice, setVariantPrice] = useState("");

  // Orders state
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");

  // Category addition modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [catSlug, setCatSlug] = useState("");
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  // Upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  // Notion state
  const [notionStatus, setNotionStatus] = useState<{
    connected: boolean;
    configured: boolean;
    bot_user?: string;
    database_id?: string;
    database_title?: string;
    error?: string;
  } | null>(null);
  const [notionLoading, setNotionLoading] = useState(false);

  // Store Owner / Staff Contact profile in Settings (fixed +91 format)
  const [adminName, setAdminName] = useState("ISHUPISHU");
  const [adminPhone, setAdminPhone] = useState("+91" + getWhatsAppNumber().replace(/\D/g, "").slice(-10));
  const [adminContactSaved, setAdminContactSaved] = useState(false);

  function handleSaveAdminContact(e: FormEvent) {
    e.preventDefault();
    setAdminContactSaved(true);
    setTimeout(() => setAdminContactSaved(false), 3000);
  }

  // 1. Initial Authentication Check
  useEffect(() => {
    const client = getSupabaseClient();
    setSupabaseConfigured(Boolean(client));

    const storedToken = typeof window !== "undefined" ? localStorage.getItem("floretttz_admin_token") : null;
    const storedEmail = typeof window !== "undefined" ? localStorage.getItem("floretttz_admin_email") : null;

    if (storedToken) {
      fetchAuthMe(storedToken)
        .then((me) => {
          setSessionToken(storedToken);
          setUserRole(me.role);
          if (storedEmail) setUserEmail(storedEmail);
          setAuthChecked(true);
        })
        .catch(() => {
          if (typeof window !== "undefined") {
            localStorage.removeItem("floretttz_admin_token");
            localStorage.removeItem("floretttz_admin_email");
          }
          checkSupabase();
        });
    } else {
      checkSupabase();
    }

    function checkSupabase() {
      if (!client) {
        setAuthChecked(true);
        return;
      }
      client.auth.getSession().then(async ({ data }) => {
        const session = data.session;
        if (!session) {
          setAuthChecked(true);
          return;
        }
        setSessionToken(session.access_token);
        setUserEmail(session.user.email ?? "");

        try {
          const me = await fetchAuthMe(session.access_token);
          setUserRole(me.role);
        } catch (err) {
          setAuthError(err instanceof Error ? err.message : "Failed to verify permissions");
          setUserRole("customer");
        } finally {
          setAuthChecked(true);
        }
      });
    }
  }, []);

  // 2. Load Categories
  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  // 3. Load Data When Authorized and Tab Changes
  useEffect(() => {
    if (!sessionToken || (userRole !== "admin" && userRole !== "catalog_manager")) return;

    if (activeTab === "overview") {
      setOverviewLoading(true);
      fetchAdminOverview(sessionToken)
        .then(setOverview)
        .catch(() => {})
        .finally(() => setOverviewLoading(false));
    } else if (activeTab === "products") {
      loadProducts();
    } else if (activeTab === "orders" && userRole === "admin") {
      loadOrders();
    } else if (activeTab === "settings" && userRole === "admin") {
      setNotionLoading(true);
      fetchNotionStatus(sessionToken)
        .then(setNotionStatus)
        .catch(() => {})
        .finally(() => setNotionLoading(false));
    }
  }, [activeTab, sessionToken, userRole]);

  function loadProducts() {
    if (!sessionToken) return;
    setProductsLoading(true);
    fetchAdminProducts(sessionToken, { q: searchQuery, status_filter: statusFilter, page_size: 100 })
      .then((res) => setProducts(res.items))
      .catch((err) => setFormError(err.message))
      .finally(() => setProductsLoading(false));
  }

  function loadOrders() {
    if (!sessionToken || userRole !== "admin") return;
    setOrdersLoading(true);
    fetchAdminOrders(sessionToken, orderStatusFilter)
      .then(setOrders)
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAuthError("");
    setLoginBusy(true);

    const client = getSupabaseClient();
    let loggedIn = false;

    // A. Attempt Supabase Auth first if client is available
    if (client) {
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        });

        if (!error && data.session) {
          setSessionToken(data.session.access_token);
          setUserEmail(data.session.user.email ?? "");
          try {
            const me = await fetchAuthMe(data.session.access_token);
            setUserRole(me.role);
          } catch {
            setUserRole("customer");
          }
          loggedIn = true;
        }
      } catch {
        // Fall back to backend admin-login endpoint below
      }
    }

    // B. If Supabase auth did not log in, authenticate directly with backend
    if (!loggedIn) {
      try {
        const res = await adminLogin({
          email: loginEmail,
          password: loginPassword,
        });
        setSessionToken(res.access_token);
        setUserEmail(res.email);
        setUserRole(res.role);
        if (typeof window !== "undefined") {
          localStorage.setItem("floretttz_admin_token", res.access_token);
          localStorage.setItem("floretttz_admin_email", res.email);
        }
        loggedIn = true;
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : "Invalid admin credentials");
      }
    }

    setLoginBusy(false);
  }

  async function handleSignOut() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("floretttz_admin_token");
      localStorage.removeItem("floretttz_admin_email");
    }
    const client = getSupabaseClient();
    if (client) await client.auth.signOut().catch(() => {});
    setSessionToken(null);
    setUserRole(null);
    setUserEmail("");
  }

  async function toggleProductPublished(product: Product) {
    if (!sessionToken) return;
    try {
      const updated = await updateAdminProduct(sessionToken, product.id, {
        published: !product.published,
      });
      setProducts((current) => current.map((p) => (p.id === product.id ? updated : p)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle product status");
    }
  }

  async function toggleProductOrderable(product: Product) {
    if (!sessionToken) return;
    try {
      const updated = await updateAdminProduct(sessionToken, product.id, {
        available_for_order: !product.available_for_order,
      });
      setProducts((current) => current.map((p) => (p.id === product.id ? updated : p)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle availability");
    }
  }

  async function handleCreateProduct(e: FormEvent) {
    e.preventDefault();
    if (!sessionToken) return;
    setFormSubmitting(true);
    setFormError("");

    try {
      const priceNum = newPrice.trim() ? parseFloat(newPrice) : null;
      const created = await createAdminProduct(sessionToken, {
        sku: newSku.trim(),
        slug: newSlug.trim() || newSku.trim().toLowerCase(),
        name: newName.trim(),
        description: newDesc.trim() || "Handmade Floretttz piece.",
        price: priceNum,
        image_url: newImageUrl.trim() || null,
        published: newPublished,
        available_for_order: newOrderable,
        featured: newFeatured,
        category_id: newCategoryId ? Number(newCategoryId) : null,
      });

      setProducts((cur) => [created, ...cur]);
      setShowAddModal(false);
      // Reset form
      setNewSku("");
      setNewSlug("");
      setNewName("");
      setNewDesc("");
      setNewPrice("");
      setNewImageUrl("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleUpdateProduct(e: FormEvent) {
    e.preventDefault();
    if (!sessionToken || !editingProduct) return;
    setFormSubmitting(true);
    setFormError("");

    try {
      const updated = await updateAdminProduct(sessionToken, editingProduct.id, {
        name: editingProduct.name,
        slug: editingProduct.slug,
        description: editingProduct.description,
        price: editingProduct.price !== null ? parseFloat(String(editingProduct.price)) : null,
        image_url: editingProduct.image_url ?? null,
        published: editingProduct.published,
        available_for_order: editingProduct.available_for_order,
        featured: editingProduct.featured,
        category_id: editingProduct.category ? editingProduct.category.id : null,
      });

      setProducts((cur) => cur.map((p) => (p.id === editingProduct.id ? updated : p)));
      setEditingProduct(updated);
      alert("Product updated successfully!");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update product");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleAddVariant(e: FormEvent) {
    e.preventDefault();
    if (!sessionToken || !editingProduct) return;
    try {
      await createAdminVariant(sessionToken, editingProduct.id, {
        sku: variantSku.trim(),
        name: variantName.trim(),
        price: parseFloat(variantPrice),
        available_for_order: true,
      });
      // Refresh current product
      const res = await fetchAdminProducts(sessionToken, { q: editingProduct.sku });
      const refreshed = res.items.find((p) => p.id === editingProduct.id);
      if (refreshed) {
        setEditingProduct(refreshed);
        setProducts((cur) => cur.map((p) => (p.id === refreshed.id ? refreshed : p)));
      }
      setVariantSku("");
      setVariantName("");
      setVariantPrice("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add variant");
    }
  }

  async function handleDeleteVariant(variantId: number) {
    if (!sessionToken || !editingProduct || !confirm("Delete this variant?")) return;
    try {
      await deleteAdminVariant(sessionToken, variantId);
      const res = await fetchAdminProducts(sessionToken, { q: editingProduct.sku });
      const refreshed = res.items.find((p) => p.id === editingProduct.id);
      if (refreshed) {
        setEditingProduct(refreshed);
        setProducts((cur) => cur.map((p) => (p.id === refreshed.id ? refreshed : p)));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete variant");
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, target: "new" | "edit") {
    const file = e.target.files?.[0];
    if (!file || !sessionToken) return;

    setUploadingImage(true);
    setUploadMessage("");
    try {
      const res = await uploadAdminImage(sessionToken, file);
      if (target === "new") {
        setNewImageUrl(res.url);
      } else if (editingProduct) {
        setEditingProduct({ ...editingProduct, image_url: res.url });
      }
      setUploadMessage(`Uploaded: ${res.filename}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleUpdateOrderStatus(orderId: number, newStatus: string) {
    if (!sessionToken) return;
    try {
      const updated = await updateAdminOrderStatus(sessionToken, orderId, newStatus);
      setOrders((cur) => cur.map((o) => (o.id === orderId ? updated : o)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update order status");
    }
  }

  async function handleCreateCategory(e: FormEvent) {
    e.preventDefault();
    if (!sessionToken) return;
    try {
      const created = await createAdminCategory(sessionToken, {
        slug: catSlug.trim(),
        name: catName.trim(),
        description: catDesc.trim() || undefined,
      });
      setCategories((cur) => [...cur, created]);
      setShowCatModal(false);
      setCatSlug("");
      setCatName("");
      setCatDesc("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create category");
    }
  }

  // --- Render Auth and Setup States ---

  if (!authChecked) {
    return (
      <main className="container-page py-16 text-center">
        <h1 className="sr-only">FLORETTTZ Admin Workspace</h1>
        <RefreshCw className="mx-auto h-7 w-7 animate-spin text-forest" />
        <p className="mt-3 text-ink/70">Checking authentication state…</p>
      </main>
    );
  }

  // State 1: Supabase not configured in client
  if (!supabaseConfigured) {
    return (
      <main className="container-page py-10 sm:py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose/30 bg-white p-6 sm:p-9 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage/20 text-forest">
            <Lock className="h-6 w-6" />
          </div>
          <p className="eyebrow mt-5">Setup required</p>
          <h1 className="display mt-1 text-3xl sm:text-4xl text-forest">Supabase Configuration Required</h1>
          <p className="mt-4 leading-7 text-ink/75">
            The FLORETTTZ administrative interface requires an active Supabase project for cryptographic token verification and server-enforced role assignments.
          </p>

          <div className="mt-6 rounded-xl border border-sage/40 bg-[#f7f9f6] p-5">
            <h2 className="font-semibold text-forest flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Checklist for the Store Owner
            </h2>
            <ol className="mt-3 list-decimal list-inside space-y-2 text-sm text-ink/80 leading-6">
              <li>Create a project in <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-forest font-bold underline">Supabase</a>.</li>
              <li>Apply migrations in <code className="bg-white px-1.5 py-0.5 rounded border">backend/migrations/</code> to your database.</li>
              <li>Set <code className="bg-white px-1.5 py-0.5 rounded border">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="bg-white px-1.5 py-0.5 rounded border">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (or publishable key) in <code className="bg-white px-1.5 py-0.5 rounded border">.env</code>.</li>
              <li>Run <code className="bg-white px-1.5 py-0.5 rounded border">python -m app.bootstrap_admin --user-id &lt;UUID&gt; --token &lt;TOKEN&gt;</code> to assign the first admin.</li>
            </ol>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/" className="button-secondary">Return to store</Link>
            <Link href="/shop" className="button-primary">Browse catalogue</Link>
          </div>
        </div>
      </main>
    );
  }

  // State 2: Not signed in
  if (!sessionToken) {
    return (
      <main className="container-page py-10 sm:py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-rose/30 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-white">
            <Lock className="h-5 w-5" />
          </div>
          <p className="eyebrow mt-4">Authorized access only</p>
          <h1 className="display mt-1 text-3xl text-forest">Staff sign in</h1>
          <p className="mt-2 text-sm text-ink/70">
            Sign in with your FLORETTTZ administrator or catalogue manager credentials.
          </p>

          <form onSubmit={handleLogin} className="mt-6 grid gap-4">
            <div>
              <label className="text-sm font-semibold" htmlFor="admin-email">Email address</label>
              <input
                id="admin-email"
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="field mt-1"
                placeholder="staff@floretttz.in"
              />
            </div>
            <div>
              <label className="text-sm font-semibold" htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="field mt-1"
              />
            </div>

            {authError && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {authError}
              </p>
            )}

            <button type="submit" disabled={loginBusy} className="button-primary w-full mt-2">
              {loginBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Sign in to workspace"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-ink/60">
            Customer browsing? <Link href="/" className="font-bold text-forest underline">Back to store</Link>
          </p>
        </div>
      </main>
    );
  }

  // State 3: Signed in, but role is only customer
  if (userRole !== "admin" && userRole !== "catalog_manager") {
    return (
      <main className="container-page py-12 sm:py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-6 sm:p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-12 w-12 text-rose" />
          <h1 className="display mt-3 text-3xl text-forest">Access Denied</h1>
          <p className="mt-3 text-sm leading-6 text-ink/75">
            You are signed in as <strong>{userEmail}</strong> with role: <code className="bg-rose/10 px-1.5 py-0.5 rounded font-bold text-rose">{userRole ?? "customer"}</code>.
          </p>
          <p className="mt-2 text-xs leading-5 text-ink/65">
            This workspace requires <span className="font-bold">Catalog Manager</span> or <span className="font-bold">Admin</span> privileges. Role assignment cannot be self-granted through the client.
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <button onClick={handleSignOut} className="button-secondary">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
            <Link href="/account" className="button-primary">Go to your account</Link>
          </div>
        </div>
      </main>
    );
  }

  // State 4: Fully authorized Staff/Admin Workspace!
  return (
    <main className="container-page py-8 sm:py-10">
      {/* Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rose/20 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow">FLORETTTZ workspace</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${userRole === "admin" ? "bg-forest text-white" : "bg-sage/40 text-forest"}`}>
              {userRole === "admin" ? "Administrator" : "Catalog Manager"}
            </span>
          </div>
          <h1 className="display mt-1 text-3xl sm:text-4xl text-forest">Store Management</h1>
          <p className="text-xs text-ink/65 mt-0.5">Signed in as {userEmail}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/shop" target="_blank" className="button-secondary text-xs">
            <ExternalLink className="h-3.5 w-3.5" /> View live store
          </Link>
          <button onClick={handleSignOut} className="button-secondary text-xs text-rose hover:bg-rose/10">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <nav className="mt-6 flex flex-wrap gap-2 border-b border-rose/20 pb-3" aria-label="Admin tabs">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${activeTab === "overview" ? "bg-forest text-white" : "bg-white text-forest hover:bg-sage/15"}`}
        >
          <Layers className="h-4 w-4" /> Overview
        </button>
        <button
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${activeTab === "products" ? "bg-forest text-white" : "bg-white text-forest hover:bg-sage/15"}`}
        >
          <Package className="h-4 w-4" /> Products & Variants
        </button>
        {userRole === "admin" && (
          <button
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${activeTab === "orders" ? "bg-forest text-white" : "bg-white text-forest hover:bg-sage/15"}`}
          >
            <ShoppingBag className="h-4 w-4" /> Orders
          </button>
        )}
        <button
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${activeTab === "categories" ? "bg-forest text-white" : "bg-white text-forest hover:bg-sage/15"}`}
        >
          <FolderTree className="h-4 w-4" /> Categories
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${activeTab === "settings" ? "bg-forest text-white" : "bg-white text-forest hover:bg-sage/15"}`}
        >
          <SettingsIcon className="h-4 w-4" /> Store Settings
        </button>
      </nav>

      {/* --- TAB 1: OVERVIEW --- */}
      {activeTab === "overview" && (
        <section className="mt-8 space-y-8">
          {overviewLoading ? (
            <div className="py-12 text-center text-ink/70">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-forest" />
              <p className="mt-2 text-sm">Loading metrics from database…</p>
            </div>
          ) : overview ? (
            <div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-rose/25 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink/60">Total Products</p>
                  <p className="mt-2 text-3xl font-display text-forest">{overview.total_products}</p>
                  <p className="mt-1 text-xs text-ink/65">{overview.published_products} published · {overview.draft_products} drafts</p>
                </div>
                <div className="rounded-xl border border-rose/25 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink/60">Active Categories</p>
                  <p className="mt-2 text-3xl font-display text-forest">{overview.total_categories}</p>
                  <p className="mt-1 text-xs text-ink/65">Bouquets, gifts, lamps, decor</p>
                </div>
                <div className="rounded-xl border border-rose/25 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink/60">Total Orders</p>
                  <p className="mt-2 text-3xl font-display text-forest">{overview.total_orders}</p>
                  <p className="mt-1 text-xs text-ink/65">{overview.pending_orders} pending confirmation</p>
                </div>
                <div className="rounded-xl border border-rose/25 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink/60">Order Value</p>
                  <p className="mt-2 text-3xl font-display text-forest">{formatINR(overview.total_revenue)}</p>
                  <p className="mt-1 text-xs text-ink/65">Authoritative server totals</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-8 rounded-xl border border-rose/20 bg-[#fff5f0] p-6">
                <h2 className="font-display text-2xl text-forest">Quick Actions</h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      setActiveTab("products");
                      setShowAddModal(true);
                    }}
                    className="button-primary text-sm"
                  >
                    <Plus className="h-4 w-4" /> Add new product
                  </button>
                  {userRole === "admin" && (
                    <button onClick={() => setActiveTab("orders")} className="button-secondary text-sm">
                      <ShoppingBag className="h-4 w-4" /> Review customer orders
                    </button>
                  )}
                  <button onClick={() => setActiveTab("categories")} className="button-secondary text-sm">
                    <FolderTree className="h-4 w-4" /> Manage categories
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink/70">Metrics unavailable.</p>
          )}
        </section>
      )}

      {/* --- TAB 2: PRODUCTS & VARIANTS --- */}
      {activeTab === "products" && (
        <section className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest" />
                <input
                  type="text"
                  placeholder="Search by name, SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadProducts()}
                  className="field pl-9 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setTimeout(loadProducts, 50);
                }}
                className="field text-sm"
              >
                <option value="all">All statuses</option>
                <option value="published">Published only</option>
                <option value="draft">Drafts / Unpublished</option>
              </select>

              <button onClick={() => setShowAddModal(true)} className="button-primary text-sm shrink-0">
                <Plus className="h-4 w-4" /> New piece
              </button>
            </div>
          </div>

          {productsLoading ? (
            <div className="py-12 text-center text-ink/70">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-forest" />
              <p className="mt-2 text-sm">Loading products…</p>
            </div>
          ) : products.length ? (
            <div className="overflow-x-auto rounded-xl border border-rose/25 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-rose/20 bg-[#faf6f3] text-xs font-bold uppercase text-ink/70">
                  <tr>
                    <th className="p-3.5">Piece</th>
                    <th className="p-3.5">SKU</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Price</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Availability</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose/15">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-ivory/50">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-rose/20 bg-blush/20">
                            {p.image_url ? (
                              <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-rose font-bold">FLR</div>
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-ink">{p.name}</span>
                            {p.variants.length > 0 && (
                              <span className="ml-2 rounded bg-sage/20 px-1.5 py-0.5 text-[0.68rem] font-bold text-forest">
                                {p.variants.length} options
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-xs text-ink/70">{p.sku}</td>
                      <td className="p-3.5 text-xs text-ink/80">{p.category?.name ?? "—"}</td>
                      <td className="p-3.5 font-bold">{formatINR(p.price)}</td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => toggleProductPublished(p)}
                          className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${p.published ? "bg-forest text-white hover:bg-forest/80" : "bg-rose/20 text-ink/70 hover:bg-rose/30"}`}
                        >
                          {p.published ? "Published" : "Draft"}
                        </button>
                      </td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => toggleProductOrderable(p)}
                          className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${p.available_for_order ? "bg-sage/30 text-forest hover:bg-sage/40" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                        >
                          {p.available_for_order ? "Orderable" : "Unavailable"}
                        </button>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setEditingProduct(p)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-forest hover:underline"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-rose/30 bg-white p-8 text-center text-ink/70">
              No products found matching filters.
            </div>
          )}
        </section>
      )}

      {/* --- TAB 3: ORDERS (ADMIN ONLY) --- */}
      {activeTab === "orders" && userRole === "admin" && (
        <section className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-2xl text-forest">Order Requests</h2>
            <div className="flex items-center gap-3">
              <select
                value={orderStatusFilter}
                onChange={(e) => {
                  setOrderStatusFilter(e.target.value);
                  setTimeout(loadOrders, 50);
                }}
                className="field text-sm"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="awaiting_confirmation">Awaiting confirmation</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button onClick={loadOrders} className="button-secondary text-xs">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
          </div>

          {ordersLoading ? (
            <div className="py-12 text-center text-ink/70">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-forest" />
              <p className="mt-2 text-sm">Loading orders…</p>
            </div>
          ) : orders.length ? (
            <div className="grid gap-4">
              {orders.map((o) => (
                <article key={o.id} className="rounded-xl border border-rose/25 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rose/15 pb-3">
                    <div>
                      <span className="font-mono text-xs font-bold text-forest">{o.reference}</span>
                      <p className="text-xs text-ink/65 mt-0.5">{new Date(o.created_at).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink/65">Status:</span>
                      <select
                        value={o.status}
                        onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                        className="rounded-md border border-rose/30 bg-white px-2 py-1 text-xs font-bold text-forest"
                      >
                        <option value="pending">Pending</option>
                        <option value="awaiting_confirmation">Awaiting confirmation</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold text-ink/60 uppercase tracking-wider">Customer details</p>
                      <p className="mt-1 font-semibold text-sm">{o.customer_name}</p>
                      <p className="text-sm text-ink/75">{o.customer_phone}</p>
                      <a
                        href={`https://wa.me/${o.customer_phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-forest underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Contact customer on WhatsApp
                      </a>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-ink/60 uppercase tracking-wider">Order items ({o.items.length})</p>
                      <ul className="mt-1 space-y-1 text-sm text-ink/80">
                        {o.items.map((it) => (
                          <li key={it.id}>
                            • {it.product_name} {it.variant_name ? `(${it.variant_name})` : ""} × {it.quantity} — {formatINR(Number(it.unit_price) * it.quantity)}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-base font-bold text-ink">Total: {formatINR(o.total)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-rose/30 bg-white p-8 text-center text-ink/70">
              No orders found for selected filter.
            </div>
          )}
        </section>
      )}

      {/* --- TAB 4: CATEGORIES --- */}
      {activeTab === "categories" && (
        <section className="mt-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-forest">Store Categories</h2>
            <button onClick={() => setShowCatModal(true)} className="button-primary text-sm">
              <Plus className="h-4 w-4" /> Add category
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <div key={c.id} className="rounded-xl border border-rose/25 bg-white p-4 shadow-sm">
                <h3 className="font-display text-lg text-forest">{c.name}</h3>
                <p className="mt-0.5 font-mono text-xs text-ink/60">{c.slug}</p>
                <p className="mt-2 text-xs leading-5 text-ink/75">{c.description || "No description provided."}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- TAB 5: STORE SETTINGS & SETUP --- */}
      {activeTab === "settings" && (
        <section className="mt-8 space-y-6 max-w-2xl">
          <div className="rounded-xl border border-rose/25 bg-white p-6 shadow-sm">
            <h2 className="font-display text-2xl text-forest">Store Information</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between border-b border-rose/15 pb-2">
                <dt className="text-ink/65">Store Brand</dt>
                <dd className="font-bold">FLORETTTZ</dd>
              </div>
              <div className="flex justify-between border-b border-rose/15 pb-2">
                <dt className="text-ink/65">WhatsApp Contact</dt>
                <dd className="font-mono font-bold">+{getWhatsAppNumber()}</dd>
              </div>
              {isPlaceholderWhatsAppNumber() && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 leading-5">
                  <strong>⚠️ Placeholder Warning:</strong> Store WhatsApp number is currently set to the default placeholder (<code>919999999999</code>).
                  Set <code>NEXT_PUBLIC_WHATSAPP_NUMBER</code> in frontend <code>.env</code> and <code>FLORETTTZ_WHATSAPP_NUMBER</code> in backend configuration with your verified business phone number before launching to customers.
                </div>
              )}
              <div className="flex justify-between border-b border-rose/15 pb-2">
                <dt className="text-ink/65">Checkout Model</dt>
                <dd className="font-bold text-forest">WhatsApp Handoff (No online card processing)</dd>
              </div>
              <div className="flex justify-between border-b border-rose/15 pb-2">
                <dt className="text-ink/65">Authoritative Price Validation</dt>
                <dd className="font-bold text-forest flex items-center gap-1">
                  <Check className="h-4 w-4 text-forest" /> Server-enforced
                </dd>
              </div>
            </dl>
          </div>

          {/* Store Owner & Staff Profile Card with fixed +91 Phone Format */}
          <div className="rounded-xl border border-rose/25 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest text-white">
                <UserCheck className="h-4 w-4" />
              </div>
              <h2 className="font-display text-xl text-forest">Store Owner & Staff Contact</h2>
            </div>
            <p className="mt-1 text-xs text-ink/70 leading-5">
              Contact information for store notifications and communications. Fixed +91 Indian format is applied to owner contact numbers without altering server-side authentication factors.
            </p>

            <form onSubmit={handleSaveAdminContact} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink/70" htmlFor="admin-profile-name">
                  Staff / Owner Name
                </label>
                <input
                  id="admin-profile-name"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="field mt-1 text-sm"
                  placeholder="e.g. Store Administrator"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink/70" htmlFor="admin-profile-email">
                  Admin Email (Server-Enforced)
                </label>
                <input
                  id="admin-profile-email"
                  type="email"
                  value={userEmail || "staff@floretttz.in"}
                  disabled
                  className="field mt-1 text-sm bg-gray-50 opacity-80 cursor-not-allowed"
                />
                <p className="mt-1 text-[11px] text-ink/60">
                  Role assignments and admin access remain strictly governed by server-side Supabase token verification.
                </p>
              </div>

              <PhoneInput
                id="admin-profile-phone"
                label="Owner WhatsApp / Mobile (+91)"
                value={adminPhone}
                onChange={(normalized) => setAdminPhone(normalized)}
                showHelper
              />

              <div className="pt-1 flex items-center gap-3">
                <button type="submit" className="button-primary text-xs min-h-[40px]">
                  Save Contact Profile
                </button>
                {adminContactSaved && (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Contact profile saved
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Notion Integration Card */}
          <div className="rounded-xl border border-rose/25 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest text-white">
                  <Layers className="h-4 w-4" />
                </div>
                <h3 className="font-display text-xl text-forest">Notion Integration</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (sessionToken) {
                    setNotionLoading(true);
                    fetchNotionStatus(sessionToken)
                      .then(setNotionStatus)
                      .catch(() => {})
                      .finally(() => setNotionLoading(false));
                  }
                }}
                disabled={notionLoading}
                className="button-secondary text-xs"
              >
                <RefreshCw className={`h-3 w-3 ${notionLoading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              {notionLoading ? (
                <div className="flex items-center gap-2 py-4 text-ink/70">
                  <RefreshCw className="h-4 w-4 animate-spin text-forest" />
                  <span>Checking live Notion API connection…</span>
                </div>
              ) : notionStatus ? (
                <>
                  <div className="flex items-center justify-between border-b border-rose/15 pb-2">
                    <span className="text-ink/65">Connection State</span>
                    <span className={`inline-flex items-center gap-1 font-bold ${notionStatus.connected ? "text-emerald-700" : "text-amber-800"}`}>
                      {notionStatus.connected ? <Check className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                      {notionStatus.connected ? "Connected to Notion API" : "Not connected"}
                    </span>
                  </div>

                  {notionStatus.bot_user && (
                    <div className="flex items-center justify-between border-b border-rose/15 pb-2">
                      <span className="text-ink/65">Authorized Bot User</span>
                      <span className="font-mono font-bold text-forest">{notionStatus.bot_user}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-b border-rose/15 pb-2">
                    <span className="text-ink/65">Target Database</span>
                    <span className="font-mono text-xs">
                      {notionStatus.database_title
                        ? notionStatus.database_title
                        : notionStatus.database_id
                        ? notionStatus.database_id
                        : "Not shared / unselected"}
                    </span>
                  </div>

                  {!notionStatus.database_id && notionStatus.connected && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 leading-5">
                      <strong>⚠️ Notion Database Sharing Required:</strong>
                      <p className="mt-1">
                        The bot integration <strong>{notionStatus.bot_user || "Floretttz's"}</strong> is authenticated, but no database has been shared with it yet.
                      </p>
                      <ol className="mt-2 list-decimal list-inside space-y-1">
                        <li>Open your Notion Orders database in your browser or app.</li>
                        <li>Click the <code>•••</code> menu at the top right of the page.</li>
                        <li>Scroll to <strong>Connections</strong> (or <strong>Add connections</strong>).</li>
                        <li>Search and select <strong>Floretttz&apos;s</strong>.</li>
                        <li>Optionally copy its database ID into <code>FLORETTTZ_NOTION_DATABASE_ID</code> in <code>backend/.env</code>.</li>
                      </ol>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-ink/60">Switch to this tab as administrator to verify live Notion connectivity.</p>
              )}
            </div>
          </div>

          {/* WhatsApp Community Links Card */}
          <div className="rounded-xl border border-rose/25 bg-white p-6 shadow-sm">
            <h3 className="font-display text-xl text-forest">WhatsApp Community Links</h3>
            <p className="mt-1 text-xs text-ink/70">
              Verified community URLs configured for customer invitations.
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-rose/15 pb-3">
                <div>
                  <span className="font-semibold text-forest flex items-center gap-1.5">
                    <Users className="h-4 w-4" /> WhatsApp Group
                  </span>
                  <span className="font-mono text-[11px] text-ink/60 truncate max-w-sm block">
                    {getWhatsAppGroupUrl()}
                  </span>
                </div>
                <a
                  href={getWhatsAppGroupUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button-secondary text-xs shrink-0 inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> Test Link
                </a>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-rose/15 pb-3">
                <div>
                  <span className="font-semibold text-forest flex items-center gap-1.5">
                    <Radio className="h-4 w-4" /> WhatsApp Channel
                  </span>
                  <span className="font-mono text-[11px] text-ink/60 truncate max-w-sm block">
                    {getWhatsAppChannelUrl()}
                  </span>
                </div>
                <a
                  href={getWhatsAppChannelUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button-secondary text-xs shrink-0 inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> Test Link
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-sage/40 bg-sage/10 p-6 shadow-sm">
            <h3 className="font-semibold text-forest flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Security & Role Hierarchy
            </h3>
            <p className="mt-2 text-xs leading-6 text-ink/75">
              • <strong>Customer</strong>: View catalogue, browse products, place guest/authenticated WhatsApp order, view own order history.
              <br />
              • <strong>Catalog Manager</strong>: Create and update products, manage variants, upload images, manage categories.
              <br />
              • <strong>Admin</strong>: All manager permissions, plus view and manage customer orders, assign user roles, and monitor Notion sync.
            </p>
          </div>
        </section>
      )}

      {/* --- MODAL: ADD PRODUCT --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-rose/20 pb-3">
              <h2 className="font-display text-2xl text-forest">Add New Product</h2>
              <button onClick={() => setShowAddModal(false)} className="text-ink/60 hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink/70" htmlFor="product-name">Product Name *</label>
                <input
                  id="product-name"
                  required
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug) setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                  }}
                  className="field mt-1 text-sm"
                  placeholder="e.g. Lavender Blossom Bouquet"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-ink/70" htmlFor="product-sku">SKU *</label>
                  <input
                    id="product-sku"
                    required
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    className="field mt-1 text-sm font-mono"
                    placeholder="FLR-LAVENDER"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-ink/70" htmlFor="product-slug">Slug *</label>
                  <input
                    id="product-slug"
                    required
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    className="field mt-1 text-sm font-mono"
                    placeholder="lavender-blossom-bouquet"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-ink/70">Category</label>
                  <select
                    value={newCategoryId ?? ""}
                    onChange={(e) => setNewCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                    className="field mt-1 text-sm"
                  >
                    <option value="">Select a category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-ink/70" htmlFor="product-price">Price (INR)</label>
                  <div className="mt-1 flex items-center">
                    <button
                      type="button"
                      onClick={() => setNewPrice((cur) => String(Math.max(0, (parseFloat(cur) || 0) - 50)))}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-l-lg border border-r-0 border-[#c7babb] bg-[#fbf5f2] text-forest hover:bg-rose/15 active:bg-rose/25"
                      aria-label="Decrease price by 50"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      id="product-price"
                      type="number"
                      step="1"
                      min="0"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="field text-sm rounded-none text-center h-11"
                      placeholder="e.g. 499"
                    />
                    <button
                      type="button"
                      onClick={() => setNewPrice((cur) => String((parseFloat(cur) || 0) + 50))}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-r-lg border border-l-0 border-[#c7babb] bg-[#fbf5f2] text-forest hover:bg-rose/15 active:bg-rose/25"
                      aria-label="Increase price by 50"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink/70" htmlFor="product-desc">Description</label>
                <textarea
                  id="product-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  className="field mt-1 text-sm resize-y"
                  placeholder="Details about craftsmanship, materials, dimensions..."
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink/70">Product Photography</label>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => handleImageUpload(e, "new")}
                    className="text-xs file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-forest/80"
                  />
                  {uploadingImage && <RefreshCw className="h-4 w-4 animate-spin text-forest" />}
                </div>
                {newImageUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={newImageUrl} alt="Preview" className="h-12 w-12 rounded object-cover border" />
                    <span className="text-xs text-forest font-bold">Image attached</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold">
                  <input type="checkbox" checked={newPublished} onChange={(e) => setNewPublished(e.target.checked)} />
                  Published to storefront
                </label>
                <label className="flex items-center gap-2 text-xs font-bold">
                  <input type="checkbox" checked={newOrderable} onChange={(e) => setNewOrderable(e.target.checked)} />
                  Available to order
                </label>
                <label className="flex items-center gap-2 text-xs font-bold">
                  <input type="checkbox" checked={newFeatured} onChange={(e) => setNewFeatured(e.target.checked)} />
                  Feature on homepage
                </label>
              </div>

              {formError && (
                <div className="flex items-center justify-between rounded-lg bg-red-50 p-2.5 text-xs text-red-800 border border-red-200">
                  <span>{formError}</span>
                  <button
                    type="button"
                    onClick={() => setFormError("")}
                    className="ml-2 font-bold underline hover:text-red-950 shrink-0"
                  >
                    Clear validation feedback
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-rose/15">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormError("");
                  }}
                  className="button-secondary text-xs min-h-[44px] px-4"
                >
                  Cancel
                </button>
                <button id="btn-save-product" type="submit" disabled={formSubmitting} className="button-primary text-xs min-h-[44px] px-4">
                  {formSubmitting ? "Saving…" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: EDIT PRODUCT & VARIANTS --- */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-rose/20 pb-3">
              <div>
                <span className="text-xs font-mono text-ink/60">{editingProduct.sku}</span>
                <h2 className="font-display text-2xl text-forest">Edit Piece Details</h2>
              </div>
              <button onClick={() => setEditingProduct(null)} className="text-ink/60 hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink/70">Name</label>
                <input
                  required
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="field mt-1 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-ink/70">Category</label>
                  <select
                    value={editingProduct.category?.id ?? ""}
                    onChange={(e) => {
                      const sel = categories.find((c) => c.id === Number(e.target.value));
                      setEditingProduct({ ...editingProduct, category: sel ?? null });
                    }}
                    className="field mt-1 text-sm"
                  >
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-ink/70">Base Price (INR)</label>
                  <div className="mt-1 flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(String(editingProduct.price ?? "0")) || 0;
                        setEditingProduct({ ...editingProduct, price: String(Math.max(0, cur - 50)) });
                      }}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-l-lg border border-r-0 border-[#c7babb] bg-[#fbf5f2] text-forest hover:bg-rose/15 active:bg-rose/25"
                      aria-label="Decrease price by 50"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      value={editingProduct.price ?? ""}
                      onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                      className="field text-sm rounded-none text-center h-11"
                      placeholder="e.g. 499"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(String(editingProduct.price ?? "0")) || 0;
                        setEditingProduct({ ...editingProduct, price: String(cur + 50) });
                      }}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-r-lg border border-l-0 border-[#c7babb] bg-[#fbf5f2] text-forest hover:bg-rose/15 active:bg-rose/25"
                      aria-label="Increase price by 50"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink/70">Description</label>
                <textarea
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  rows={3}
                  className="field mt-1 text-sm resize-y"
                />
              </div>

              {/* Photo */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink/70">Photo</label>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => handleImageUpload(e, "edit")}
                    className="text-xs file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                  />
                  {uploadingImage && <RefreshCw className="h-4 w-4 animate-spin text-forest" />}
                </div>
                {editingProduct.image_url && (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={editingProduct.image_url} alt="" className="h-12 w-12 rounded object-cover border" />
                    <button
                      type="button"
                      onClick={() => setEditingProduct({ ...editingProduct, image_url: null })}
                      className="text-xs text-rose underline"
                    >
                      Remove photo
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={editingProduct.published}
                    onChange={(e) => setEditingProduct({ ...editingProduct, published: e.target.checked })}
                  />
                  Published
                </label>
                <label className="flex items-center gap-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={editingProduct.available_for_order}
                    onChange={(e) => setEditingProduct({ ...editingProduct, available_for_order: e.target.checked })}
                  />
                  Available to order
                </label>
                <label className="flex items-center gap-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={editingProduct.featured}
                    onChange={(e) => setEditingProduct({ ...editingProduct, featured: e.target.checked })}
                  />
                  Featured
                </label>
              </div>

              {formError && (
                <div className="flex items-center justify-between rounded-lg bg-red-50 p-2.5 text-xs text-red-800 border border-red-200">
                  <span>{formError}</span>
                  <button
                    type="button"
                    onClick={() => setFormError("")}
                    className="ml-2 font-bold underline hover:text-red-950 shrink-0"
                  >
                    Clear validation feedback
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-rose/15">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setFormError("");
                  }}
                  className="button-secondary text-xs min-h-[44px] px-4"
                >
                  Cancel
                </button>
                <button type="submit" disabled={formSubmitting} className="button-primary text-xs min-h-[44px] px-4">
                  {formSubmitting ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>

            {/* Variants Manager */}
            <div className="mt-6 border-t border-rose/20 pt-4">
              <h3 className="font-semibold text-sm text-forest">Product Variants / Options</h3>
              {editingProduct.variants.length > 0 ? (
                <ul className="mt-2 divide-y divide-rose/10 text-xs">
                  {editingProduct.variants.map((v) => (
                    <li key={v.id} className="flex items-center justify-between py-2">
                      <div>
                        <span className="font-bold">{v.name}</span> · <span className="font-mono text-ink/60">{v.sku}</span> · {formatINR(v.price)}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteVariant(v.id)}
                        className="text-rose hover:underline min-h-[32px] min-w-[32px] inline-flex items-center justify-center"
                        aria-label={`Delete variant ${v.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-ink/60">No variants created yet.</p>
              )}

              {/* Add Variant Form */}
              <form onSubmit={handleAddVariant} className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  required
                  placeholder="Option Name (e.g. Premium)"
                  value={variantName}
                  onChange={(e) => {
                    setVariantName(e.target.value);
                    if (!variantSku) setVariantSku(`${editingProduct.sku}-${e.target.value.toUpperCase().replace(/\s+/g, "")}`);
                  }}
                  className="field text-xs min-h-[44px]"
                />
                <input
                  required
                  placeholder="Variant SKU"
                  value={variantSku}
                  onChange={(e) => setVariantSku(e.target.value)}
                  className="field text-xs font-mono min-h-[44px]"
                />
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => setVariantPrice((cur) => String(Math.max(0, (parseFloat(cur) || 0) - 50)))}
                      className="flex h-11 w-10 shrink-0 items-center justify-center rounded-l-md border border-r-0 border-[#c7babb] bg-[#fbf5f2] text-forest hover:bg-rose/15"
                      aria-label="Decrease variant price by 50"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      required
                      type="number"
                      placeholder="Price"
                      value={variantPrice}
                      onChange={(e) => setVariantPrice(e.target.value)}
                      className="field text-xs rounded-none text-center h-11"
                    />
                    <button
                      type="button"
                      onClick={() => setVariantPrice((cur) => String((parseFloat(cur) || 0) + 50))}
                      className="flex h-11 w-10 shrink-0 items-center justify-center rounded-r-md border border-l-0 border-[#c7babb] bg-[#fbf5f2] text-forest hover:bg-rose/15"
                      aria-label="Increase variant price by 50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button className="button-secondary text-xs shrink-0 min-h-[44px] px-3.5">Add</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD CATEGORY --- */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-rose/20 pb-3">
              <h2 className="font-display text-2xl text-forest">Add Category</h2>
              <button onClick={() => setShowCatModal(false)} className="text-ink/60 hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink/70" htmlFor="category-name">Category Name *</label>
                <input
                  id="category-name"
                  required
                  value={catName}
                  onChange={(e) => {
                    setCatName(e.target.value);
                    if (!catSlug) setCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                  }}
                  className="field mt-1 text-sm"
                  placeholder="e.g. Wedding Keepsakes"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink/70" htmlFor="category-slug">Category Slug *</label>
                <input
                  id="category-slug"
                  required
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  className="field mt-1 text-sm font-mono"
                  placeholder="wedding-keepsakes"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink/70" htmlFor="category-desc">Description</label>
                <textarea
                  id="category-desc"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  rows={2}
                  className="field mt-1 text-sm resize-y"
                  placeholder="Brief note about the category"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-rose/15">
                <button type="button" onClick={() => setShowCatModal(false)} className="button-secondary text-xs">
                  Cancel
                </button>
                <button id="btn-save-category" type="submit" className="button-primary text-xs">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
