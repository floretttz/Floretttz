import Link from "next/link";
import { ArrowRight, MessageCircle, Radio, Sparkles, Users } from "lucide-react";
import { getCategories, getProducts, getWhatsAppChannelUrl, getWhatsAppGroupUrl, getWhatsAppUrl } from "@/lib/api";
import { ProductGrid } from "@/components/product-grid";

const categoryCopy: Record<string, string> = {
  flowers: "Pipe-cleaner blooms, bouquets, and moments made to keep.",
  gifts: "Personal touches for birthdays, friendships, and more.",
  home: "Warm handmade accents for everyday corners.",
  accessories: "Small charms and playful pieces to carry along.",
  festive: "Seasonal hampers and decor for joyful gatherings.",
};

export default async function HomePage() {
  const [categories, catalogue] = await Promise.all([getCategories(), getProducts({ pageSize: 8 })]);
  const featured = catalogue.items.filter((item) => item.featured);
  const groupUrl = getWhatsAppGroupUrl();
  const channelUrl = getWhatsAppChannelUrl();

  return (
    <>
      <section className="border-b border-rose/20 bg-[#fff1ee]">
        <div className="container-page grid items-center gap-7 py-10 sm:py-14 md:grid-cols-[1.15fr_.85fr] md:py-16">
          <div>
            <p className="eyebrow">Handmade gifts, blooms & more</p>
            <h1 className="display mt-3 max-w-2xl text-4xl leading-[.95] text-forest sm:text-5xl lg:text-6xl">
              Thoughtful things, made a little more personal.
            </h1>
            <p className="mt-5 max-w-xl text-[.98rem] leading-7 text-ink/75">
              Browse handmade floral keepsakes, decorative pieces, gift hampers, and customisable finds from Floretttz.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/shop" className="button-primary">
                Browse the collection <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/shop?category=flowers" className="button-secondary">
                Explore bouquets
              </Link>
            </div>

            {/* Clearly visible WhatsApp community actions near the top */}
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-2.5 rounded-xl border border-rose/30 bg-white/90 p-3 shadow-sm backdrop-blur-sm max-w-full">
              <span className="flex items-center gap-1.5 text-xs font-bold text-forest uppercase tracking-wider shrink-0">
                <MessageCircle className="h-4 w-4 text-[#25D366]" aria-hidden="true" />
                Community:
              </span>
              <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center gap-2 w-full sm:w-auto">
                <a
                  href={groupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-forest px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1d382e]"
                  aria-label="Join WhatsApp Group (opens in a new tab)"
                >
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  Join WhatsApp Group
                </a>
                <a
                  href={channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-forest bg-white px-3 py-1.5 text-xs font-bold text-forest transition hover:bg-sage/15"
                  aria-label="Follow WhatsApp Channel (opens in a new tab)"
                >
                  <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                  Follow WhatsApp Channel
                </a>
              </div>
            </div>
          </div>
          <div className="relative mx-auto flex w-full max-w-[300px] justify-center md:max-w-[360px]">
            <div className="absolute inset-8 rounded-[45%] bg-blush/45" />
            <img
              src="/brand/floretttz-handmade-floral-badge.png"
              alt="Floretttz handmade floral badge"
              className="relative aspect-square w-full rounded-full object-cover shadow-[0_12px_32px_rgb(48_42_44_/_0.15)]"
            />
          </div>
        </div>
      </section>

      <section className="container-page py-11 sm:py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Start with a feeling</p>
            <h2 className="display mt-1 text-3xl text-forest sm:text-4xl">Shop by category</h2>
          </div>
          <Link href="/shop" className="hidden text-sm font-bold text-forest underline underline-offset-4 sm:block">
            See all products
          </Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((category) => (
            <Link
              href={`/shop?category=${category.slug}`}
              key={category.slug}
              className="group rounded-xl border border-rose/25 bg-white p-4 hover:border-sage hover:bg-[#fffdf9]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sage/20 text-forest">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="mt-5 font-display text-xl text-ink group-hover:text-rose">{category.name}</h3>
              <p className="mt-1.5 text-sm leading-5 text-ink/65">{categoryCopy[category.slug] ?? "Handmade Floretttz collection."}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[.1em] text-forest">
                Discover <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-rose/20 bg-white py-11 sm:py-14">
        <div className="container-page">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">A considered selection</p>
              <h2 className="display mt-1 text-3xl text-forest sm:text-4xl">Featured pieces</h2>
            </div>
            <Link href="/shop" className="text-sm font-bold text-forest underline underline-offset-4">
              Shop all
            </Link>
          </div>
          <div className="mt-6">
            <ProductGrid products={featured.length ? featured : catalogue.items.slice(0, 4)} />
          </div>
        </div>
      </section>

      {/* Dedicated WhatsApp Community Section */}
      <section className="container-page py-12 sm:py-16">
        <div className="rounded-2xl border border-rose/25 bg-gradient-to-br from-[#fff7f2] to-[#f6ede4] p-7 sm:p-10">
          <div className="max-w-2xl">
            <p className="eyebrow">Stay in the loop</p>
            <h2 className="display mt-2 text-3xl text-forest sm:text-4xl">Join the Floretttz Community</h2>
            <p className="mt-3 text-sm leading-6 text-ink/75 sm:text-base">
              Get first access to limited-edition handcrafted drops, seasonal gift hampers, behind-the-scenes previews, and member-only custom slots directly on WhatsApp.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col justify-between rounded-xl border border-rose/20 bg-white/90 p-5 shadow-sm">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest text-white">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-xl text-forest">WhatsApp Community Group</h3>
                <p className="mt-2 text-sm leading-6 text-ink/70">
                  Connect with fellow gift enthusiasts, see live customisation discussions, and share inspiration.
                </p>
              </div>
              <a
                href={groupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button-primary mt-5 justify-center"
                aria-label="Join Our WhatsApp Group (opens in new tab)"
              >
                <Users className="h-4 w-4" />
                Join Our WhatsApp Group
              </a>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-rose/20 bg-white/90 p-5 shadow-sm">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose text-white">
                  <Radio className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-xl text-forest">Official WhatsApp Channel</h3>
                <p className="mt-2 text-sm leading-6 text-ink/70">
                  Receive low-noise broadcasts for catalog updates, festive preorder dates, and dispatch announcements.
                </p>
              </div>
              <a
                href={channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button-secondary mt-5 justify-center"
                aria-label="Follow Our WhatsApp Channel (opens in new tab)"
              >
                <Radio className="h-4 w-4" />
                Follow Our WhatsApp Channel
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page pb-12 sm:pb-16">
        <div className="grid overflow-hidden rounded-2xl border border-rose/25 bg-[#f4eee4] md:grid-cols-[1.25fr_.75fr]">
          <div className="p-6 sm:p-9">
            <p className="eyebrow">Need a hand choosing?</p>
            <h2 className="display mt-2 max-w-xl text-3xl text-forest sm:text-4xl">Tell us the occasion. We’ll help you find a thoughtful fit.</h2>
            <p className="mt-4 max-w-xl leading-7 text-ink/75">For custom work, availability, and delivery questions, start with WhatsApp. An enquiry is not an order confirmation.</p>
            <a
              href={getWhatsAppUrl("Hello Floretttz! I would like to enquire about your handmade gifts and floral pieces.")}
              className="button-primary mt-6 inline-flex items-center gap-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4" />
              Ask on WhatsApp
            </a>
          </div>
          <div className="hidden bg-sage/30 p-8 md:flex md:items-end">
            <p className="font-display text-3xl leading-none text-forest/75">
              Made with care.<br />Given with heart.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
