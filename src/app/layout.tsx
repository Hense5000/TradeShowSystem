import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin", "latin-ext"], variable: "--font-figtree" });

export const metadata: Metadata = {
  title: "Trade Show System",
  description: "Accounts, users and billing for Trade Show System customers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
