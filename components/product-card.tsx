import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatINR } from "@/lib/api";
import type { Product } from "@/lib/types";
import { ProductVisual } from "@/components/product-visual";

export function ProductCard({ product }: { product: Product }) {
  const price = product.variants.length ? product.variants[0]?.price : product.price;
  return <article className="group overflow-hidden rounded-[.9rem] border border-rose/20 bg-white shadow-[0_3px_12px_rgb(48_42_44_/_0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgb(48_42_44_/_0.08)]">
    <Link href={`/products/${product.slug}`} className="block"><ProductVisual product={product} /></Link>
    <div className="p-3.5 sm:p-4"><p className="truncate text-[.67rem] font-bold uppercase tracking-[.12em] text-forest">{product.category?.name ?? "Floretttz"}</p><h3 className="mt-1 min-h-11 font-display text-lg leading-5 text-ink"><Link href={`/products/${product.slug}`} className="hover:text-rose">{product.name}</Link></h3>
      <div className="mt-3 flex items-end justify-between gap-2"><div><p className="text-base font-bold text-ink">{formatINR(price)}</p>{product.variants.length > 1 && <p className="mt-0.5 text-xs text-ink/60">Two options available</p>}</div><Link href={`/products/${product.slug}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-forest text-forest hover:bg-forest hover:text-white" aria-label={`View ${product.name}`}><ArrowUpRight className="h-4 w-4" /></Link></div>
    </div>
  </article>;
}
