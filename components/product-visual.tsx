"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";

export function getProductPlaceholder(categorySlug?: string | null): string {
  if (!categorySlug) return "/placeholders/default.svg";
  const slug = categorySlug.toLowerCase();
  if (slug.includes("flower") || slug.includes("bouquet")) return "/placeholders/flowers.svg";
  if (slug.includes("gift") || slug.includes("custom") || slug.includes("personal")) return "/placeholders/gifts.svg";
  if (slug.includes("home") || slug.includes("lamp") || slug.includes("decor")) return "/placeholders/home.svg";
  if (slug.includes("access") || slug.includes("charm") || slug.includes("keychain")) return "/placeholders/accessories.svg";
  if (slug.includes("festiv") || slug.includes("hamper") || slug.includes("diwali") || slug.includes("diya")) return "/placeholders/festive.svg";
  return "/placeholders/default.svg";
}

export function ProductVisual({ product, compact = false }: { product: Product; compact?: boolean }) {
  const placeholder = getProductPlaceholder(product.category?.slug);
  const [imgSrc, setImgSrc] = useState<string>(product.image_url || placeholder);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(product.image_url || placeholder);
    setHasError(false);
  }, [product.image_url, placeholder]);

  const isRealPhoto = Boolean(product.image_url) && !hasError && imgSrc !== placeholder;

  return (
    <div
      className={`relative flex ${
        compact ? "aspect-square" : "aspect-[5/4]"
      } items-center justify-center overflow-hidden bg-[#fff9f4] group`}
    >
      <img
        src={imgSrc}
        alt={product.name}
        onError={() => {
          if (!hasError) {
            setHasError(true);
            setImgSrc(placeholder);
          }
        }}
        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        loading="lazy"
      />
      {!isRealPhoto && (
        <span className="absolute bottom-2.5 left-2.5 rounded-full border border-forest/20 bg-white/90 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-forest shadow-sm backdrop-blur-sm">
          Handmade Sample
        </span>
      )}
    </div>
  );
}
