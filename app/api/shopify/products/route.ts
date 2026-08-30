import { getProducts, isShopifyConfigured } from "@/lib/shopify";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

export async function GET(request: Request) {
  if (!isShopifyConfigured()) {
    return Response.json(
      {
        source: "shopify",
        products: [],
      },
      {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      },
    );
  }

  try {
    const country =
      new URL(request.url).searchParams.get("country") || "US";

    const products = await getProducts(100, country.toUpperCase());

    return Response.json(
      {
        source: "shopify",
        products,
      },
      {
        headers: noCacheHeaders,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Shopify sync failed";

    return Response.json(
      {
        source: "error",
        products: [],
        error: message,
      },
      {
        status: 502,
        headers: noCacheHeaders,
      },
    );
  }
}