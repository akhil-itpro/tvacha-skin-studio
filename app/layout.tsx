import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tvacha — Your skin, understood",
  description:
    "Know what your skin needs, and what to skip. A private skin check, a simple routine, and skincare within your budget. For adults 18+.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Tvacha" },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1F6B63",
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
