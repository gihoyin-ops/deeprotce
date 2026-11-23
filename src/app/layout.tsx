import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/components/QueryProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DeepChat",
  description: "DeepChat is a AI Platform for Agentic",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

import MainLayout from "@/components/MainLayout";
import OfflineGuard from "@/components/OfflineGuard";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* pre-hydration theme flag; kept inline because the output HTML already carries framework inline scripts */}
        <script dangerouslySetInnerHTML={{ __html: "(function(){try{var r=document.documentElement;var s=JSON.parse(localStorage.getItem('deepchat-general-settings')||'null')||{};var a=s.appearance==='dark'||s.appearance==='light'||s.appearance==='system'?s.appearance:'system';var dark=a==='dark'||(a==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);r.classList.toggle('dark',dark);r.style.colorScheme=dark?'dark':'light';r.dataset.appearance=a;r.dataset.contrast=s.contrast==='increased'||s.contrast==='medium'?s.contrast:(window.matchMedia('(prefers-contrast: more)').matches?'increased':'medium');r.dataset.accentColor=s.accentColor||'default';}catch(e){var r2=document.documentElement;var d2=window.matchMedia('(prefers-color-scheme: dark)').matches;r2.classList.toggle('dark',d2);r2.style.colorScheme=d2?'dark':'light';}})();" }} />
      </head>
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <MainLayout>{children}</MainLayout>
        </QueryProvider>
        <OfflineGuard />
      </body>
    </html>
  );
}
