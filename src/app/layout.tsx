import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppProviders } from "@/components/providers/app-providers";
import { getAppBaseUrl } from "@/lib/site-url";

// Keep metadata, auth redirects, and outbound system links anchored to the
// same normalized base URL so production always prefers the intended custom domain.
const siteUrl = getAppBaseUrl();

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SWUFE HotelSim",
    template: "%s | SWUFE HotelSim",
  },
  description:
    "西南财经大学酒店经营模拟平台，支持学生、教师、管理与比赛公开展示等统一业务流程。",
  keywords: [
    "酒店经营模拟",
    "Hotel Simulation",
    "SWUFE",
    "课程实验平台",
    "教学系统",
    "酒店管理比赛",
  ],
  openGraph: {
    title: "SWUFE HotelSim",
    description:
      "面向教学、实验与比赛展示的一体化酒店经营模拟平台。",
    type: "website",
    locale: "zh_CN",
    siteName: "SWUFE HotelSim",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "SWUFE HotelSim",
    description:
      "面向教学、实验与比赛展示的一体化酒店经营模拟平台。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Root layout stays intentionally light: fonts, theme tokens, and shared
    // providers belong here so later auth and dashboard route groups inherit them.
    <html lang="zh-CN" className="font-sans">
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "min-h-screen bg-background text-foreground antialiased"
        )}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
