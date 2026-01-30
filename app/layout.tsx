import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fruit Merge Game",
  description: "A simple, addictive fruit merging game.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0", // Critical for mobile game feel
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased touch-none overflow-hidden h-screen w-screen flex flex-col items-center justify-center bg-amber-50">
        {children}
      </body>
    </html>
  );
}