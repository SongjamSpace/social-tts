import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ToastProvider } from "@/contexts/ToastContext";
export const metadata: Metadata = {
  title: "EVE – voices that say the unsayable",
  description:
    "Permissionless voice agents that pay the voice owner. Discover, play, and generate voices that say the unsayable.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon-64x64.png", sizes: "64x64", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="antialiased">
        <ToastProvider>
          <Providers>
            {children}
          </Providers>
        </ToastProvider>
      </body>
    </html>
  );
}
