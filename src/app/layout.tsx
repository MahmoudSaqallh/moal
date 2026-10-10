import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Cormorant_Garamond, Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/** Display serif for the MallVerse brand, headings and some storefront signage. */
const display = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

/** High-contrast serif for luxury storefront lettering (painted into 3D signs). */
const luxe = Bodoni_Moda({
  variable: "--font-luxe",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "MallVerse: a virtual shopping mall",
  description:
    "Walk through MallVerse, an explorable 3D shopping mall in your browser. Visit six boutiques, inspect products and fill a demo cart.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#15130f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${display.variable} ${luxe.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
