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
  SearchIcon,
  SettingsIcon,
  SheetIcon,
  ShoppingBagIcon,
  StoreIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

// Datos de usuario simulados - En producción esto vendría de un contexto o API
const userData = {
  user: {
    name: "Usuario Demo",
    email: "usuario@ejemplo.com",
    avatar: "/avatars/avatar.jpg", // Asegúrate de que existe o usa una imagen por defecto
  },
};

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
        className="p-0 w-[280px] max-w-[85vw] overflow-y-auto"
        overlayClassName="bg-black/60"
      >
        <SheetHeader className="p-4 border-b flex justify-between items-center">
          <Link 
            href="/admin" 
            className="flex items-center gap-2 font-semibold"
            onClick={() => setOpenMobile(false)}
          >
            <StoreIcon className="h-5 w-5" />
            <span className="text-base">ML Manager</span>
          </Link>
        
        </SheetHeader>

        <div className="flex flex-col h-full">
          {/* Sección principal */}
          <div className="p-3">
            <NavLink 
              href="/admin"
              icon={<HomeIcon className="h-5 w-5" />}
              label="Dashboard"
              active={isActive("/admin")}
              onClick={() => setOpenMobile(false)}
              
            />
          </div>
          
          {/* Sección Mi Tienda */}
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs  font-semibold text-muted-foreground">Mi Tienda</p>
          </div>
          <div className="p-3 space-y-1">
            <NavLink 
              href="/admin/stores"
              icon={<ShoppingBagIcon className="h-5 w-5" />}
              label="Tiendas"
              active={isActive("/admin/stores")}
              onClick={() => setOpenMobile(false)}
            />
            
            <NavLink 
              href="/admin/products"
              icon={<BoxIcon className="h-5 w-5" />}
              label="Productos"
              active={isActive("/admin/products")}
              onClick={() => setOpenMobile(false)}
            />
            
            <NavLink 
              href="/admin/tracking"
              icon={<LineChartIcon className="h-5 w-5" />}
              label="Seguimiento"
              active={isActive("/admin/tracking")}
              onClick={() => setOpenMobile(false)}
            />
            
            <NavLink 
              href="/admin/bulk-import"
              icon={<PackageIcon className="h-5 w-5" />}
              label="Importación Masiva"
              active={isActive("/admin/bulk-import")}
              onClick={() => setOpenMobile(false)}
            />
            
            <NavLink 
              href="/admin/analytics"
              icon={<BarChartIcon className="h-5 w-5" />}
              label="Estadísticas"
              active={isActive("/admin/analytics")}
              onClick={() => setOpenMobile(false)}
            />
          </div>
          
          {/* Sección Equipo */}
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs  font-semibold text-muted-foreground">Equipo</p>
          </div>
          <div className="p-3 space-y-1">
            <NavLink 
              href="/admin/team"
              icon={<UsersIcon className="h-5 w-5" />}
              label="Miembros"
              active={isActive("/admin/team")}
              onClick={() => setOpenMobile(false)}
            />
            
            <NavLink 
              href="/admin/invitations"
              icon={<MailIcon className="h-5 w-5" />}
              label="Invitaciones"
              active={isActive("/admin/invitations")}
              onClick={() => setOpenMobile(false)}
            />
          </div>
          
          {/* Sección Configuración */}
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs  font-semibold text-muted-foreground">Configuración</p>
          </div>
          <div className="p-3 space-y-1">
            <NavLink 
              href="/admin/integrations"
              icon={<SheetIcon className="h-5 w-5" />}
              label="Integraciones"
              active={isActive("/admin/integrations")}
              onClick={() => setOpenMobile(false)}
            />
            
            <NavLink 
              href="/admin/settings"
              icon={<SettingsIcon className="h-5 w-5" />}
              label="Configuración"
              active={isActive("/admin/settings")}
              onClick={() => setOpenMobile(false)}
            />
          </div>

          {/* Búsqueda */}
          <div className="p-3 mt-4">
            <NavLink 
              href="/admin/search"
              icon={<SearchIcon className="h-5 w-5" />}
              label="Buscar"
              active={isActive("/admin/search")}
              onClick={() => setOpenMobile(false)}
            />
          </div>
          
          {/* Footer/User */}
          <div className="mt-auto p-4 border-t">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 rounded-lg">
                <AvatarImage src={userData.user.avatar} alt={userData.user.name} />
                <AvatarFallback className="rounded-lg">UD</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium text-sm">{userData.user.name}</span>
                <span className="text-xs text-muted-foreground">{userData.user.email}</span>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function NavLink({ href, icon, label, active, onClick }: NavLinkProps) {
  return (
    <Link 
      href={href}
      className={`flex items-center gap-3 px-2 py-2 text-gray-700
        text-sm rounded-md transition-colors ${
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