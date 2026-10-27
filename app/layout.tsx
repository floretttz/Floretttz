import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CommunityBanner } from "@/components/community-banner";
import { WhatsAppFloatingCommunity } from "@/components/whatsapp-floating-community";

export const metadata: Metadata = {
  title: { default: "FLORETTTZ | Handmade gifts, blooms & more", template: "%s | FLORETTTZ" },
  description: "Handmade flowers, thoughtful gifts, decor, and personalised keepsakes from Floretttz.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body className="min-h-screen flex flex-col bg-[#fff9f4] text-[#302a2c] antialiased">
        <CartProvider>
          <CommunityBanner />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <WhatsAppFloatingCommunity />
        </CartProvider>
      </body>
    </html>
  );
}
