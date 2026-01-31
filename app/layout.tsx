import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fruit Merge Game",
  description: "A simple, addictive fruit merging game.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FFFBEB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased touch-none overflow-hidden h-[100dvh] w-screen flex flex-col items-center justify-center bg-[#FFFBEB]">
        {children}
      </body>
    </html>
  );
}