"""Demo seed data for two branded tenants (idempotent).

Each tenant proves the multi-tenant theme pipeline: the storefront renders
entirely from these theme tokens with zero hardcoded brand colors.
"""
from datetime import datetime, timezone


def _now():
    return datetime.now(timezone.utc).isoformat()


# ---- image pool (curated luxury jewelry placeholders) --------------------
IMG = {
    "ring1": "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
    "ring2": "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=900&q=80",
    "neck1": "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=80",
    "neck2": "https://images.unsplash.com/photo-1611085583191-a3b181a88401?auto=format&fit=crop&w=900&q=80",
    "ear1": "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=80",
    "ear2": "https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=900&q=80",
    "bangle1": "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&q=80",
    "bangle2": "https://images.unsplash.com/photo-1610694955371-d4a3e0ce4b52?auto=format&fit=crop&w=900&q=80",
}

HERO_LIGHT = "https://images.pexels.com/photos/7895502/pexels-photo-7895502.jpeg?auto=compress&cs=tinysrgb&w=1200"
HERO_DARK = "https://images.pexels.com/photos/37618169/pexels-photo-37618169.jpeg?auto=compress&cs=tinysrgb&w=1200"


def _categories():
    base = [
        ("Rings", "rings"),
        ("Necklaces", "necklaces"),
        ("Earrings", "earrings"),
        ("Bangles", "bangles"),
    ]
    cats = []
    for i, (name, slug) in enumerate(base):
        cats.append(
            {
                "id": slug,
                "name": name,
                "slug": slug,
                "sort_order": i,
                "active": True,
                "image": {
                    "rings": IMG["ring1"],
                    "necklaces": IMG["neck1"],
                    "earrings": IMG["ear1"],
                    "bangles": IMG["bangle1"],
                }[slug],
            }
        )
    return cats


def _products(prefix, currency="₹"):
    defs = [
        ("Solitaire Halo Ring", "rings", IMG["ring1"], 4.2, "18K", 12500, 189000, True),
        ("Eternity Band", "rings", IMG["ring2"], 3.6, "18K", 9800, 142000, False),
        ("Riviera Diamond Necklace", "necklaces", IMG["neck1"], 18.4, "22K", 32000, 845000, True),
        ("Pearl Drop Pendant", "necklaces", IMG["neck2"], 9.1, "18K", 15400, 268000, False),
        ("Chandelier Earrings", "earrings", IMG["ear1"], 6.8, "22K", 14200, 312000, True),
        ("Stud Twin Solitaires", "earrings", IMG["ear2"], 2.9, "18K", 8600, 121000, False),
        ("Kada Filigree Bangle", "bangles", IMG["bangle1"], 24.6, "22K", 41000, 1120000, True),
        ("Slim Stack Bangle", "bangles", IMG["bangle2"], 11.2, "22K", 18900, 498000, False),
    ]
    prods = []
    for i, (name, cat, img, wt, purity, making, price, featured) in enumerate(defs):
        prods.append(
            {
                "id": f"{prefix}-{cat}-{i}",
                "sku": f"{prefix.upper()}-{1000 + i}",
                "name": name,
                "category_id": cat,
                "kind": "jewellery",
                "weight_grams": wt,
                "purity": purity,
                "making_charge": making,
                "making_charge_type": "flat",
                "price": price,
                "currency": currency,
                "images": [img],
                "description": (
                    f"A hand-finished {name.lower()} crafted in {purity} gold. "
                    "Each piece is set with ethically sourced stones and hallmarked "
                    "for guaranteed purity."
                ),
                "stock_qty": 5,
                "active": True,
                "listed_online": True,
                "featured": featured,
                "sort_order": i,
                "created_at": _now(),
            }
        )
    return prods


# ---- theme presets -------------------------------------------------------
AURELIA_THEME = {
    "preset_id": "classic-gold",
    "colors": {
        "primary": "#BFA75D",
        "onPrimary": "#FFFFFF",
        "secondary": "#8C7738",
        "accent": "#BFA75D",
        "background": "#FAFAF7",
        "surface": "#FFFFFF",
        "text": "#1A1A18",
        "muted": "#6B6B64",
        "border": "#E0DCD1",
        "headerBg": "#FAFAF7",
        "headerText": "#1A1A18",
        "footerBg": "#1A1A18",
        "footerText": "#FAFAF7",
    },
    "fonts": {"heading": "Cormorant Garamond", "body": "DM Sans"},
    "mode": "light",
}

NOIR_THEME = {
    "preset_id": "dark-royal",
    "colors": {
        "primary": "#D4AF37",
        "onPrimary": "#0D0F12",
        "secondary": "#B8912E",
        "accent": "#D4AF37",
        "background": "#0D0F12",
        "surface": "#16191F",
        "text": "#F2F0EA",
        "muted": "#9A968C",
        "border": "#2A2E36",
        "headerBg": "#0D0F12",
        "headerText": "#F2F0EA",
        "footerBg": "#000000",
        "footerText": "#D4AF37",
    },
    "fonts": {"heading": "Playfair Display", "body": "Inter"},
    "mode": "dark",
}

SECTIONS = [
    {"type": "rate_ticker"},
    {"type": "sip_cta"},
    {"type": "hero"},
    {"type": "categories"},
    {"type": "featured"},
    {"type": "about"},
]


def _tenant(code, name, subdomain, theme, hero, tagline, about, rate):
    site_theme = {"_id": "theme", **theme, "homepage_sections": SECTIONS}
    site_cms = {
        "_id": "cms",
        "hero_title": name,
        "hero_subtitle": tagline,
        "hero_image": hero,
        "about_title": "The House",
        "about_text": about,
        "rate": rate,  # stubbed static gold rate
        "banners": [],
    }
    snapshot = {
        "tenant_id": code,
        "payload": {
            "logo_url": None,  # missing logo -> wordmark
            "tagline": tagline,
            "theme": theme,
            "homepage_sections": SECTIONS,
        },
        "updated_at": _now(),
    }
    return site_theme, site_cms, snapshot


def _sip_plans():
    return [
        {
            "id": "gold-11-1",
            "name": "11+1 Gold Advantage",
            "tagline": "Pay 11 months, we gift the 12th",
            "monthly_amount": 5000,
            "tenure_months": 11,
            "bonus_months": 1,
            "metal": "gold",
            "benefit_text": "Save a fixed amount monthly and redeem for gold jewellery at maturity. We add one bonus installment.",
            "min_amount": 2000,
        },
        {
            "id": "gold-flex",
            "name": "Flexi Gold Saver",
            "tagline": "Save at your own pace",
            "monthly_amount": 3000,
            "tenure_months": 12,
            "bonus_months": 0,
            "metal": "gold",
            "benefit_text": "Accumulate gold grams every month at the live rate. Redeem anytime after 6 installments.",
            "min_amount": 1000,
        },
        {
            "id": "silver-12",
            "name": "Silver Circle",
            "tagline": "A year of silver savings",
            "monthly_amount": 2000,
            "tenure_months": 12,
            "bonus_months": 0,
            "metal": "silver",
            "benefit_text": "Build a silver corpus over 12 months and convert to coins, utensils or jewellery.",
            "min_amount": 1000,
        },
    ]


def build_seed():
    tenants = [
        {
            "_id": "AURELIA",
            "tenant_code": "AURELIA",
            "business_name": "Aurelia Fine Jewels",
            "mongo_db_name": "tenant_aurelia",
            "subdomain": "aurelia",
            "status": "active",
            "rate_margins": {
                "gold_pct": 6,
                "silver_pct": 9,
                "gold_inr_per_g": 100,
                "silver_inr_per_g": 33.5,
            },
            "rate_city": "Hyderabad",
            "rate_state": "Telangana",
            "created_at": _now(),
        },
        {
            "_id": "NOIR",
            "tenant_code": "NOIR",
            "business_name": "Noir Diamonds",
            "mongo_db_name": "tenant_noir",
            "subdomain": "noir",
            "status": "active",
            "rate_margins": {
                "gold_pct": 7,
                "silver_pct": 10,
                "gold_inr_per_g": 50,
                "silver_inr_per_g": 45,
            },
            "rate_city": "Mumbai",
            "rate_state": "Maharashtra",
            "created_at": _now(),
        },
    ]

    sites = [
        {"hostname": "aurelia.luxejewel.app", "tenant_id": "AURELIA", "is_primary": True, "status": "active"},
        {"hostname": "noir.luxejewel.app", "tenant_id": "NOIR", "is_primary": True, "status": "active"},
    ]

    admins = [
        {"tenant_code": "AURELIA", "username": "owner", "role": "owner"},
        {"tenant_code": "NOIR", "username": "owner", "role": "owner"},
    ]

    a_theme, a_cms, a_snap = _tenant(
        "AURELIA",
        "Aurelia Fine Jewels",
        "aurelia",
        AURELIA_THEME,
        HERO_LIGHT,
        "Timeless gold, crafted for a lifetime",
        "Since 1974, Aurelia has handcrafted heirloom gold jewellery in the heart "
        "of Hyderabad. Every piece is hallmarked, ethically sourced, and made to be "
        "passed down through generations.",
        {"metal": "Gold 22K", "value": "₹ 7,180 / g", "note": "Indicative rate"},
    )
    n_theme, n_cms, n_snap = _tenant(
        "NOIR",
        "Noir Diamonds",
        "noir",
        NOIR_THEME,
        HERO_DARK,
        "Rare diamonds. Quiet luxury.",
        "Noir Diamonds curates a private collection of investment-grade diamonds "
        "and contemporary settings for the modern connoisseur. Discreet, "
        "certified, and utterly singular.",
        {"metal": "Gold 22K", "value": "₹ 7,205 / g", "note": "Indicative rate"},
    )

    snapshots = [a_snap, n_snap]

    tenant_data = {
        "AURELIA": {
            "site_theme": a_theme,
            "site_cms": a_cms,
            "categories": _categories(),
            "products": _products("aur"),
            "sip_plans": _sip_plans(),
        },
        "NOIR": {
            "site_theme": n_theme,
            "site_cms": n_cms,
            "categories": _categories(),
            "products": _products("noi"),
            "sip_plans": _sip_plans(),
        },
    }

    # admins seeded for the deferred admin phase (no login UI this pass)
    for a in admins:
        a["created_at"] = _now()

    return tenants, sites, snapshots, tenant_data
