// src/components/layout/DashboardNav.tsx
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  Home,
  Package,
  Users,
  Settings,
  LineChart,
  Clock,
  ExternalLink,
  Store
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  active?: boolean;
  adminOnly?: boolean;
}

export default function DashboardNav() {
  const pathname = usePathname();
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  
  // Obtener el rol del usuario actual
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch('/api/stores/current');
        if (response.ok) {
          const data = await response.json();
          setCurrentUserRole(data.role || '');
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };
    
    fetchUserRole();
  }, []);
  
  // Determinar si el usuario es admin o owner
  const isAdmin = ['owner', 'admin'].includes(currentUserRole);
  
  const navItems: NavItem[] = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: <Home className="h-5 w-5" />,
      active: pathname === '/dashboard'
    },
    {
      title: 'Productos',
      href: '/dashboard/products',
      icon: <Package className="h-5 w-5" />,
      active: pathname === '/dashboard/products'
    },
    {
      title: 'Seguimiento',
      href: '/dashboard/tracking',
      icon: <LineChart className="h-5 w-5" />,
      active: pathname === '/dashboard/tracking'
    },
    {
      title: 'Historial',
      href: '/dashboard/history',
      icon: <Clock className="h-5 w-5" />,
      active: pathname === '/dashboard/history'
    },
    {
      title: 'Equipo',
      href: '/team',
      icon: <Users className="h-5 w-5" />,
      active: pathname === '/team',
      adminOnly: true
    },
    {
      title: 'Configuración',
      href: '/dashboard/settings',
      icon: <Settings className="h-5 w-5" />,
      active: pathname === '/dashboard/settings'
    }
  ];
  
  // Filtrar elementos de navegación según permisos
  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);
  
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* Sección de tienda actual */}
      <div className="p-4 border-b border-gray-100">
        <Link href="/stores/select" className="flex items-center justify-between hover:text-uicore-green">
          <div className="flex items-center">
            <Store className="h-5 w-5 mr-2" />
            <span className="font-medium">Cambiar Tienda</span>
          </div>
          <ChevronDown className="h-4 w-4" />
        </Link>
      </div>
      
      {/* Elementos de navegación principal */}
      <nav className="p-2">
        <ul className="space-y-1">
          {filteredNavItems.map((item, index) => (
            <li key={index}>
              <Link
                href={item.href}
                className={`flex items-center px-3 py-2 rounded-md text-sm ${
                  item.active
                    ? 'bg-uicore-green/10 text-uicore-green font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.icon}
                <span className="ml-3">{item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      {/* Enlaces externos */}
      <div className="p-4 border-t border-gray-100">
        <a
          href="https://developers.mercadolibre.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center text-sm text-gray-600 hover:text-uicore-green"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          API de Mercado Libre
        </a>
      </div>
    </div>
  );
}