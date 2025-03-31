"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChartIcon,
  BoxIcon,
  HomeIcon,
  LineChartIcon,
  MailIcon,
  PackageIcon,
  PlusCircleIcon,
  SearchIcon,
  SettingsIcon,
  SheetIcon,
  ShoppingBagIcon,
  StoreIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

export function MobileSidebar() {
  const pathname = usePathname();
  const { openMobile, setOpenMobile } = useSidebar();
  
  // Helper para verificar si una ruta está activa
  const isActive = (path: string) => {
    if (path === "/admin" && pathname === "/admin") {
      return true;
    }
    
    if (path !== "/admin" && pathname.startsWith(path)) {
      return true;
    }
    
    return false;
  };

  return (
    <Sheet open={openMobile} onOpenChange={setOpenMobile}>
      <SheetContent 
        side="left" 
        className="p-0 w-[280px] max-w-[85vw]"
        overlayClassName="bg-black/60"
      >
        <SheetHeader className="p-4 border-b text-left">
          <div className="flex justify-between items-center">
            <Link 
              href="/admin" 
              className="flex items-center gap-2 font-bold"
              onClick={() => setOpenMobile(false)}
            >
              <StoreIcon className="h-5 w-5" />
              <SheetTitle className="text-left text-base">ML Manager</SheetTitle>
            </Link>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setOpenMobile(false)}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="py-2 px-3">
          <Button 
            className="w-full justify-start bg-primary"
            onClick={() => setOpenMobile(false)}
          >
            <PlusCircleIcon className="h-4 w-4 mr-2" />
            Quick Create
          </Button>
        </div>
        
        <div className="flex flex-col space-y-1 p-2">
          <MobileNavLink 
            href="/admin"
            icon={<HomeIcon />}
            label="Dashboard"
            active={isActive("/admin")}
            onClick={() => setOpenMobile(false)}
          />
          
          <div className="pt-2 pb-1">
            <p className="px-2 text-xs uppercase font-semibold text-muted-foreground">Mi Tienda</p>
          </div>
          
          <MobileNavLink 
            href="/admin/stores"
            icon={<ShoppingBagIcon />}
            label="Tiendas"
            active={isActive("/admin/stores")}
            onClick={() => setOpenMobile(false)}
          />
          
          <MobileNavLink 
            href="/admin/products"
            icon={<BoxIcon />}
            label="Productos"
            active={isActive("/admin/products")}
            onClick={() => setOpenMobile(false)}
          />
          
          <MobileNavLink 
            href="/admin/tracking"
            icon={<LineChartIcon />}
            label="Seguimiento"
            active={isActive("/admin/tracking")}
            onClick={() => setOpenMobile(false)}
          />
          
          <MobileNavLink 
            href="/admin/bulk-import"
            icon={<PackageIcon />}
            label="Importación Masiva"
            active={isActive("/admin/bulk-import")}
            onClick={() => setOpenMobile(false)}
          />
          
          <MobileNavLink 
            href="/admin/analytics"
            icon={<BarChartIcon />}
            label="Estadísticas"
            active={isActive("/admin/analytics")}
            onClick={() => setOpenMobile(false)}
          />
          
          <div className="pt-2 pb-1">
            <p className="px-2 text-xs uppercase font-semibold text-muted-foreground">Equipo</p>
          </div>
          
          <MobileNavLink 
            href="/admin/team"
            icon={<UsersIcon />}
            label="Miembros"
            active={isActive("/admin/team")}
            onClick={() => setOpenMobile(false)}
          />
          
          <MobileNavLink 
            href="/admin/invitations"
            icon={<MailIcon />}
            label="Invitaciones"
            active={isActive("/admin/invitations")}
            onClick={() => setOpenMobile(false)}
          />
          
          <div className="pt-2 pb-1">
            <p className="px-2 text-xs uppercase font-semibold text-muted-foreground">Configuración</p>
          </div>
          
          <MobileNavLink 
            href="/admin/integrations"
            icon={<SheetIcon />}
            label="Integraciones"
            active={isActive("/admin/integrations")}
            onClick={() => setOpenMobile(false)}
          />
          
          <MobileNavLink 
            href="/admin/settings"
            icon={<SettingsIcon />}
            label="Configuración"
            active={isActive("/admin/settings")}
            onClick={() => setOpenMobile(false)}
          />
          
          <MobileNavLink 
            href="/admin/search"
            icon={<SearchIcon />}
            label="Buscar"
            active={isActive("/admin/search")}
            onClick={() => setOpenMobile(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface MobileNavLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function MobileNavLink({ href, icon, label, active, onClick }: MobileNavLinkProps) {
  return (
    <Link 
      href={href}
      className={`flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
        active 
          ? "bg-primary/10 text-primary font-medium" 
          : "text-foreground hover:bg-muted"
      }`}
      onClick={onClick}
    >
      <span className="w-5 h-5">{icon}</span>
      {label}
    </Link>
  );
}