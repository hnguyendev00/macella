import { getProducts, isShopifyConfigured } from "@/lib/shopify";

export async function GET(request: Request) {
  if (!isShopifyConfigured()) {
    return Response.json({
      source: "demo",
      products: [],
    });
  }

  try {
    const country =
      new URL(request.url).searchParams.get("country") || "US";

    const products = await getProducts(
      8,
      country.toUpperCase(),
    );

    return Response.json({
      source: "shopify",
      products,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Shopify sync failed";

    return Response.json(
      {
        source: "error",
        products: [],
        error: message,
      },
      { status: 502 },
    );
  }
}