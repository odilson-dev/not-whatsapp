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

export const metadata: Metadata = {
  title: {
    default: "Not WhatsApp",
    template: "%s | Not WhatsApp",
  },
  description:
    "Real-time messaging app built with Next.js, Convex, and Clerk. Direct & group chats, statuses, read receipts, and admin moderation.",
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
    title: "Not WhatsApp",
    description:
      "Real-time messaging app — like WhatsApp, but it's not. Built with Next.js, Convex, and Clerk.",
    type: "website",
    siteName: "Not WhatsApp",
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
