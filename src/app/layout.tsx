import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
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
  title: "Relora | Personal relationship memory app",
  description:
    "Join the Relora waitlist and remember the details that make relationships feel easy.",
  metadataBase: new URL("https://andrewyangpersonal.vercel.app"),
  openGraph: {
    title: "Relora waitlist",
    description:
      "Relora turns quick voice notes into structured context so you show up prepared.",
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
