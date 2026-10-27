from decimal import Decimal

from app.database import Base, SessionLocal, engine
from app.models import Category, Product, ProductVariant


CATEGORY_NAMES = {
    "flowers": "Bouquets & Flowers",
    "gifts": "Gifts & Personalised",
    "home": "Home Decor & Lamps",
    "accessories": "Keychains & Accessories",
    "festive": "Festive Hampers & Decor",
}

PRODUCTS = [
    ("lotus-diya-holder", "Lotus Diya Holder", "149", "festive"),
    ("cake", "Cake", "599", "gifts"),
    ("flower-lamp", "Flower Lamp", "549", "home"),
    ("mirror-mirror-on-the-wall", "Mirror Mirror on the Wall", None, "home"),
    ("cactus", "Cactus", "549", "home"),
    ("spongebob-and-patricks-bouquet", "SpongeBob and Patrick's Bouquet", "499", "flowers"),
    ("spider-man-keychain", "Spider-Man Keychain", "99", "accessories"),
    ("white-lotus-lamp", "White Lotus Lamp", "349", "home"),
    ("lily-bouquet", "Lily Bouquet", "299", "flowers"),
    ("bouquet-for-lovers", "Bouquet for Lovers", "399", "flowers"),
    ("spider-man-themed-bouquet", "Spider-Man Themed Bouquet", "349", "flowers"),
    ("heart-shaped-bouquet", "Heart-Shaped Bouquet", "649", "flowers"),
    ("hot-wheels-bouquet", "Hot Wheels Bouquet", "899", "gifts"),
    ("hot-wheels-clock", "Hot Wheels Clock", "2799", "home"),
    ("customised-photo-frame", "Customised Photo Frame", "599", "gifts"),
    ("ladoo-gopal-singhasan", "Ladoo Gopal Singhasan", "249", "home"),
    ("name-customised-wall-hanging", "Name-Customised Wall Hanging", "899", "gifts"),
    ("car-decorative", "Car Decorative", "249", "home"),
    ("paper-bouquet", "Paper Bouquet", "279", "flowers"),
    ("diwali-lamp", "Diwali Lamp", "1199", "festive"),
    ("diwali-decoration", "Diwali Decoration", "249", "festive"),
    ("i-love-you-bouquet", "I Love You Bouquet", "279", "flowers"),
    ("lily", "Lily", "149", "flowers"),
    ("sunflower", "Sunflower", "149", "flowers"),
    ("diwali-mini-hamper", "Diwali Mini Hamper", "499", "festive"),
    ("diwali-gift-hamper", "Diwali Gift Hamper", "699", "festive"),
    ("bag-jeans-charms", "Bag / Jeans Charms", "199", "accessories"),
    ("spider-shaped-keychain", "Spider-Shaped Keychain", "149", "accessories"),
    ("photo-oriented-box", "Photo-Oriented Box", "1299", "gifts"),
    ("cake-themed-box", "Cake-Themed Box", "449", "gifts"),
    ("bejewelled-diet-coke-decoration", "Bejewelled Diet Coke Decoration", "249", "home"),
    ("bejazzled-lighter-customisation", "Bejazzled Lighter Customisation", "249", "gifts"),
    ("cute-customised-tee", "Cute Customised Tee", "899", "gifts"),
    ("hello-kitty-hair-brush", "Hello Kitty Hair Brush", "499", "accessories"),
]


def seed(bind_engine=None, session_maker=None) -> None:
    target_engine = bind_engine or engine
    target_session = session_maker or SessionLocal
    Base.metadata.create_all(bind=target_engine)
    with target_session() as db:
        categories: dict[str, Category] = {}
        for slug, name in CATEGORY_NAMES.items():
            category = db.query(Category).filter_by(slug=slug).one_or_none()
            if not category:
                category = Category(slug=slug, name=name)
                db.add(category)
            categories[slug] = category
        db.flush()
        for slug, name, price, category_slug in PRODUCTS:
            product = db.query(Product).filter_by(sku=f"FLR-{slug.upper()}").one_or_none()
            if not product:
                product = Product(
                    sku=f"FLR-{slug.upper()}", slug=slug, name=name,
                    price=Decimal(price) if price else None, category=categories[category_slug],
                    published=price is not None, featured=slug in {"lily-bouquet", "lotus-diya-holder", "customised-photo-frame", "diwali-gift-hamper"},
                    available_for_order=price is not None,
                )
                db.add(product)
        db.flush()
        hot_wheels = db.query(Product).filter_by(slug="hot-wheels-bouquet").one()
        if not hot_wheels.variants:
            db.add_all([
                ProductVariant(product=hot_wheels, sku="FLR-HOT-WHEELS-BOUQUET-899", name="Classic", price=Decimal("899"), available_for_order=True),
                ProductVariant(product=hot_wheels, sku="FLR-HOT-WHEELS-BOUQUET-1199", name="Premium", price=Decimal("1199"), available_for_order=True),
            ])
        db.commit()


if __name__ == "__main__":
    seed()
