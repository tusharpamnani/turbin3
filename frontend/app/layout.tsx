import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from "./components/providers/WalletProvider";
import { NotificationProvider } from "./context/NotificationContext";
import '@solana/wallet-adapter-react-ui/styles.css';
import { Analytics } from "@vercel/analytics/next"

import Footer
 from "./components/Footer";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bound Market",
  description: "Decentralized binary markets for predicting volatility in digital assets. Powered by Solana.",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon1.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon0.svg', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/apple-icon.png', type: 'image/png' }
    ],
    other: [
      { url: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png' }
    ]
  },
  manifest: '/manifest.json'
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-900 text-white min-h-screen flex flex-col`}
      >
        <WalletContextProvider>
          <NotificationProvider>
            <div className="flex-grow">
              {children}
              <Analytics />
            </div>
            <Footer />
          </NotificationProvider>
        </WalletContextProvider>
      </body>
    </html>
  );
}