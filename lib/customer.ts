/**
 * Customer profile storage and session helpers for Floretttz.
 * Supports guest customers without requiring passwords, as well as password-authenticated sessions.
 */

export interface CustomerProfile {
  fullName: string;
  phone: string; // E.164: +919876543210
  email?: string;
  savedAt: string;
}

const STORAGE_KEY = "floretttz_customer_profile";

export function getSavedCustomerProfile(): CustomerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CustomerProfile;
  } catch {
    return null;
  }
}

export function saveCustomerProfile(profile: Omit<CustomerProfile, "savedAt">): CustomerProfile {
  const fullProfile: CustomerProfile = {
    ...profile,
    savedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fullProfile));
    } catch {
      // storage unavailable / quota
    }
  }
  return fullProfile;
}

export function clearSavedCustomerProfile(): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
