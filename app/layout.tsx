import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepRx",
  description: "Working weights for exercise physiology classes",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Forces dynamic rendering everywhere: the CSP nonce needs it, and nothing here may be cached.
  await connection();

  return (
    <html lang="en-AU">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
