import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Customer Sign In",
  description: "Sign in to your Floretttz customer space or look up your order preferences.",
};

export default function LoginPage() {
  return (
    <div className="container-page py-8 sm:py-14">
      <section className="mx-auto max-w-lg rounded-2xl border border-rose/25 bg-white p-5 sm:p-8 shadow-sm">
        <p className="eyebrow">Your Floretttz space</p>
        <h1 className="display mt-1 text-3xl sm:text-4xl text-forest">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-ink/75">
          Enter your Indian mobile number to resume your saved customer profile or sign in with your password.
        </p>

        <div className="mt-6">
          <AuthForm mode="login" />
        </div>
      </section>
    </div>
  );
}
