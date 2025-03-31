"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  BarChartIcon,
  BoxIcon,
  FileIcon,
  FolderIcon,
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
} from "lucide-react"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import Link from "next/link"

// Datos de usuario simulados - En producción esto vendría de un contexto o API
const userData = {
  user: {
    name: "Usuario Demo",
    email: "usuario@ejemplo.com",
    avatar: "/avatars/avatar.jpg", // Asegúrate de que existe o usa una imagen por defecto
  },
}

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  // Helper para verificar si una ruta está activa
  const isActive = (path: string) => {
    if (path === "/admin" && pathname === "/admin") {
      return true
    }
    
    if (path !== "/admin" && pathname.startsWith(path)) {
      return true
    }
    
    return false
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/admin">
                <StoreIcon className="h-5 w-5" />
                <span className="text-base font-semibold">ML Manager</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* Acciones rápidas 
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2 mb-2">
              <SidebarMenuButton
                tooltip="Quick Create"
                className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear 
                hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              >
                <PlusCircleIcon />
                <span>Quick Create</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        */}
        {/* Sección principal */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild
                tooltip="Dashboard"
                isActive={isActive("/admin")}
                className="text-gray-700"
              >
                <Link href="/admin">
                  <HomeIcon />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        
        {/* Sección Mi Tienda */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-500 font-light">Mi Tienda</SidebarGroupLabel>  
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild
                tooltip="Tiendas"
                isActive={isActive("/admin/stores")}
                className="text-gray-700"
              >
                <Link href="/admin/stores">
                  <ShoppingBagIcon />
                  <span  >Tiendas</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild
                tooltip="Productos"
                isActive={isActive("/admin/products")}

                className="text-gray-700"

              >
                <Link href="/admin/products">
                  <BoxIcon />
                  <span>Productos</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild
                tooltip="Seguimiento"
                isActive={isActive("/admin/tracking")}
                className="text-gray-700"

              >
                <Link href="/admin/tracking">
                  <LineChartIcon />
                  <span>Seguimiento</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild
                tooltip="Importación Masiva"
                isActive={isActive("/admin/bulk-import")}
                className="text-gray-700"
              >
                <Link href="/admin/bulk-import">
                  <PackageIcon />
                  <span>Importación Masiva</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild
                tooltip="Estadísticas"
                isActive={isActive("/admin/analytics")}
                className="text-gray-700"
              >
                <Link href="/admin/analytics">
                  <BarChartIcon />
                  <span>Estadísticas</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        
        {/* Sección Equipo */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-500 font-light">Equipo</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild
                tooltip="Gestión de Equipo"
                isActive={isActive("/admin/team")}
                className="text-gray-700"
              >
                <Link href="/admin/team">
                  <UsersIcon />
                  <span>Miembros</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild
                tooltip="Invitaciones"
                isActive={isActive("/admin/invitations")}
                className="text-gray-700"
              >
                <Link href="/admin/invitations">
                  <MailIcon />
                  <span>Invitaciones</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        
      
        {/* Sección Configuración */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-500 font-light">Configuración</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild
                tooltip="Integraciones"
                isActive={isActive("/admin/integrations")}
                className="text-gray-700"
              >
                <Link href="/admin/integrations">
                  <SheetIcon />
                  <span>Integraciones</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild
                tooltip="Configuración"
                isActive={isActive("/admin/settings")}
                className="text-gray-700"
              >
                <Link href="/admin/settings">
                  <SettingsIcon />
                  <span>Configuración</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        
        {/* Búsqueda */}
        <SidebarGroup className="mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild
                tooltip="Buscar"
                isActive={isActive("/admin/search")}
                className="text-gray-700"

              >
                <Link href="/admin/search">
                  <SearchIcon />
                  <span>Buscar</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData.user} />
      </SidebarFooter>
    </Sidebar>
  )
}