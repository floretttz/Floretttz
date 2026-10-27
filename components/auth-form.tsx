"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, LoaderCircle, Shield, UserCheck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { PhoneInput } from "@/components/phone-input";
import { validateAndNormalizeIndianPhone } from "@/lib/phone";
import { getSavedCustomerProfile, saveCustomerProfile } from "@/lib/customer";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const isRegister = mode === "register";

  // Form fields
  const [fullName, setFullName] = useState("");
  const [phoneNormalized, setPhoneNormalized] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [email, setEmail] = useState("");

  // Optional password fields
  const [wantsPassword, setWantsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Pre-load existing profile if present
  useEffect(() => {
    const saved = getSavedCustomerProfile();
    if (saved) {
      if (!fullName) setFullName(saved.fullName);
      if (!phoneNormalized) {
        setPhoneNormalized(saved.phone);
        const check = validateAndNormalizeIndianPhone(saved.phone);
        setPhoneRaw(check.rawDigits);
        setPhoneValid(check.isValid);
      }
      if (!email && saved.email) setEmail(saved.email);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    // 1. Validate required customer phone
    const phoneCheck = validateAndNormalizeIndianPhone(phoneRaw || phoneNormalized);
    if (!phoneCheck.isValid) {
      setMessage({
        type: "error",
        text: phoneCheck.error || "Please enter a valid 10-digit Indian mobile number.",
      });
      return;
    }

    // 2. Validate Full Name
    if (isRegister && fullName.trim().length < 2) {
      setMessage({ type: "error", text: "Please enter your full name (at least 2 letters)." });
      return;
    }

    // 3. Handle optional password validation if enabled
    if (wantsPassword) {
      if (password.length < 8) {
        setMessage({ type: "error", text: "Password must be at least 8 characters long." });
        return;
      }
      if (isRegister && password !== confirmPassword) {
        setMessage({ type: "error", text: "Passwords do not match. Please re-enter." });
        return;
      }
    }

    setBusy(true);

    try {
      // Save customer profile locally (works seamlessly for guest & authenticated access)
      saveCustomerProfile({
        fullName: fullName.trim() || "Floretttz Customer",
        phone: phoneCheck.normalized,
        email: email.trim() || undefined,
      });

      // If user chose password authentication and Supabase client is active
      const client = getSupabaseClient();
      if (wantsPassword && client) {
        const authEmail = email.trim() || `${phoneCheck.rawDigits}@customer.floretttz.in`;
        if (isRegister) {
          const res = await client.auth.signUp({
            email: authEmail,
            password,
            options: {
              data: {
                full_name: fullName.trim(),
                phone: phoneCheck.normalized,
              },
            },
          });
          if (res.error) throw res.error;
        } else {
          const res = await client.auth.signInWithPassword({
            email: authEmail,
            password,
          });
          if (res.error) throw res.error;
        }
      }

      setMessage({
        type: "success",
        text: isRegister
          ? `Welcome to Floretttz, ${fullName.trim()}! Your customer details are saved. You can proceed directly to checkout anytime.`
          : "Signed in successfully. Your Floretttz profile and preferences are active.",
      });

      setTimeout(() => {
        router.push("/cart");
      }, 1500);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Unable to complete request. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      {/* 1. Full Name — required */}
      {isRegister && (
        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="customer-full-name">
            Full Name <span className="text-rose">*</span>
          </label>
          <input
            id="customer-full-name"
            type="text"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            placeholder="e.g., Priya Sharma"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="field mt-1"
          />
        </div>
      )}

      {/* 2. Indian mobile number — required, with fixed +91 */}
      <div>
        <PhoneInput
          id="customer-mobile-number"
          label="Phone Number"
          required
          value={phoneRaw || phoneNormalized}
          onChange={(normalized, raw, valid) => {
            setPhoneNormalized(normalized);
            setPhoneRaw(raw);
            setPhoneValid(valid);
          }}
          autoComplete="tel-national"
        />
      </div>

      {/* 3. Email address — optional */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-ink" htmlFor="customer-email">
            Email (Optional)
          </label>
          <span className="text-xs text-ink/60">You can leave this blank</span>
        </div>
        <input
          id="customer-email"
          type="email"
          autoComplete="email"
          placeholder="e.g., priya@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field mt-1"
        />
        <p className="mt-1 text-xs text-ink/60">Optional. We use WhatsApp for fast order updates.</p>
      </div>

      {/* 4. Optional Password Authentication */}
      <div className="rounded-xl border border-rose/25 bg-[#faf5f1] p-4">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={wantsPassword}
            onChange={(e) => setWantsPassword(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-forest focus:ring-forest"
          />
          <div>
            <span className="text-sm font-bold text-forest">
              {isRegister ? "Protect my account with a password (optional)" : "Sign in using my password"}
            </span>
            <p className="text-xs text-ink/70 leading-5">
              {isRegister
                ? "You can leave this unchecked to save your profile without a password for simple guest checkout."
                : "Leave unchecked to sign in / resume with your saved customer profile."}
            </p>
          </div>
        </label>

        {wantsPassword && (
          <div className="mt-4 space-y-4 border-t border-rose/20 pt-4">
            {/* Password input */}
            <div>
              <label className="text-sm font-semibold text-ink" htmlFor="customer-password">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="customer-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  required={wantsPassword}
                  minLength={8}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink/60 hover:text-forest"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-ink/65">
                Must be at least 8 characters. Never shared or visible to others.
              </p>
            </div>

            {/* Confirm Password input */}
            {isRegister && (
              <div>
                <label className="text-sm font-semibold text-ink" htmlFor="customer-confirm-password">
                  Confirm Password
                </label>
                <div className="relative mt-1">
                  <input
                    id="customer-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required={wantsPassword}
                    minLength={8}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="field pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink/60 hover:text-forest"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Messages */}
      {message && (
        <div
          role={message.type === "error" ? "alert" : "status"}
          className={`flex items-start gap-2 rounded-lg p-3 text-sm leading-6 ${
            message.type === "error"
              ? "bg-red-50 text-red-800 border border-red-200"
              : message.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-sage/15 text-forest"
          }`}
        >
          {message.type === "success" && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={busy}
        className="button-primary w-full disabled:opacity-60 min-h-[46px] text-base"
      >
        {busy ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" /> Saving…
          </>
        ) : isRegister ? (
          <span className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" /> Save Customer Profile
          </span>
        ) : wantsPassword ? (
          "Sign In"
        ) : (
          "Continue with saved profile"
        )}
      </button>

      {/* Switch between sign in and register */}
      <p className="text-center text-sm text-ink/75">
        {isRegister ? "Already entered your details?" : "Need to set up your customer details?"}{" "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-bold text-forest underline underline-offset-4"
        >
          {isRegister ? "Sign in / View Account" : "Quick Customer Setup"}
        </Link>
      </p>

      {/* Clear Admin Separation */}
      <div className="mt-2 border-t border-rose/15 pt-4 text-center">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/70 hover:text-forest underline underline-offset-4"
        >
          <Shield className="h-3.5 w-3.5 text-forest" />
          Store Administrator or Staff? Sign in here
        </Link>
      </div>
    </form>
  );
}
