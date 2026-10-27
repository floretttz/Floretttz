import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MessageCircle } from "lucide-react";
import { getProduct, getProducts, formatINR, getWhatsAppUrl } from "@/lib/api";
import { ProductGrid } from "@/components/product-grid";
import { ProductVisual } from "@/components/product-visual";
import { ProductPurchase } from "@/components/product-purchase";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const product = await getProduct((await params).slug); return { title: product?.name ?? "Product not found" }; }

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getProduct((await params).slug); if (!product) notFound();
  const related = (await getProducts({ category: product.category?.slug, pageSize: 4 })).items.filter((item) => item.id !== product.id).slice(0, 4);
  const price = product.variants.length ? product.variants[0]?.price : product.price;
  return <div className="container-page py-6 sm:py-10"><nav className="flex flex-wrap items-center gap-1 text-sm text-ink/65" aria-label="Breadcrumb"><Link href="/">Home</Link><ChevronRight className="h-3.5 w-3.5" /><Link href="/shop">Shop</Link>{product.category && <><ChevronRight className="h-3.5 w-3.5" /><Link href={`/shop?category=${product.category.slug}`}>{product.category.name}</Link></>}<ChevronRight className="h-3.5 w-3.5" /><span className="truncate text-ink">{product.name}</span></nav>
    <div className="mt-6 grid gap-7 md:grid-cols-[1.05fr_.95fr] md:gap-10"><div className="overflow-hidden rounded-2xl border border-rose/25 bg-white"><ProductVisual product={product} /></div><section><p className="eyebrow">{product.category?.name ?? "Floretttz"}</p><h1 className="display mt-2 text-4xl leading-none text-forest sm:text-5xl">{product.name}</h1><p className="mt-5 text-2xl font-bold text-ink">{formatINR(price)}</p>{product.variants.length > 1 && <p className="mt-1 text-sm text-ink/60">Price varies by selected option.</p>}<div className="mt-6 border-y border-rose/25 py-5"><h2 className="font-semibold text-forest">About this piece</h2><p className="mt-2 leading-7 text-ink/75">{product.description}</p><p className="mt-3 text-sm text-ink/60">Product photo is pending. Please ask before ordering for current visuals and availability.</p></div><ProductPurchase product={product} /><a href={getWhatsAppUrl(`Hello Floretttz! I have a question about ${product.name}.`)} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-forest underline underline-offset-4"><MessageCircle className="h-4 w-4" />Ask a question on WhatsApp</a></section></div>
    {related.length > 0 && <section className="mt-14"><p className="eyebrow">Keep browsing</p><h2 className="display mt-1 text-3xl text-forest">You may also like</h2><div className="mt-6"><ProductGrid products={related} /></div></section>}
  </div>;
}
