import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "./providers";
import { AssetReloadGuard } from "@/components/AssetReloadGuard";

export const metadata: Metadata = {
  title: "ระบบจัดการการศึกษา — มก. กำแพงแสน",
  description: "ระบบแจ้งรายการเงื่อนไขรายวิชา มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body style={{ fontFamily: "'Inter', sans-serif" }}>
        <AssetReloadGuard />
        <Providers>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {children}
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
