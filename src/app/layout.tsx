import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Andrew Yang",
  description: "Startup founder, builder, barista. Writing about startups, life, and the things in between.",
  metadataBase: new URL("https://andrewyangpersonal.vercel.app"),
  openGraph: {
    title: "Andrew Yang",
    description: "Startup founder, builder, barista. Writing about startups, life, and the things in between.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
