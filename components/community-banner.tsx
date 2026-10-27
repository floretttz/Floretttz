"use client";

import { MessageCircle, Radio, Users } from "lucide-react";
import { getWhatsAppChannelUrl, getWhatsAppGroupUrl } from "@/lib/api";

export function CommunityBanner() {
  const groupUrl = getWhatsAppGroupUrl();
  const channelUrl = getWhatsAppChannelUrl();

  return (
    <aside
      aria-label="Floretttz WhatsApp Community"
      className="border-b border-rose/25 bg-[#223d32] text-white px-2 sm:px-3 py-1.5 text-xs font-medium"
    >
      <div className="container-page flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1.5 text-blush/90 text-[11px] sm:text-xs shrink-0">
          <MessageCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Join our handmade community on WhatsApp:</span>
          <span className="sm:hidden font-semibold">Community:</span>
        </div>

        <nav aria-label="WhatsApp Community Links" className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs shrink-0">
          <a
            href={groupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 font-semibold text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
            aria-label="Join WhatsApp Group (opens in a new tab)"
          >
            <Users className="h-3 w-3 text-emerald-300" aria-hidden="true" />
            <span className="hidden sm:inline">Join WhatsApp Group</span>
            <span className="sm:hidden">Group</span>
          </a>

          <span className="text-white/40" aria-hidden="true">
            ·
          </span>

          <a
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 font-semibold text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
            aria-label="Follow WhatsApp Channel (opens in a new tab)"
          >
            <Radio className="h-3 w-3 text-emerald-300" aria-hidden="true" />
            <span className="hidden sm:inline">Follow WhatsApp Channel</span>
            <span className="sm:hidden">Channel</span>
          </a>
        </nav>
      </div>
    </aside>
  );
}
