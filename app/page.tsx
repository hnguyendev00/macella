"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, Globe2, Heart, Menu, Minus, Plus, Search, ShoppingBag, Sparkles, Truck, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import Image from "next/image";

type SelectedOption = { name: string; value: string };
type ProductVariant = { id: string; title: string; availableForSale: boolean; price: number; currencyCode: string; imageUrl?: string; imageAlt?: string; selectedOptions: SelectedOption[] };
type Product = { id: string; variantId: string; name: string; handle: string; category: string; price: number; currencyCode: string; imageUrl?: string; imageAlt?: string; availableForSale: boolean; color: string; accent: string; label?: string; variants: ProductVariant[] };
type CartLine = { id: string; quantity: number; variantId: string; name: string; handle: string; category: string; price: number; currencyCode: string; imageUrl?: string; imageAlt?: string; selectedOptions: SelectedOption[] };
type ShopifyCart = { id: string; checkoutUrl: string; totalQuantity: number; subtotal: number; currencyCode: string; lines: CartLine[] };
type DemoProduct = Omit<Product, "variants">;

const demoSeed: DemoProduct[] = [
  { id: "demo-1", variantId: "demo-variant-1", name: "Contour Heavyweight Tee", handle: "contour-heavyweight-tee", category: "Essentials", price: 48, currencyCode: "USD", availableForSale: true, color: "#d8d2c7", accent: "#2d2b28", label: "Bestseller" },
  { id: "demo-2", variantId: "demo-variant-2", name: "Form Relaxed Trousers", handle: "form-relaxed-trousers", category: "New season", price: 86, currencyCode: "USD", availableForSale: true, color: "#292a2c", accent: "#cbc3b5", label: "New" },
  { id: "demo-3", variantId: "demo-variant-3", name: "Studio Zip Jacket", handle: "studio-zip-jacket", category: "Outerwear", price: 118, currencyCode: "USD", availableForSale: true, color: "#a8a294", accent: "#f0ede6" },
  { id: "demo-4", variantId: "demo-variant-4", name: "Arc Everyday Hoodie", handle: "arc-everyday-hoodie", category: "Core collection", price: 78, currencyCode: "USD", availableForSale: true, color: "#e6e1d7", accent: "#767064" },
];
const demoProducts: Product[] = demoSeed.map((product) => ({ ...product, variants: [{ id: product.variantId, title: "Default", availableForSale: true, price: product.price, currencyCode: product.currencyCode, selectedOptions: [] }] }));

function formatMoney(value: number, currencyCode: string) {
  return new Intl.NumberFormat(currencyCode === "VND" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: currencyCode === "VND" ? 0 : 2,
  }).format(value);
}

function variantLabel(options: SelectedOption[], fallback = "Default") {
  const values = options.filter((option) => option.value !== "Default Title").map((option) => option.value);
  return values.length ? values.join(" · ") : fallback;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>(demoProducts);
  const [catalogSource, setCatalogSource] = useState<"loading" | "shopify" | "demo">("loading");
  const [cartOpen, setCartOpen] = useState(false);
  const [demoCart, setDemoCart] = useState<Record<string, number>>({});
  const [shopifyCart, setShopifyCart] = useState<ShopifyCart | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [pendingLine, setPendingLine] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const demoCartItems = useMemo<CartLine[]>(() => products.filter((product) => demoCart[product.id]).map((product) => {
    const variant = product.variants.find((item) => item.id === (selectedVariants[product.id] || product.variantId)) ?? product.variants[0];
    return { id: product.id, quantity: demoCart[product.id], variantId: variant.id, name: product.name, handle: product.handle, category: product.category, price: variant.price, currencyCode: variant.currencyCode, imageUrl: variant.imageUrl || product.imageUrl, imageAlt: variant.imageAlt || product.imageAlt, selectedOptions: variant.selectedOptions };
  }), [demoCart, products, selectedVariants]);
  const cartItems = catalogSource === "shopify" ? (shopifyCart?.lines ?? []) : demoCartItems;
  const cartCount = catalogSource === "shopify" ? (shopifyCart?.totalQuantity ?? 0) : Object.values(demoCart).reduce((sum, count) => sum + count, 0);
  const subtotal = catalogSource === "shopify" ? (shopifyCart?.subtotal ?? 0) : demoCartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCurrency = catalogSource === "shopify" ? (shopifyCart?.currencyCode || products[0]?.currencyCode || "USD") : (demoCartItems[0]?.currencyCode || "USD");
  const catalogCurrency = products[0]?.currencyCode || "USD";

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/shopify/products?country=US&t=${Date.now()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((payload: { source?: string; products?: Product[] }) => {
        if (payload.source === "shopify" && payload.products?.length) { setProducts(payload.products); setCatalogSource("shopify") }
        else setCatalogSource("demo");
      })
      .catch((error) => { if (error instanceof Error && error.name !== "AbortError") setCatalogSource("demo") });
    return () => controller.abort();
  }, []);

  function getSelectedVariant(product: Product) {
    return product.variants.find((variant) => variant.id === selectedVariants[product.id]) ?? product.variants.find((variant) => variant.availableForSale) ?? product.variants[0];
  }

  async function syncCart(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
    const response = await fetch("/api/shopify/cart", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = (await response.json()) as { cart?: ShopifyCart; error?: string };
    if (!response.ok || !payload.cart) throw new Error(payload.error || "Shopify cart is unavailable");
    setShopifyCart(payload.cart);
  }

  async function addToCart(product: Product) {
    const variant = getSelectedVariant(product);
    if (!variant?.availableForSale) return;
    setCartOpen(true);
    setCheckoutError("");
    if (catalogSource !== "shopify") {
      setDemoCart((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }));
      return;
    }
    setPendingLine(variant.id);
    try {
      await syncCart("POST", { cartId: shopifyCart?.id, lines: [{ merchandiseId: variant.id, quantity: 1 }], countryCode: "US" });
    } catch (error) { setCheckoutError(error instanceof Error ? error.message : "Could not add this item"); }
    finally { setPendingLine(""); }
  }

  async function updateQuantity(line: CartLine, amount: number) {
    const nextQuantity = line.quantity + amount;
    setCheckoutError("");
    if (catalogSource !== "shopify") {
      setDemoCart((current) => { const copy = { ...current }; if (nextQuantity <= 0) delete copy[line.id]; else copy[line.id] = nextQuantity; return copy; });
      return;
    }
    if (!shopifyCart) return;
    setPendingLine(line.id);
    try {
      if (nextQuantity <= 0) await syncCart("DELETE", { cartId: shopifyCart.id, lineIds: [line.id] });
      else await syncCart("PATCH", { cartId: shopifyCart.id, lines: [{ id: line.id, quantity: nextQuantity }] });
    } catch (error) { setCheckoutError(error instanceof Error ? error.message : "Could not update this item"); }
    finally { setPendingLine(""); }
  }

  async function removeLine(line: CartLine) {
    if (catalogSource !== "shopify") { setDemoCart((current) => { const copy = { ...current }; delete copy[line.id]; return copy; }); return; }
    if (!shopifyCart) return;
    setPendingLine(line.id);
    try { await syncCart("DELETE", { cartId: shopifyCart.id, lineIds: [line.id] }); }
    catch (error) { setCheckoutError(error instanceof Error ? error.message : "Could not remove this item"); }
    finally { setPendingLine(""); }
  }

  function proceedToCheckout() {
    setCheckoutError("");
    if (catalogSource !== "shopify") { setCheckout(true); return; }
    if (!shopifyCart?.checkoutUrl) { setCheckoutError("Your Shopify cart is not ready yet"); return; }
    window.location.assign(shopifyCart.checkoutUrl);
  }

  return <main className="site-shell">
    <div className="announcement"><span>Complimentary worldwide shipping over $120</span><span className="announcement-note">Easy 30-day returns</span></div>
    <header className="nav-wrap">
      <a className="wordmark" href="#top" aria-label="Macella home">MACELLA<span>®</span></a>
      <nav className={`desktop-nav ${menuOpen ? "mobile-open" : ""}`}>
        <a href="#shop" onClick={() => setMenuOpen(false)}>New in</a><a href="#shop" onClick={() => setMenuOpen(false)}>Shop</a><a href="#story" onClick={() => setMenuOpen(false)}>Our form</a><a href="#footer" onClick={() => setMenuOpen(false)}>Journal</a>
      </nav>
      <div className="nav-actions">
        <span className="currency-picker" aria-label={`Store currency ${catalogCurrency}`}><Globe2 size={15} />{catalogCurrency}<ChevronDown size={13} /></span>
        <button className="icon-button search-button" aria-label="Search"><Search size={19} /></button>
        <Sheet open={cartOpen} onOpenChange={(open) => { setCartOpen(open); if (!open) setCheckout(false) }}>
          <SheetTrigger asChild><button className="bag-button" aria-label={`Shopping bag with ${cartCount} items`}><ShoppingBag size={19} /><span>Bag</span><b>{cartCount}</b></button></SheetTrigger>
          <SheetContent className="cart-sheet">
            <SheetHeader><SheetTitle>{checkout ? "Secure checkout" : `Your bag (${cartCount})`}</SheetTitle></SheetHeader>
            {checkout ? <CheckoutPanel subtotal={formatMoney(subtotal, cartCurrency)} onBack={() => setCheckout(false)} /> : cartItems.length ? <div className="cart-content">
              <div className="cart-items">{cartItems.map((item) => <div className="cart-row" key={item.id}><ProductVisual product={item} compact /><div className="cart-copy"><strong>{item.name}</strong>{variantLabel(item.selectedOptions, "") && <span>{variantLabel(item.selectedOptions, "")}</span>}<span>{formatMoney(item.price, item.currencyCode)}</span><div className="quantity"><button onClick={() => updateQuantity(item, -1)} disabled={pendingLine === item.id} aria-label={`Decrease ${item.name} quantity`}><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(item, 1)} disabled={pendingLine === item.id} aria-label={`Increase ${item.name} quantity`}><Plus size={13} /></button></div><button className="remove-line" onClick={() => removeLine(item)} disabled={pendingLine === item.id}>Remove</button></div></div>)}</div>
              <div className="cart-summary"><div><span>Subtotal</span><strong>{formatMoney(subtotal, cartCurrency)}</strong></div><p>Taxes, duties, and shipping are calculated by Shopify at checkout.</p>{checkoutError && <p className="checkout-error">{checkoutError}</p>}<button className="checkout-button" onClick={proceedToCheckout}>Proceed to checkout <ArrowRight size={17} /></button><div className="payment-marks"><span>VISA</span><span>mastercard</span><span>PayPal</span><span>◉ Pay</span></div></div>
            </div> : <div className="empty-cart"><ShoppingBag size={38} strokeWidth={1.2} /><h3>Your bag is waiting</h3><p>Discover considered essentials designed to work across seasons.</p><button onClick={() => setCartOpen(false)}>Explore the collection</button></div>}
          </SheetContent>
        </Sheet>
        <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X /> : <Menu />}</button>
      </div>
    </header>

    <section className="hero" id="top">
      <div className="hero-copy"><p className="eyebrow">Edition 01 · Worldwide</p><h1>Made for every<br />way you move.</h1><p>Modern wardrobe foundations. Considered proportions, elevated fabrics, and a quieter approach to everyday style.</p><a className="primary-link" href="#shop">Shop the first edition <ArrowRight size={18} /></a></div>
      <div className="hero-image" role="img" aria-label="Macella fashion campaign" /><div className="hero-index">01 / 04</div>
    </section>
    <section className="promise-strip" aria-label="Store benefits"><div><Truck size={20} /><span><strong>Worldwide delivery</strong>Tracked to your door</span></div><div><Sparkles size={20} /><span><strong>Built to repeat</strong>Designed beyond one season</span></div><div><Check size={20} /><span><strong>30-day returns</strong>Simple and straightforward</span></div></section>

    <section className="collection" id="shop">
      <div className="section-heading"><div><p className="eyebrow">The first edit · {catalogSource === "shopify" ? "Live from Shopify" : catalogSource === "loading" ? "Syncing catalog" : "Demo catalog"}</p><h2>Everyday, refined.</h2></div><a href="#shop">View all pieces <ArrowRight size={16} /></a></div>
      <div className="product-grid">{products.map((product) => { const variant = getSelectedVariant(product); return <article className="product-card" key={product.id}><div className="product-image-wrap">{product.label && <span className="product-label">{product.label}</span>}<button className="heart" aria-label={`Save ${product.name}`}><Heart size={18} /></button><ProductVisual product={{ ...product, imageUrl: variant.imageUrl || product.imageUrl, imageAlt: variant.imageAlt || product.imageAlt }} /><button className="quick-add" onClick={() => addToCart(product)} disabled={!variant.availableForSale || pendingLine === variant.id}>{variant.availableForSale ? pendingLine === variant.id ? "Adding to Shopify…" : `Quick add · ${variantLabel(variant.selectedOptions)}` : "Sold out"} <Plus size={16} /></button></div><div className="product-info"><div><h3>{product.name}</h3><p>{product.category}</p></div><span>{formatMoney(variant.price, variant.currencyCode)}</span></div>{product.variants.length > 1 ? <label className="variant-picker"><span>Color / Size</span><select value={variant.id} onChange={(event) => setSelectedVariants((current) => ({ ...current, [product.id]: event.target.value }))}>{product.variants.map((item) => <option key={item.id} value={item.id} disabled={!item.availableForSale}>{variantLabel(item.selectedOptions, item.title)}{item.availableForSale ? "" : " — Sold out"}</option>)}</select></label> : variantLabel(variant.selectedOptions, "") && <p className="single-variant">{variantLabel(variant.selectedOptions, "")}</p>}</article> })}</div>
    </section>

    <section className="manifesto" id="story"><div className="manifesto-number">01—04</div><div className="manifesto-copy"><p className="eyebrow">Our form</p><h2>Fewer pieces.<br />More possibilities.</h2><p>We make adaptable clothing around real life—not a single occasion. Each silhouette is refined for movement, layering, and repeat wear.</p><a href="#footer">Read our approach <ArrowRight size={17} /></a></div><div className="quote-card"><div className="stars">★★★★★</div><blockquote>“The weight, cut, and finish feel far beyond the price. It’s the piece I reach for without thinking.”</blockquote><p>Amara K. · Verified buyer</p></div></section>
    <section className="newsletter"><p className="eyebrow">Inside MACELLA</p><h2>First access, considered updates.</h2><p>New editions, restocks, and stories—sent occasionally.</p><form onSubmit={(e) => e.preventDefault()}><input type="email" placeholder="Email address" aria-label="Email address" /><button type="submit">Join the list <ArrowRight size={17} /></button></form></section>
    <footer id="footer"><div className="footer-brand"><a className="wordmark" href="#top">MACELLA®</a><p>Modern form for everyday movement.</p></div><div className="footer-links"><div><strong>Shop</strong><a href="#shop">New in</a><a href="#shop">Essentials</a><a href="#shop">Outerwear</a></div><div><strong>Help</strong><a href="#footer">Delivery</a><a href="#footer">Returns</a><a href="#footer">Size guide</a></div><div><strong>Follow</strong><a href="#footer">Instagram</a><a href="#footer">TikTok</a><a href="#footer">Pinterest</a></div></div><div className="footer-bottom"><span>© 2026 MACELLA</span><span>Privacy · Terms · Accessibility</span><span>United States / {catalogCurrency}</span></div></footer>
  </main>
}

function ProductVisual({ product, compact = false }: { product: { name: string; handle: string; imageUrl?: string; imageAlt?: string; color?: string; accent?: string }; compact?: boolean }) {
  return <div className={`product-visual ${compact ? "compact" : ""}`} style={{ background: product.color || "#e6e1d7" }} aria-hidden="true">{product.imageUrl ? <Image src={product.imageUrl} alt={product.imageAlt || product.name} fill unoptimized sizes={compact ? "95px" : "(max-width: 560px) 50vw, 25vw"} /> : <div className="garment" style={{ color: product.accent || "#767064" }}><span className="garment-neck" /><span className="garment-body" /><span className="garment-sleeve left" /><span className="garment-sleeve right" /></div>}{!compact && <small>MACELLA / {product.handle.toUpperCase().slice(0, 10)}</small>}</div>
}

function CheckoutPanel({ subtotal, onBack }: { subtotal: string; onBack: () => void }) {
  const [complete, setComplete] = useState(false);
  if (complete) return <div className="checkout-success"><div><Check /></div><h3>Checkout preview complete</h3><p>Your Shopify store will securely process real payments here after Shopify Payments or PayPal is connected.</p><button onClick={onBack}>Return to bag</button></div>;
  return <form className="checkout-form" onSubmit={(e) => { e.preventDefault(); setComplete(true) }}><button type="button" className="back-link" onClick={onBack}>← Back to bag</button><div className="express-pay"><button type="button">◉ Pay</button><button type="button">PayPal</button></div><div className="or"><span>or pay with card</span></div><label>Email<input type="email" required placeholder="you@example.com" /></label><label>Delivery country<select required><option>United States</option><option>Canada</option><option>United Kingdom</option><option>Australia</option><option>European Union</option></select></label><label>Card details<input required inputMode="numeric" placeholder="Card number" /></label><div className="field-row"><label>Expiry<input required placeholder="MM / YY" /></label><label>Security code<input required placeholder="CVC" /></label></div><div className="checkout-total"><span>Total</span><strong>{subtotal}</strong></div><button className="checkout-button" type="submit">Preview payment <ArrowRight size={17} /></button><p className="secure-note">🔒 This is a non-transactional preview. Real payment fields will be hosted by Shopify.</p></form>
}
