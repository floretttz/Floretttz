"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { formatINR, getApiUrl } from "@/lib/api";
import { lineKey, useCart } from "@/components/cart-provider";
import { getSupabaseClient } from "@/lib/supabase";
import { PhoneInput } from "@/components/phone-input";
import { validateAndNormalizeIndianPhone } from "@/lib/phone";
import { getSavedCustomerProfile, saveCustomerProfile } from "@/lib/customer";

type CheckoutResult = { reference: string; total: string; whatsapp_url: string; message: string };

export default function CartPage() {
  const { lines, ready, subtotal, updateQuantity, remove, clear } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);

  const localTotal = useMemo(() => formatINR(subtotal), [subtotal]);

  // Pre-fill customer details from saved profile if available
  useEffect(() => {
    const profile = getSavedCustomerProfile();
    if (profile) {
      if (!name) setName(profile.fullName);
      if (!phone) {
        setPhone(profile.phone);
        const check = validateAndNormalizeIndianPhone(profile.phone);
        setPhoneRaw(check.rawDigits);
        setPhoneValid(check.isValid);
      }
    }
  }, []);

  async function beginWhatsApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!lines.length) return;

    // Validate Indian phone number
    const check = validateAndNormalizeIndianPhone(phoneRaw || phone);
    if (!check.isValid) {
      setError(check.error || "Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (name.trim().length < 2) {
      setError("Please enter your name (at least 2 characters).");
      return;
    }

    setSubmitting(true);
    const targetApiUrl = getApiUrl();

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const client = getSupabaseClient();
      if (client) {
        const { data } = await client.auth.getSession();
        if (data.session?.access_token) {
          headers["Authorization"] = `Bearer ${data.session.access_token}`;
        }
      }

      let response: Response;
      try {
        response = await fetch(`${targetApiUrl}/api/orders/whatsapp-handoff`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            customer_name: name.trim(),
            customer_phone: check.normalized,
            idempotency_key: crypto.randomUUID(),
            items: lines.map((line) => ({
              product_id: line.product.id,
              variant_id: line.variant?.id,
              quantity: line.quantity,
              personalisation: line.personalisation,
            })),
          }),
        });
      } catch (networkError) {
        const domain = targetApiUrl.replace(/^https?:\/\//, "");
        console.error("[Checkout Network/CORS Error]:", networkError);
        setError(
          `Unable to reach the checkout service (${domain}). Please check your internet connection or try again in a moment.`
        );
        return;
      }

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        // Response was not JSON
      }

      if (!response.ok) {
        let detailMessage = `Server error (${response.status} ${response.statusText || ""})`.trim();
        if (payload && typeof payload === "object" && "detail" in payload) {
          const d = (payload as { detail: unknown }).detail;
          detailMessage = typeof d === "string" ? d : JSON.stringify(d);
        }
        setError(detailMessage || "Unable to validate the order.");
        return;
      }

      if (!payload || typeof payload !== "object" || !("reference" in payload)) {
        setError("Invalid response received from order service. Please try again.");
        return;
      }

      // Save customer profile for next time
      saveCustomerProfile({
        fullName: name.trim(),
        phone: check.normalized,
      });

      setResult(payload as CheckoutResult);
      clear();
    } catch (caught) {
      console.error("[Checkout Error]:", caught);
      setError(caught instanceof Error ? caught.message : "Unable to begin the WhatsApp handoff. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="display text-3xl text-forest">Your Cart</h1>
        <p className="mt-3 text-ink/70">Loading your cart…</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="container-page py-10 sm:py-14">
        <div className="mx-auto max-w-xl rounded-2xl border border-sage bg-white p-6 text-center sm:p-9 shadow-sm">
          <p className="eyebrow">Order request created</p>
          <h1 className="display mt-2 text-3xl sm:text-4xl text-forest">One last step in WhatsApp</h1>
          <p className="mt-4 leading-7 text-ink/75">
            Reference: <strong className="font-mono">{result.reference}</strong>
            <br />
            Validated total: <strong>{formatINR(result.total)}</strong>
          </p>
          <p className="mt-4 rounded-lg bg-[#fff4ee] p-3 text-sm leading-6 text-ink/70">{result.message}</p>
          {result.whatsapp_url.includes("919999999999") && (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 leading-5">
              <strong>Store setup note:</strong> This handoff link uses the default placeholder contact (
              <code>+91 9999999999</code>). Configure <code>NEXT_PUBLIC_WHATSAPP_NUMBER</code> in <code>.env</code> before
              going live.
            </p>
          )}
          <a
            href={result.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="button-primary mt-6 w-full min-h-[48px] text-base"
          >
            Open WhatsApp with my order
          </a>
          <Link href="/shop" className="button-secondary mt-3 w-full">
            Continue browsing
          </Link>
        </div>
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="container-page py-12 sm:py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-rose/50 bg-white p-8 text-center shadow-sm">
          <ShoppingBag className="mx-auto h-10 w-10 text-rose" />
          <h1 className="display mt-4 text-3xl text-forest">Your cart is waiting for something lovely</h1>
          <p className="mt-3 leading-6 text-ink/70">Add a handmade piece to start an order request.</p>
          <Link href="/shop" className="button-primary mt-6">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-8 sm:py-12">
      <p className="eyebrow">Your cart</p>
      <h1 className="display mt-1 text-4xl text-forest sm:text-5xl">Almost there</h1>

      <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_390px] lg:items-start">
        {/* Cart items list */}
        <section className="rounded-xl border border-rose/25 bg-white shadow-sm overflow-hidden">
          {lines.map((line) => (
            <article
              key={lineKey(line)}
              className="flex flex-col sm:flex-row gap-3 sm:gap-5 border-b border-rose/15 p-4 last:border-0"
            >
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-blush/35 font-display text-2xl text-rose">
                ✦
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl text-ink">{line.product.name}</h2>
                {line.variant && <p className="mt-1 text-sm text-ink/65">{line.variant.name}</p>}
                {line.personalisation && (
                  <p className="mt-1 truncate text-sm text-ink/65">Note: {line.personalisation}</p>
                )}
                <p className="mt-2 font-bold text-forest">
                  {formatINR(line.variant?.price ?? line.product.price)}
                </p>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex h-10 items-center rounded-md border border-rose/40 bg-white">
                    <button
                      type="button"
                      onClick={() => updateQuantity(lineKey(line), line.quantity - 1)}
                      className="grid h-full w-10 place-items-center text-forest hover:bg-rose/10 active:bg-rose/20"
                      aria-label={`Reduce ${line.product.name} quantity`}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(lineKey(line), line.quantity + 1)}
                      className="grid h-full w-10 place-items-center text-forest hover:bg-rose/10 active:bg-rose/20"
                      aria-label={`Increase ${line.product.name} quantity`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(lineKey(line))}
                    className="inline-flex h-10 items-center gap-1.5 px-2 text-sm font-semibold text-rose hover:underline"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>

              <div className="text-right sm:text-right mt-1 sm:mt-0">
                <span className="text-xs text-ink/60 sm:hidden">Line total: </span>
                <span className="shrink-0 font-bold text-ink">
                  {formatINR(Number(line.variant?.price ?? line.product.price ?? 0) * line.quantity)}
                </span>
              </div>
            </article>
          ))}
        </section>

        {/* Checkout aside with India Phone Input */}
        <aside className="rounded-xl border border-rose/25 bg-[#fff4ee] p-5 sm:p-6 shadow-sm">
          <h2 className="font-display text-2xl text-forest">Order handoff</h2>

          <dl className="mt-4 space-y-2 border-b border-rose/25 pb-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/65">Cart subtotal</dt>
              <dd className="font-bold">{localTotal}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/65">Payment</dt>
              <dd className="font-semibold text-forest">Confirmed on WhatsApp</dd>
            </div>
          </dl>

          <p className="mt-4 text-xs leading-5 text-ink/70">
            The server rechecks catalogue records and prices before creating a pending order. Opening WhatsApp is not
            payment or order acceptance.
          </p>

          <form onSubmit={beginWhatsApp} className="mt-5 grid gap-4">
            <div>
              <label className="text-sm font-semibold text-ink" htmlFor="customer-name">
                Your Name <span className="text-rose">*</span>
              </label>
              <input
                id="customer-name"
                required
                minLength={2}
                maxLength={160}
                placeholder="e.g., Priya Sharma"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="field mt-1"
                autoComplete="name"
              />
            </div>

            <PhoneInput
              id="customer-phone"
              label="WhatsApp number"
              required
              value={phoneRaw || phone}
              onChange={(normalized, raw, valid) => {
                setPhone(normalized);
                setPhoneRaw(raw);
                setPhoneValid(valid);
              }}
              autoComplete="tel-national"
            />

            {error && (
              <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
                {error}
              </p>
            )}

            <button
              disabled={submitting}
              className="button-primary mt-1 w-full min-h-[46px] text-base disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Validating…
                </>
              ) : (
                "Create request & open WhatsApp"
              )}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
