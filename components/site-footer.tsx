import Link from "next/link";
import { MessageCircle, Users, Radio } from "lucide-react";
import { getWhatsAppGroupUrl, getWhatsAppChannelUrl } from "@/lib/api";

export function SiteFooter() {
  const groupUrl = getWhatsAppGroupUrl();
  const channelUrl = getWhatsAppChannelUrl();

  return (
    <footer className="mt-16 border-t border-rose/25 bg-[#fff4ee] py-12">
      <div className="container-page grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <section>
          <p className="font-display text-2xl text-forest">FLORETTTZ</p>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Handmade gifts, blooms, and little things made personal. Join our community on WhatsApp to stay updated on new drops and custom pieces.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-forest">Community</h2>
          <div className="mt-3 flex flex-col gap-2.5 text-sm">
            <a
              href={groupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-sage/40 bg-white/70 px-3 py-2 font-medium text-forest transition-colors hover:bg-white hover:text-rose"
              aria-label="Join Our WhatsApp Group (opens in new tab)"
            >
              <Users className="h-4 w-4 shrink-0 text-forest" />
              <span>Join Our WhatsApp Group</span>
            </a>
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-sage/40 bg-white/70 px-3 py-2 font-medium text-forest transition-colors hover:bg-white hover:text-rose"
              aria-label="Follow Our WhatsApp Channel (opens in new tab)"
            >
              <Radio className="h-4 w-4 shrink-0 text-forest" />
              <span>Follow Our WhatsApp Channel</span>
            </a>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-forest">Shop</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            <li><Link href="/shop" className="text-ink/80 hover:text-forest">All products</Link></li>
            <li><Link href="/shop?category=flowers" className="text-ink/80 hover:text-forest">Bouquets & flowers</Link></li>
            <li><Link href="/shop?category=gifts" className="text-ink/80 hover:text-forest">Personalised gifts</Link></li>
            <li><Link href="/shop?category=festive" className="text-ink/80 hover:text-forest">Festive hampers</Link></li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-forest">Help & Orders</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            <li><Link href="/cart" className="text-ink/80 hover:text-forest">Cart & WhatsApp checkout</Link></li>
            <li><Link href="/account" className="text-ink/80 hover:text-forest">Your account & orders</Link></li>
            <li><Link href="/admin" className="text-ink/80 hover:text-forest">Staff administration</Link></li>
          </ul>
        </section>
      </div>
      <p className="container-page mt-10 border-t border-rose/20 pt-4 text-xs text-ink/60">
        © {new Date().getFullYear()} FLORETTTZ. Prices shown in INR. Payment is confirmed and finalized securely via WhatsApp.
      </p>
    </footer>
  );
}
