import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ProvidersWithRoute } from "@/components/ProvidersWithRoute";
import { ToastProvider } from "@/contexts/ToastContext";
import Navbar from "@/components/Navbar";


const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Eve – Tokenized Agentic Framework",
  description:
    "Full-stack analytics for mindshare on pump.fun. Track top token deployers, volume, market cap, creator fees, and more.",
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
    <html lang="en" className="dark" style={{ background: "#060608" }}>
      <body className={`${dmSans.variable} ${jetbrainsMono.variable} ${dmSans.className} antialiased bg-[#060608]`}>
        <ToastProvider>
          <ProvidersWithRoute>
            <Navbar />
            {children}
          </ProvidersWithRoute>
        </ToastProvider>
      </body>
    </html>
  );
}
