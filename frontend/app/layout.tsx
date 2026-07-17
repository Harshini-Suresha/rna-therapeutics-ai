import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RNA Therapeutics AI Platform",
  description: "ASO design platform — gene retrieval, mechanism selection, and candidate design.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
