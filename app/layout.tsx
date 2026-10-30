import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepRx",
  description: "Working weights for exercise physiology classes",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
