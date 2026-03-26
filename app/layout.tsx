import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crypto Signal — Live Crypto Signals",
  description: "Real-time BUY/SELL signals for BTC, ETH, SOL, XRP based on breakout momentum strategy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100 selection:bg-emerald-500/20 selection:text-emerald-200`}
      >
        <nav className="bg-zinc-950 border-b border-zinc-800/50 px-4 h-10 flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">CS</Link>
          <Link href="/history" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">History</Link>
          <Link href="/settings" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Settings</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
