import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import { ConvexClientProvider } from "../components/providers/ConvexClientProvider";
import { AuthHeader } from "./AuthHeader";
import { StoreUserInDatabase } from "./StoreUserInDatabase";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

const siteDescription =
  "It's like WhatsApp, but it's not. A friendly, simple place to chat — real-time messaging with Next.js, Convex, and Clerk.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Not WhatsApp",
    template: "%s | Not WhatsApp",
  },
  description: siteDescription,
  keywords: [
    "chat",
    "messaging",
    "Convex",
    "Clerk",
    "Next.js",
    "real-time",
    "portfolio",
  ],
  openGraph: {
    title: "Not WhatsApp — Come say hi",
    description: siteDescription,
    type: "website",
    siteName: "Not WhatsApp",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Not WhatsApp — Come say hi",
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/sign-in">
      <html
        suppressHydrationWarning
        lang="en"
        className={`${roboto.variable} ${robotoMono.variable}`}
      >
        <body className={`${roboto.className} antialiased`}>
          <ConvexClientProvider>
            <StoreUserInDatabase />
            <AuthHeader />
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
            >
              {children}
            </ThemeProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
