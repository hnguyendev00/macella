const SHOPIFY_API_VERSION = "2026-07";

type ShopifyEnv = {
  SHOPIFY_STORE_DOMAIN?: string;
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN?: string;
  SHOPIFY_STOREFRONT_PUBLIC_TOKEN?: string;
};

type GraphQLResponse<T> = { data?: T; errors?: Array<{ message: string }> };
export type SelectedOption = { name: string; value: string };

export type StoreVariant = {
  id: string; title: string; availableForSale: boolean; price: number; currencyCode: string;
  imageUrl?: string; imageAlt?: string; selectedOptions: SelectedOption[];
};

export type StoreProduct = {
  id: string; variantId: string; name: string; handle: string; category: string;
  price: number; currencyCode: string; imageUrl?: string; imageAlt?: string;
  availableForSale: boolean; color: string; accent: string; label?: string; variants: StoreVariant[];
};

export type CartLineInput = { merchandiseId: string; quantity: number };
export type CartLineUpdateInput = { id: string; quantity: number };
export type StoreCartLine = {
  id: string; quantity: number; variantId: string; name: string; handle: string; category: string;
  price: number; currencyCode: string; imageUrl?: string; imageAlt?: string; selectedOptions: SelectedOption[];
};
export type StoreCart = {
  id: string; checkoutUrl: string; totalQuantity: number; subtotal: number; currencyCode: string; lines: StoreCartLine[];
};

const PRODUCTS_QUERY = `#graphql
  query Products($first: Int!, $country: CountryCode) @inContext(country: $country) {
    products(first: $first, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id title handle productType featuredImage { url altText }
        variants(first: 100) {
          nodes {
            id title availableForSale selectedOptions { name value }
            image { url altText }
            price { amount currencyCode }
          }
        }
      }
    }
  }
`;

const CART_FIELDS = `#graphql
  fragment CartFields on Cart {
    id checkoutUrl totalQuantity
    cost { subtotalAmount { amount currencyCode } }
    lines(first: 100) {
      nodes {
        id quantity
        merchandise {
          ... on ProductVariant {
            id title selectedOptions { name value } price { amount currencyCode }
            image { url altText }
            product { id title handle productType featuredImage { url altText } }
          }
        }
      }
    }
  }
`;

const CART_CREATE_MUTATION = `${CART_FIELDS}
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) { cart { ...CartFields } userErrors { field message code } warnings { message code } }
  }
`;
const CART_LINES_ADD_MUTATION = `${CART_FIELDS}
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...CartFields } userErrors { field message code } warnings { message code } }
  }
`;
const CART_LINES_UPDATE_MUTATION = `${CART_FIELDS}
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ...CartFields } userErrors { field message code } warnings { message code } }
  }
`;
const CART_LINES_REMOVE_MUTATION = `${CART_FIELDS}
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...CartFields } userErrors { field message code } warnings { message code } }
  }
`;

function getConfig() {
  const runtimeGlobal = globalThis as typeof globalThis & { __MACELLA_ENV__?: ShopifyEnv };
  const runtime = runtimeGlobal.__MACELLA_ENV__ ?? (typeof process !== "undefined" ? process.env as ShopifyEnv : {});
  const domain = runtime.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const privateToken = runtime.SHOPIFY_STOREFRONT_PRIVATE_TOKEN;
  const publicToken = runtime.SHOPIFY_STOREFRONT_PUBLIC_TOKEN;
  if (!domain || (!privateToken && !publicToken)) return null;
  return { domain, privateToken, publicToken };
}

async function shopifyFetch<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const config = getConfig();
  if (!config) throw new Error("Shopify Storefront API is not configured");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.privateToken) headers["Shopify-Storefront-Private-Token"] = config.privateToken;
  else headers["X-Shopify-Storefront-Access-Token"] = config.publicToken!;
  const response = await fetch(`https://${config.domain}/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST", headers, body: JSON.stringify({ query, variables }),
  });
  const payload = (await response.json()) as GraphQLResponse<T>;
  if (!response.ok || payload.errors?.length || !payload.data) {
    throw new Error(payload.errors?.map((error) => error.message).join("; ") || `Shopify returned ${response.status}`);
  }
  return payload.data;
}

export function isShopifyConfigured() { return Boolean(getConfig()) }

export async function getProducts(first = 8, country = "US"): Promise<StoreProduct[]> {
  type QueryVariant = { id: string; title: string; availableForSale: boolean; selectedOptions: SelectedOption[]; image?: { url: string; altText?: string }; price: { amount: string; currencyCode: string } };
  type ProductQuery = { products: { nodes: Array<{ id: string; title: string; handle: string; productType: string; featuredImage?: { url: string; altText?: string }; variants: { nodes: QueryVariant[] } }> } };
  const data = await shopifyFetch<ProductQuery>(PRODUCTS_QUERY, { first, country });
  const colors = [["#d8d2c7", "#2d2b28"], ["#292a2c", "#cbc3b5"], ["#a8a294", "#f0ede6"], ["#e6e1d7", "#767064"]];
  return data.products.nodes.flatMap((product, index) => {
    const variants = product.variants.nodes.map((variant) => ({
      id: variant.id, title: variant.title, availableForSale: variant.availableForSale,
      price: Number(variant.price.amount), currencyCode: variant.price.currencyCode,
      imageUrl: variant.image?.url, imageAlt: variant.image?.altText || product.title,
      selectedOptions: variant.selectedOptions,
    }));
    const defaultVariant = variants.find((variant) => variant.availableForSale) ?? variants[0];
    if (!defaultVariant) return [];
    const [color, accent] = colors[index % colors.length];
    return [{
      id: product.id, variantId: defaultVariant.id, name: product.title, handle: product.handle,
      category: product.productType || "Macella collection", price: defaultVariant.price,
      currencyCode: defaultVariant.currencyCode,
      imageUrl: defaultVariant.imageUrl || product.featuredImage?.url,
      imageAlt: defaultVariant.imageAlt || product.featuredImage?.altText || product.title,
      availableForSale: variants.some((variant) => variant.availableForSale), color, accent,
      label: index === 0 ? "New" : undefined, variants,
    }];
  });
}

type RawCart = {
  id: string; checkoutUrl: string; totalQuantity: number;
  cost: { subtotalAmount: { amount: string; currencyCode: string } };
  lines: {
    nodes: Array<{
      id: string; quantity: number;
      merchandise: {
        id: string; title: string; selectedOptions: SelectedOption[];
        price: { amount: string; currencyCode: string }; image?: { url: string; altText?: string };
        product: { id: string; title: string; handle: string; productType: string; featuredImage?: { url: string; altText?: string } };
      };
    }>
  };
};

function normalizeCart(cart: RawCart): StoreCart {
  return {
    id: cart.id, checkoutUrl: cart.checkoutUrl, totalQuantity: cart.totalQuantity,
    subtotal: Number(cart.cost.subtotalAmount.amount), currencyCode: cart.cost.subtotalAmount.currencyCode,
    lines: cart.lines.nodes.map((line) => ({
      id: line.id, quantity: line.quantity, variantId: line.merchandise.id,
      name: line.merchandise.product.title, handle: line.merchandise.product.handle,
      category: line.merchandise.product.productType || "Macella collection",
      price: Number(line.merchandise.price.amount), currencyCode: line.merchandise.price.currencyCode,
      imageUrl: line.merchandise.image?.url || line.merchandise.product.featuredImage?.url,
      imageAlt: line.merchandise.image?.altText || line.merchandise.product.featuredImage?.altText || line.merchandise.product.title,
      selectedOptions: line.merchandise.selectedOptions,
    })),
  };
}

function unwrapCartPayload(payload: { cart?: RawCart; userErrors: Array<{ message: string }> }) {
  if (payload.userErrors.length || !payload.cart) throw new Error(payload.userErrors.map((error) => error.message).join("; ") || "Cart could not be updated");
  return normalizeCart(payload.cart);
}

export async function createCart(lines: CartLineInput[], countryCode = "US") {
  type Mutation = { cartCreate: { cart?: RawCart; userErrors: Array<{ message: string }> } };
  const data = await shopifyFetch<Mutation>(CART_CREATE_MUTATION, { input: { lines, buyerIdentity: { countryCode } } });
  return unwrapCartPayload(data.cartCreate);
}
export async function addCartLines(cartId: string, lines: CartLineInput[]) {
  type Mutation = { cartLinesAdd: { cart?: RawCart; userErrors: Array<{ message: string }> } };
  const data = await shopifyFetch<Mutation>(CART_LINES_ADD_MUTATION, { cartId, lines });
  return unwrapCartPayload(data.cartLinesAdd);
}
export async function updateCartLines(cartId: string, lines: CartLineUpdateInput[]) {
  type Mutation = { cartLinesUpdate: { cart?: RawCart; userErrors: Array<{ message: string }> } };
  const data = await shopifyFetch<Mutation>(CART_LINES_UPDATE_MUTATION, { cartId, lines });
  return unwrapCartPayload(data.cartLinesUpdate);
}
export async function removeCartLines(cartId: string, lineIds: string[]) {
  type Mutation = { cartLinesRemove: { cart?: RawCart; userErrors: Array<{ message: string }> } };
  const data = await shopifyFetch<Mutation>(CART_LINES_REMOVE_MUTATION, { cartId, lineIds });
  return unwrapCartPayload(data.cartLinesRemove);
}
