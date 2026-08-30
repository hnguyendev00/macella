import type { Metadata } from "next";
import "./globals.css";
import "./shopify.css";

export const metadata: Metadata = {
  title: "Macella — Modern form for everyday movement",
  description: "Unisex wardrobe essentials designed for movement, layering, and repeat wear. Worldwide delivery.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
