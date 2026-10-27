import Link from "next/link";
import { ArrowLeft, MessageCircle, ShoppingBag } from "lucide-react";
import { getWhatsAppUrl } from "@/lib/api";

export default function NotFound() {
  return (
    <div className="container-page py-12 sm:py-20 text-center">
      <div className="mx-auto max-w-lg rounded-2xl border border-rose/30 bg-white p-6 sm:p-10 shadow-sm">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blush/35 font-display text-2xl text-rose">
          ✦
        </span>
        <p className="eyebrow mt-4">Page Not Found</p>
        <h1 className="display mt-1 text-3xl sm:text-4xl text-forest">This little bloom isn’t here</h1>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          The page or product piece you are looking for may be unpublished, moved, or currently being handcrafted in the workshop.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/shop" className="button-primary text-sm min-h-[44px]">
            <ShoppingBag className="h-4 w-4" /> Browse the catalogue
          </Link>
          <Link href="/" className="button-secondary text-sm min-h-[44px]">
            <ArrowLeft className="h-4 w-4" /> Return to store
          </Link>
        </div>

        <div className="mt-8 border-t border-rose/15 pt-5">
          <p className="text-xs text-ink/60">Looking for a specific custom piece?</p>
          <a
            href={getWhatsAppUrl("Hello Floretttz! I am looking for a piece on your website.")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-forest underline underline-offset-4 hover:text-rose"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Ask directly on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
