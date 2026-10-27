"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Radio, Users, X } from "lucide-react";
import { getWhatsAppChannelUrl, getWhatsAppGroupUrl } from "@/lib/api";

export function WhatsAppFloatingCommunity() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const groupUrl = getWhatsAppGroupUrl();
  const channelUrl = getWhatsAppChannelUrl();

  // Close when pressing Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="fixed bottom-5 right-5 z-40 sm:bottom-6 sm:right-6 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]"
    >
      {/* Compact Popup Menu */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="community-popup-title"
          className="absolute bottom-14 right-0 w-[290px] sm:w-[320px] rounded-2xl border border-rose/25 bg-white p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-rose/15 pb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#25D366]/20 text-[#128C7E]">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <h3 id="community-popup-title" className="text-sm font-bold text-forest">
                FLORETTTZ Community
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-ink/50 hover:bg-rose/10 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
              aria-label="Close community options"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <p className="mt-2 text-xs text-ink/70 leading-4">
            Connect with our handmade floral family for new drops, collection previews & offers:
          </p>

          {/* Distinct Actions */}
          <div className="mt-3 space-y-2">
            {/* Option 1: WhatsApp Group */}
            <a
              href={groupUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="group flex items-start gap-2.5 rounded-xl border border-rose/20 bg-[#faf6f3] p-2.5 transition hover:border-forest hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
              aria-label="Join WhatsApp Group (opens in a new tab)"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 group-hover:bg-forest group-hover:text-white transition">
                <Users className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-forest group-hover:text-rose transition">
                  Join WhatsApp Group
                </span>
                <span className="block text-[11px] text-ink/65 leading-tight">
                  Chat with members & preview upcoming pieces
                </span>
              </div>
            </a>

            {/* Option 2: WhatsApp Channel */}
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="group flex items-start gap-2.5 rounded-xl border border-rose/20 bg-[#faf6f3] p-2.5 transition hover:border-forest hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
              aria-label="Follow WhatsApp Channel (opens in a new tab)"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 group-hover:bg-forest group-hover:text-white transition">
                <Radio className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-forest group-hover:text-rose transition">
                  Follow WhatsApp Channel
                </span>
                <span className="block text-[11px] text-ink/65 leading-tight">
                  Official announcements & product release alerts
                </span>
              </div>
            </a>
          </div>

          <p className="mt-3 text-[10px] text-ink/50 text-center">
            Separate from individual order conversations
          </p>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? "Close WhatsApp community options" : "Open WhatsApp community options"}
        className="group relative flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_6px_20px_rgb(37_211_102_/_0.4)] transition hover:scale-105 hover:bg-[#20ba59] active:scale-95 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#128C7E]"
      >
        <span className="sr-only">WhatsApp Community Options</span>
        {open ? (
          <X className="h-6 w-6 transition" aria-hidden="true" />
        ) : (
          <MessageCircle className="h-6 w-6 transition" aria-hidden="true" />
        )}

        {/* Pulse indicator badge */}
        {!open && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5"
            aria-hidden="true"
          >
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose border-2 border-white"></span>
          </span>
        )}
      </button>
    </div>
  );
}
