import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "chat-to-order · Chat to Paid",
  description: "The conversation becomes the order, and the order becomes the payment.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-page font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
