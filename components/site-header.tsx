"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Menu, MessageCircle, Radio, Search, ShoppingBag, UserRound, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart-provider";
import { getWhatsAppChannelUrl, getWhatsAppGroupUrl } from "@/lib/api";

const navigation = [
  ["Shop all", "/shop"],
  ["Flowers", "/shop?category=flowers"],
  ["Gifts", "/shop?category=gifts"],
  ["Festive", "/shop?category=festive"],
] as const;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [term, setTerm] = useState("");
  const router = useRouter();
  const { count, ready } = useCart();

  const groupUrl = getWhatsAppGroupUrl();
  const channelUrl = getWhatsAppChannelUrl();

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = term.trim();
    router.push(query ? `/shop?q=${encodeURIComponent(query)}` : "/shop");
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-rose/20 bg-ivory/95 backdrop-blur-md">
      <div className="container-page flex h-16 sm:h-[72px] items-center justify-between gap-1 sm:gap-3">
        {/* Brand Logo & Wordmark */}
        <Link href="/" className="group flex shrink-0 items-center gap-1.5 sm:gap-2.5 min-w-0" aria-label="Floretttz home">
          <span className="h-8 w-8 sm:h-10 sm:w-10 overflow-hidden rounded-full border border-rose/45 bg-white shadow-xs shrink-0">
            <img
              src="/brand/floretttz-handmade-floral-badge.png"
              alt=""
              className="h-full w-full scale-[1.75] object-cover object-[50%_45%]"
            />
          </span>
          <span className="font-display text-lg sm:text-2xl tracking-[-.06em] text-ink truncate">FLORETTTZ</span>
        </Link>

        {/* Primary Desktop Navigation */}
        <nav className="hidden items-center gap-5 md:flex" aria-label="Primary navigation">
          {navigation.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-semibold text-ink transition hover:text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest rounded-sm"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop Search Bar (zero overlap) */}
        <form
          onSubmit={search}
          className="ml-auto hidden min-w-[200px] max-w-[340px] flex-1 lg:flex items-center"
          role="search"
        >
          <label className="sr-only" htmlFor="header-search">
            Search products
          </label>
          <div className="relative w-full min-w-0">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-forest"
            />
            <input
              id="header-search"
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              className="field field-search pl-11 w-full text-sm pr-3"
              placeholder="Search bouquets, gifts..."
            />
          </div>
        </form>

        {/* Header Actions (Account, Cart, Mobile Toggle) */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <Link
            href="/account"
            className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-lg text-forest transition hover:bg-sage/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
            aria-label="Your customer account"
          >
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </Link>

          <Link
            href="/cart"
            className="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-lg text-forest transition hover:bg-sage/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
            aria-label={`Shopping cart with ${ready ? count : 0} items`}
          >
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            {ready && count > 0 && (
              <span className="absolute right-0.5 top-0.5 sm:right-1 sm:top-1 grid h-4.5 min-w-4.5 sm:h-5 sm:min-w-5 place-items-center rounded-full bg-rose px-1 text-[.6rem] sm:text-[.65rem] font-bold text-white shadow-xs">
                {count}
              </span>
            )}
          </Link>

          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-lg text-forest transition hover:bg-sage/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest md:hidden"
          >
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
            {menuOpen ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <Menu className="h-5 w-5 sm:h-6 sm:w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {menuOpen && (
        <div
          id="mobile-navigation"
          className="border-t border-rose/20 bg-ivory px-4 py-4 md:hidden animate-in fade-in slide-in-from-top-1 duration-150 shadow-lg"
        >
          {/* Mobile Search Form (Non-overlapping) */}
          <form onSubmit={search} className="mb-4 flex items-center gap-2" role="search">
            <label className="sr-only" htmlFor="mobile-search">
              Search products
            </label>
            <div className="relative flex-1 min-w-0">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-forest"
              />
              <input
                id="mobile-search"
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                className="field field-search pl-11 w-full text-sm"
                placeholder="Search bouquets, gifts, decor..."
              />
            </div>
            <button type="submit" className="button-primary shrink-0 min-h-[44px] px-3.5 text-xs font-bold">
              Search
            </button>
          </form>

          {/* Links */}
          <nav className="grid gap-1 border-b border-rose/15 pb-3" aria-label="Mobile navigation links">
            {navigation.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 font-semibold text-ink transition hover:bg-sage/15"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Mobile Community Links */}
          <div className="mt-3 pt-1 space-y-2">
            <p className="px-3 text-xs font-bold uppercase tracking-wider text-forest/70">WhatsApp Community</p>
            <a
              href={groupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-forest transition hover:bg-sage/15"
            >
              <Users className="h-4 w-4 text-[#25D366]" />
              <span>Join WhatsApp Group</span>
            </a>
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-forest transition hover:bg-sage/15"
            >
              <Radio className="h-4 w-4 text-[#25D366]" />
              <span>Follow WhatsApp Channel</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
