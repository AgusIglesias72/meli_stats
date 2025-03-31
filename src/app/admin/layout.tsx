// src/app/admin/layout.tsx
"use client";

import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { MobileSidebar } from "@/components/admin/mobile-sidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { useIsMobile } from "@/hooks/use-mobile";

// Este layout se aplicará a todas las rutas bajo /admin
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background">
        {/* Sidebar para desktop */}
        {!isMobile && (
          <AdminSidebar
            variant="inset"
            className="z-40 transition-all duration-300"
          />
        )}
        
        {/* Sidebar para móvil - se muestra como Sheet */}
        <MobileSidebar />
        
        <SidebarInset className="w-full overflow-hidden">
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                {children}
              </div>
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}