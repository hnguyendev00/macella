# Macella Storefront

Headless Shopify storefront for **Macella**, intended for `macella.com`.

## Architecture

- React 19 + Next-compatible App Router via Vinext
- Shopify Storefront GraphQL API `2026-07`
- Server-only Storefront token
- Shopify catalog hydration with a local demo fallback
- Local cart UI; Shopify Cart is created at checkout
- Redirect to Shopify-hosted checkout for payments, tax and shipping
- Cloudflare Worker-compatible deployment

```text
Browser
  ├── GET /api/shopify/products ──> Storefront API products
  └── POST /api/shopify/cart ─────> cartCreate ──> Shopify checkoutUrl
```

## Local setup

Requirements: Node.js 22.13+.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Set:

```dotenv
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_PRIVATE_TOKEN=your_private_storefront_token
```

Do not expose the private token through a `NEXT_PUBLIC_*` variable.

## Shopify setup

1. Create the Shopify store.
2. Install Shopify's **Headless** sales channel.
3. Create a storefront and obtain a private Storefront API token.
4. Add products, variants, inventory, prices and product images.
5. Configure Shopify Markets, shipping and payment providers.
6. Add the two runtime variables above to the deployment environment.

When configured, the collection heading displays `Live from Shopify`. Without credentials, the application remains runnable and displays the demo catalog.

## API

### `GET /api/shopify/products?country=US`

Returns normalized Macella product cards. Country context is forwarded to Shopify for market-aware data.

### `POST /api/shopify/cart`

```json
{
  "countryCode": "US",
  "lines": [{ "merchandiseId": "gid://shopify/ProductVariant/123", "quantity": 1 }]
}
```

Returns Shopify's cart ID and checkout URL. The browser is redirected to that URL for the actual payment flow.

## Commands

```bash
npm run dev
npm run build
npm test
npm run lint
```

## Important files

- `app/page.tsx` — storefront and client cart
- `app/api/shopify/products/route.ts` — catalog sync endpoint
- `app/api/shopify/cart/route.ts` — Shopify Cart creation
- `lib/shopify.ts` — Storefront GraphQL client and queries
- `.env.example` — required integration variables

## Domain

The production hostname is expected to be `macella.com`. Add the domain only after it has been registered and DNS access is available.
