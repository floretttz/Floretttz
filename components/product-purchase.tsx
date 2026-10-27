"use client";

import { useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import type { Product, Variant } from "@/lib/types";

export function ProductPurchase({ product }: { product: Product }) {
  const [variant, setVariant] = useState<Variant | undefined>(product.variants[0]); const [quantity, setQuantity] = useState(1); const [personalisation, setPersonalisation] = useState(""); const [added, setAdded] = useState(false); const { add } = useCart();
  const customisable = /custom|name|photo|tee|wall hanging/i.test(product.name);
  const activePrice = variant?.price ?? product.price;
  const canOrder = product.available_for_order && (product.variants.length === 0 || variant?.available_for_order);
  function addToCart() { if (!canOrder) return; for (let i = 0; i < quantity; i += 1) add(product, variant, personalisation.trim() || undefined); setAdded(true); window.setTimeout(() => setAdded(false), 2200); }
  return <div className="mt-6 space-y-5"><div><p className="text-sm font-bold text-forest">{canOrder ? "Availability will be confirmed on WhatsApp" : "Not available to order online"}</p><p className="mt-1 text-sm leading-6 text-ink/65">Final availability and customisation details are confirmed directly with Floretttz.</p></div>
    {product.variants.length > 0 && <fieldset><legend className="text-sm font-bold text-ink">Choose an option</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{product.variants.map((option) => <label key={option.id} className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${variant?.id === option.id ? "border-forest bg-sage/10" : "border-rose/35 bg-white"}`}><span className="font-semibold">{option.name}</span><span className="text-sm">₹{Number(option.price).toLocaleString("en-IN")}</span><input type="radio" className="sr-only" checked={variant?.id === option.id} onChange={() => setVariant(option)} /></label>)}</div></fieldset>}
    {customisable && <div><label className="text-sm font-bold" htmlFor="personalisation">Personalisation note <span className="font-normal text-ink/60">(optional)</span></label><textarea id="personalisation" value={personalisation} onChange={(event) => setPersonalisation(event.target.value)} maxLength={280} rows={3} className="field mt-2 resize-y" placeholder="Example: Name, preferred colour, occasion..." /><p className="mt-1 text-xs text-ink/60">Your note is included in the cart for the WhatsApp conversation.</p></div>}
    <div className="flex items-center gap-3"><div className="flex h-11 items-center rounded-lg border border-rose/40 bg-white"><button type="button" onClick={() => setQuantity((amount) => Math.max(1, amount - 1))} className="grid h-full w-10 place-items-center text-forest" aria-label="Reduce quantity"><Minus className="h-4 w-4" /></button><span aria-live="polite" className="grid w-8 place-items-center font-bold">{quantity}</span><button type="button" onClick={() => setQuantity((amount) => Math.min(20, amount + 1))} className="grid h-full w-10 place-items-center text-forest" aria-label="Increase quantity"><Plus className="h-4 w-4" /></button></div><button type="button" disabled={!canOrder} onClick={addToCart} className="button-primary flex-1 disabled:cursor-not-allowed disabled:opacity-45">{added ? <><Check className="h-4 w-4" />Added to cart</> : <><ShoppingBag className="h-4 w-4" />Add to cart{activePrice ? ` · ₹${Number(activePrice).toLocaleString("en-IN")}` : ""}</>}</button></div>
  </div>;
}
