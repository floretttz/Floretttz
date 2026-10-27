import type { Category, Product } from "@/lib/types";

export const fallbackCategories: Category[] = [
  { id: 1, slug: "flowers", name: "Bouquets & Flowers" },
  { id: 2, slug: "gifts", name: "Gifts & Personalised" },
  { id: 3, slug: "home", name: "Home Decor & Lamps" },
  { id: 4, slug: "accessories", name: "Keychains & Accessories" },
  { id: 5, slug: "festive", name: "Festive Hampers & Decor" },
];

const source: Array<[string, string, string | null, string]> = [
  ["lotus-diya-holder", "Lotus Diya Holder", "149", "festive"], ["cake", "Cake", "599", "gifts"], ["flower-lamp", "Flower Lamp", "549", "home"], ["mirror-mirror-on-the-wall", "Mirror Mirror on the Wall", null, "home"],
  ["cactus", "Cactus", "549", "home"], ["spongebob-and-patricks-bouquet", "SpongeBob and Patrick's Bouquet", "499", "flowers"], ["spider-man-keychain", "Spider-Man Keychain", "99", "accessories"],
  ["white-lotus-lamp", "White Lotus Lamp", "349", "home"], ["lily-bouquet", "Lily Bouquet", "299", "flowers"], ["bouquet-for-lovers", "Bouquet for Lovers", "399", "flowers"],
  ["spider-man-themed-bouquet", "Spider-Man Themed Bouquet", "349", "flowers"], ["heart-shaped-bouquet", "Heart-Shaped Bouquet", "649", "flowers"], ["hot-wheels-bouquet", "Hot Wheels Bouquet", "899", "gifts"],
  ["hot-wheels-clock", "Hot Wheels Clock", "2799", "home"], ["customised-photo-frame", "Customised Photo Frame", "599", "gifts"], ["ladoo-gopal-singhasan", "Ladoo Gopal Singhasan", "249", "home"],
  ["name-customised-wall-hanging", "Name-Customised Wall Hanging", "899", "gifts"], ["car-decorative", "Car Decorative", "249", "home"], ["paper-bouquet", "Paper Bouquet", "279", "flowers"],
  ["diwali-lamp", "Diwali Lamp", "1199", "festive"], ["diwali-decoration", "Diwali Decoration", "249", "festive"], ["i-love-you-bouquet", "I Love You Bouquet", "279", "flowers"],
  ["lily", "Lily", "149", "flowers"], ["sunflower", "Sunflower", "149", "flowers"], ["diwali-mini-hamper", "Diwali Mini Hamper", "499", "festive"],
  ["diwali-gift-hamper", "Diwali Gift Hamper", "699", "festive"], ["bag-jeans-charms", "Bag / Jeans Charms", "199", "accessories"], ["spider-shaped-keychain", "Spider-Shaped Keychain", "149", "accessories"],
  ["photo-oriented-box", "Photo-Oriented Box", "1299", "gifts"], ["cake-themed-box", "Cake-Themed Box", "449", "gifts"], ["bejewelled-diet-coke-decoration", "Bejewelled Diet Coke Decoration", "249", "home"],
  ["bejazzled-lighter-customisation", "Bejazzled Lighter Customisation", "249", "gifts"], ["cute-customised-tee", "Cute Customised Tee", "899", "gifts"], ["hello-kitty-hair-brush", "Hello Kitty Hair Brush", "499", "accessories"],
];

export const fallbackProducts: Product[] = source.map(([slug, name, price, categorySlug], index) => ({
  id: index + 1, sku: `FLR-${slug.toUpperCase()}`, slug, name, price, category: fallbackCategories.find((item) => item.slug === categorySlug),
  description: "Handmade Floretttz item. Contact us on WhatsApp for details and availability.", published: price !== null,
  featured: ["lily-bouquet", "lotus-diya-holder", "customised-photo-frame", "diwali-gift-hamper"].includes(slug), available_for_order: price !== null,
  variants: slug === "hot-wheels-bouquet" ? [
    { id: 1, sku: "FLR-HOT-WHEELS-BOUQUET-899", name: "Classic", price: "899", available_for_order: true },
    { id: 2, sku: "FLR-HOT-WHEELS-BOUQUET-1199", name: "Premium", price: "1199", available_for_order: true },
  ] : [],
  created_at: "2026-10-26T00:00:00Z",
}));
