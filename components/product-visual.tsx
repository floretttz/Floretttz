import { Sparkles } from "lucide-react";
import type { Product } from "@/lib/types";

const tones = ["bg-[#f7dde3]", "bg-[#e5eddf]", "bg-[#f5e9d6]", "bg-[#eee0d9]", "bg-[#e5e7d7]"];
export function ProductVisual({ product, compact = false }: { product: Product; compact?: boolean }) {
  if (product.image_url) {
    return (
      <div className={`relative flex ${compact ? "aspect-square" : "aspect-[5/4]"} items-center justify-center overflow-hidden bg-[#fff9f4]`}>
        <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
      </div>
    );
  }
  const tone = tones[product.id % tones.length];
  return <div className={`${tone} relative flex ${compact ? "aspect-square" : "aspect-[5/4]"} items-center justify-center overflow-hidden`}>
    <div className="absolute inset-3 rounded-[40%_60%_45%_55%] border border-white/55" /><div className="absolute inset-x-8 bottom-0 h-1/2 rounded-t-full border-x border-t border-rose/20 bg-white/15" />
    <div className="relative grid h-16 w-16 place-items-center rounded-full border border-white/70 bg-ivory/80 text-center shadow-sm"><Sparkles className="h-5 w-5 text-rose" /><span className="sr-only">No product photo has been added yet for {product.name}</span></div>
    <span className="absolute bottom-3 left-3 rounded-full bg-white/80 px-2.5 py-1 text-[.66rem] font-bold uppercase tracking-[.12em] text-forest">Photo pending</span>
  </div>;
}
