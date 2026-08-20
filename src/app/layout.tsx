import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Fraunces, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LifeFlow",
  description: "Your calm, personal productivity hub",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Media-query themeColor follows the OS scheme, not the in-app toggle.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ef" },
    { media: "(prefers-color-scheme: dark)", color: "#26221e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
