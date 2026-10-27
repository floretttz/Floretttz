import type { Metadata } from "next";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { getCategories, getProducts } from "@/lib/api";
import { ProductGrid } from "@/components/product-grid";

export const metadata: Metadata = {
  title: "Shop Catalogue | FLORETTTZ",
  description: "Browse handmade floral bouquets, gift hampers, pipe cleaner blooms, and personal keepsakes.",
};

type SearchParams = Promise<{ q?: string; category?: string; sort?: string; page?: string }>;

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const [categories, results] = await Promise.all([
    getCategories(),
    getProducts({ q: params.q, category: params.category, sort: params.sort, page, pageSize: 12 }),
  ]);

  const queryFor = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const all = { q: params.q, category: params.category, sort: params.sort, ...overrides };
    Object.entries(all).forEach(([key, value]) => {
      if (value) next.set(key, value);
    });
    return `/shop?${next.toString()}`;
  };

  return (
    <div className="container-page py-6 sm:py-10">
      <p className="eyebrow">Handmade Catalogue</p>
      <h1 className="display mt-1 text-3xl sm:text-4xl lg:text-5xl text-forest">Find something lovely</h1>
      <p className="mt-2.5 max-w-2xl text-sm sm:text-base leading-6 text-ink/75">
        Prices are shown in INR. Product photography and live availability are confirmed directly with Floretttz via WhatsApp.
      </p>

      {/* Responsive Search and Filter Bar: Zero overlap on mobile, tablet & desktop */}
      <form
        method="GET"
        action="/shop"
        className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 rounded-xl border border-rose/25 bg-white p-3 sm:p-4 shadow-sm"
        role="search"
      >
        <div className="relative flex-1 min-w-0">
          <label htmlFor="shop-search" className="sr-only">
            Search the catalogue
          </label>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-forest"
            aria-hidden="true"
          />
          <input
            id="shop-search"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            className="field field-search pl-11 w-full"
            placeholder="Search flowers, gifts, hampers, decor..."
          />
        </div>

        <input type="hidden" name="category" value={params.category ?? ""} />

        <div className="flex flex-col min-[360px]:flex-row items-stretch min-[360px]:items-center gap-2 w-full sm:w-auto shrink-0">
          <select
            aria-label="Sort products"
            name="sort"
            defaultValue={params.sort ?? "newest"}
            className="field text-sm w-full sm:w-auto min-w-0 sm:min-w-[140px]"
          >
            <option value="newest">Newest added</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>

          <button
            type="submit"
            className="button-primary justify-center shrink-0 min-h-[44px] px-4 text-sm inline-flex items-center gap-1.5 w-full min-[360px]:w-auto"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span>Apply</span>
          </button>
        </div>
      </form>

      {/* Category Pills with horizontal scroll support */}
      <nav aria-label="Product categories" className="mt-5 flex snap-x gap-2 overflow-x-auto pb-2 scrollbar-none">
        <Link
          href={queryFor({ category: undefined, page: undefined })}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition ${
            !params.category
              ? "border-forest bg-forest text-white"
              : "border-rose/40 bg-white text-forest hover:bg-sage/15"
          }`}
        >
          All
        </Link>
        {categories.map((category) => (
          <Link
            href={queryFor({ category: category.slug, page: undefined })}
            key={category.slug}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition ${
              params.category === category.slug
                ? "border-forest bg-forest text-white"
                : "border-rose/40 bg-white text-forest hover:bg-sage/15"
            }`}
          >
            {category.name}
          </Link>
        ))}
      </nav>

      {/* Results Header */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-b border-rose/15 pb-3">
        <p className="text-xs sm:text-sm font-medium text-ink/70">
          Showing <span className="font-bold text-forest">{results.total}</span> {results.total === 1 ? "piece" : "pieces"}
          {params.q ? ` matching “${params.q}”` : ""}
        </p>
        {(params.category || params.q) && (
          <Link
            href="/shop"
            className="text-xs sm:text-sm font-bold text-forest underline underline-offset-4 hover:text-rose"
          >
            Clear all filters
          </Link>
        )}
      </div>

      {/* Product Grid or Empty State */}
      <div className="mt-6">
        {results.items.length ? (
          <ProductGrid products={results.items} />
        ) : (
          <div className="rounded-2xl border border-dashed border-rose/50 bg-white p-8 sm:p-12 text-center shadow-sm">
            <h2 className="font-display text-2xl sm:text-3xl text-forest">No matching pieces found</h2>
            <p className="mt-2 text-sm text-ink/70 max-w-md mx-auto">
              We couldn&apos;t find any items matching your search. Try different keywords or browse all pieces.
            </p>
            <Link href="/shop" className="button-secondary mt-5">
              View full collection
            </Link>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {results.total > results.page_size && (
        <nav aria-label="Catalogue pagination" className="mt-10 flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link href={queryFor({ page: String(page - 1) })} className="button-secondary text-xs sm:text-sm min-h-[40px]">
              Previous
            </Link>
          ) : (
            <span className="button-secondary text-xs sm:text-sm min-h-[40px] opacity-40 cursor-not-allowed">
              Previous
            </span>
          )}

          <span className="text-xs sm:text-sm font-semibold text-ink/75 px-2">
            Page {page} of {Math.ceil(results.total / results.page_size)}
          </span>

          {page * results.page_size < results.total ? (
            <Link href={queryFor({ page: String(page + 1) })} className="button-secondary text-xs sm:text-sm min-h-[40px]">
              Next
            </Link>
          ) : (
            <span className="button-secondary text-xs sm:text-sm min-h-[40px] opacity-40 cursor-not-allowed">
              Next
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
