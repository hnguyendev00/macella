import {
  addCartLines, createCart, isShopifyConfigured, removeCartLines, updateCartLines,
  type CartLineInput, type CartLineUpdateInput,
} from "@/lib/shopify";

function errorResponse(error: unknown, fallback: string) {
  return Response.json({ error: error instanceof Error ? error.message : fallback }, { status: 502 });
}

export async function POST(request: Request) {
  if (!isShopifyConfigured()) return Response.json({ error: "Shopify is not configured" }, { status: 503 });
  try {
    const body = (await request.json()) as { cartId?: string; lines?: CartLineInput[]; countryCode?: string };
    const lines = body.lines?.filter((line) => line.merchandiseId && Number.isInteger(line.quantity) && line.quantity > 0) ?? [];
    if (!lines.length) return Response.json({ error: "At least one valid cart line is required" }, { status: 400 });
    const cart = body.cartId ? await addCartLines(body.cartId, lines) : await createCart(lines, body.countryCode || "US");
    return Response.json({ cart });
  } catch (error) { return errorResponse(error, "Cart creation failed"); }
}

export async function PATCH(request: Request) {
  if (!isShopifyConfigured()) return Response.json({ error: "Shopify is not configured" }, { status: 503 });
  try {
    const body = (await request.json()) as { cartId?: string; lines?: CartLineUpdateInput[] };
    const lines = body.lines?.filter((line) => line.id && Number.isInteger(line.quantity) && line.quantity > 0) ?? [];
    if (!body.cartId || !lines.length) return Response.json({ error: "A cart ID and valid cart lines are required" }, { status: 400 });
    return Response.json({ cart: await updateCartLines(body.cartId, lines) });
  } catch (error) { return errorResponse(error, "Cart update failed"); }
}

export async function DELETE(request: Request) {
  if (!isShopifyConfigured()) return Response.json({ error: "Shopify is not configured" }, { status: 503 });
  try {
    const body = (await request.json()) as { cartId?: string; lineIds?: string[] };
    const lineIds = body.lineIds?.filter(Boolean) ?? [];
    if (!body.cartId || !lineIds.length) return Response.json({ error: "A cart ID and line IDs are required" }, { status: 400 });
    return Response.json({ cart: await removeCartLines(body.cartId, lineIds) });
  } catch (error) { return errorResponse(error, "Cart removal failed"); }
}
