"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Edit3, LogOut, PackageOpen, User, Phone, Mail } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { formatINR, getApiUrl } from "@/lib/api";
import { CustomerProfile, clearSavedCustomerProfile, getSavedCustomerProfile, saveCustomerProfile } from "@/lib/customer";
import { PhoneInput } from "@/components/phone-input";
import { validateAndNormalizeIndianPhone } from "@/lib/phone";

type Order = { reference: string; status: string; total: string; created_at: string };

export function AccountPanel() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [supabaseEmail, setSupabaseEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [note, setNote] = useState("");

  // Editing profile modal / state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSavedMsg, setEditSavedMsg] = useState("");

  useEffect(() => {
    let active = true;

    // 1. Check local customer profile
    const local = getSavedCustomerProfile();
    if (local && active) {
      setProfile(local);
      setEditName(local.fullName);
      setEditPhone(local.phone);
      setEditEmail(local.email || "");
    }

    // 2. Check Supabase session
    const client = getSupabaseClient();
    if (client) {
      client.auth.getSession().then(async ({ data }) => {
        if (!active) return;
        const session = data.session;
        if (session) {
          setSupabaseEmail(session.user.email ?? null);
          const metaName = session.user.user_metadata?.full_name;
          const metaPhone = session.user.user_metadata?.phone;

          if (metaName || metaPhone) {
            setProfile((prev) => ({
              fullName: metaName || prev?.fullName || "Floretttz Customer",
              phone: metaPhone || prev?.phone || "",
              email: session.user.email || prev?.email,
              savedAt: prev?.savedAt || new Date().toISOString(),
            }));
          }

          // Fetch account-linked orders
          try {
            const res = await fetch(`${getApiUrl()}/api/orders/me`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (res.ok && active) {
              setOrders((await res.json()) as Order[]);
            } else if (active) {
              setNote("Account active. Order history syncs when orders are created while signed in.");
            }
          } catch {
            if (active) setNote("Unable to reach the order history service right now.");
          }
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, []);

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    const phoneCheck = validateAndNormalizeIndianPhone(editPhone);
    if (!phoneCheck.isValid) {
      alert(phoneCheck.error || "Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    const updated = saveCustomerProfile({
      fullName: editName.trim() || "Floretttz Customer",
      phone: phoneCheck.normalized,
      email: editEmail.trim() || undefined,
    });

    setProfile(updated);
    setIsEditing(false);
    setEditSavedMsg("Profile updated successfully!");
    setTimeout(() => setEditSavedMsg(""), 3000);
  }

  function handleSignOut() {
    clearSavedCustomerProfile();
    const client = getSupabaseClient();
    if (client) client.auth.signOut();
    setProfile(null);
    setSupabaseEmail(null);
    setOrders([]);
    window.location.reload();
  }

  if (loading) {
    return <p className="text-ink/70">Checking customer profile and session…</p>;
  }

  if (!profile && !supabaseEmail) {
    return (
      <div className="rounded-xl border border-rose/25 bg-white p-6 sm:p-8 shadow-sm">
        <PackageOpen className="h-9 w-9 text-rose" />
        <h2 className="display mt-4 text-3xl text-forest">No customer profile found</h2>
        <p className="mt-2 max-w-lg leading-7 text-ink/70">
          Enter your name and Indian mobile number once for fast WhatsApp ordering, or sign in to your existing space.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/register" className="button-primary">
            Quick Customer Setup
          </Link>
          <Link href="/login" className="button-secondary">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {editSavedMsg && (
        <div role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 font-semibold flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600" />
          {editSavedMsg}
        </div>
      )}

      {/* Customer Profile Card */}
      <section className="rounded-xl border border-rose/25 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose/15 pb-4">
          <div>
            <p className="eyebrow">Customer Profile</p>
            <h2 className="font-display text-2xl text-forest mt-0.5">{profile?.fullName || "Floretttz Customer"}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="button-secondary text-xs inline-flex items-center gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {isEditing ? "Cancel" : "Edit Details"}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="button-secondary text-xs text-rose hover:bg-rose/10 inline-flex items-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="mt-4 max-w-md space-y-4">
            <div>
              <label className="text-sm font-semibold text-ink" htmlFor="edit-name">
                Full Name
              </label>
              <input
                id="edit-name"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="field mt-1"
                placeholder="e.g., Priya Sharma"
              />
            </div>

            <PhoneInput
              id="edit-phone"
              label="Indian Mobile Number"
              required
              value={editPhone}
              onChange={(normalized) => setEditPhone(normalized)}
            />

            <div>
              <label className="text-sm font-semibold text-ink" htmlFor="edit-email">
                Email (Optional)
              </label>
              <input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="field mt-1"
                placeholder="e.g., priya@example.com"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="button-primary text-sm">
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="button-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            <div className="flex items-center gap-3 rounded-lg bg-[#fff9f5] p-3 border border-rose/15">
              <User className="h-5 w-5 text-forest shrink-0" />
              <div>
                <dt className="text-xs text-ink/60 font-semibold uppercase tracking-wider">Full Name</dt>
                <dd className="font-bold text-ink mt-0.5">{profile?.fullName || "Not specified"}</dd>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-[#fff9f5] p-3 border border-rose/15">
              <Phone className="h-5 w-5 text-forest shrink-0" />
              <div>
                <dt className="text-xs text-ink/60 font-semibold uppercase tracking-wider">Indian Mobile (+91)</dt>
                <dd className="font-mono font-bold text-ink mt-0.5">{profile?.phone || "Not set"}</dd>
              </div>
            </div>

            {profile?.email && (
              <div className="flex items-center gap-3 rounded-lg bg-[#fff9f5] p-3 border border-rose/15 sm:col-span-2">
                <Mail className="h-5 w-5 text-forest shrink-0" />
                <div>
                  <dt className="text-xs text-ink/60 font-semibold uppercase tracking-wider">Email Address</dt>
                  <dd className="font-medium text-ink mt-0.5">{profile.email}</dd>
                </div>
              </div>
            )}
          </dl>
        )}
      </section>

      {/* Order History */}
      <section className="rounded-xl border border-rose/25 bg-white p-5 sm:p-6 shadow-sm">
        <h2 className="font-display text-2xl text-forest">Order History</h2>
        {note && <p className="mt-3 rounded-lg bg-[#fff4ee] p-3 text-sm leading-6 text-ink/70">{note}</p>}
        {orders.length ? (
          <ul className="mt-4 divide-y divide-rose/15">
            {orders.map((order) => (
              <li key={order.reference} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold font-mono">{order.reference}</p>
                  <p className="text-sm text-ink/65">
                    {new Date(order.created_at).toLocaleDateString("en-IN")} · {order.status.replaceAll("_", " ")}
                  </p>
                </div>
                <p className="font-bold text-forest">{formatINR(order.total)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-6 text-ink/65">
            No account-linked orders yet. When checking out, orders made with this phone number will be confirmed with you directly on WhatsApp.
          </p>
        )}
      </section>
    </div>
  );
}
