import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Customer Setup & Registration",
  description: "Simple customer entry for easy WhatsApp ordering and tracking with Floretttz.",
};

export default function RegisterPage() {
  return (
    <div className="container-page py-8 sm:py-14">
      <section className="mx-auto max-w-lg rounded-2xl border border-rose/25 bg-white p-5 sm:p-8 shadow-sm">
        <p className="eyebrow">Customer setup</p>
        <h1 className="display mt-1 text-3xl sm:text-4xl text-forest">Quick customer entry</h1>
        <p className="mt-2 text-sm leading-6 text-ink/75">
          Enter your name and Indian mobile number once. Your details will be ready for fast WhatsApp orders and tracking. No email verification or OTP required.
        </p>

        <div className="mt-6">
          <AuthForm mode="register" />
        </div>
      </section>
    </div>
  );
}
