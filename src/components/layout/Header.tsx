"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from 'next/navigation';
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  ChevronDown
} from 'lucide-react';



const UiCoreLogo = () => (
  <div className="flex items-center">
    <Link href="/" className="flex items-center">
      <Image
        src="https://ext.same-assets.com/2574080482/1493611341.svg+xml"
        alt="UiCore PRO"
        width={120}
        height={30}
        className="h-8 w-auto"
      />
    </Link>
  </div>
);

interface NavItem {
  title: string;
  href: string;
  active?: boolean;
  adminOnly?: boolean;
  subItems?: NavSubItem[];
  badge?: string;
}

interface NavSubItem {
  title: string;
  href: string;
  description?: string;
}


export default function Header() {
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

  const isAdmin = currentUserRole === 'admin';
  const isEditor = currentUserRole === 'editor';
  const isViewer = currentUserRole === 'viewer';

  const navItems: NavItem[] = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      active: pathname === '/dashboard',
      adminOnly: true
    },
    {
      title: 'Team',
      href: '/team',
      active: pathname === '/team',
      subItems: [
        {
          title: 'Team',
          href: '/team',
        },
        {
          title: 'Invitations',
          href: '/team/invitations',
        },
        {
          title: 'Members',
          href: '/team/members',
        },
      ],
    },
    {
      title: 'Templates',
      href: '/templates',
      active: pathname === '/templates'
    },
    {
      title: 'Pricing',
      href: '/pricing',
      active: pathname === '/pricing'
    }
  ];
  
  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8">
        <UiCoreLogo />

        <div className="hidden lg:flex lg:items-center lg:space-x-6">
          <nav className="flex items-center space-x-6">
            {navItems.map((item, index) => (
              <React.Fragment key={index}>
                {item.subItems ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex cursor-pointer items-center text-sm font-medium text-gray-700 hover:text-uicore-green transition-colors">
                        {item.title} <ChevronDown className="ml-1 h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-60">
                      {item.subItems.map((subItem, subIndex) => (
                        <DropdownMenuItem key={subIndex} asChild>
                          <Link
                            href={subItem.href}
                            className="flex flex-col w-full py-2 cursor-pointer"
                          >
                            <span className="font-medium">{subItem.title}</span>
                            {subItem.description && (
                              <span className="text-xs text-gray-500">
                                {subItem.description}
                              </span>
                            )}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Link
                    href={item.href}
                    className="relative group flex items-center text-sm font-medium text-gray-700 hover:text-uicore-green transition-colors"
                  >
                    {item.title}
                    {item.badge && (
                      <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-uicore-green text-white rounded">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          <Link href="https://my.uicore.co/" className="hidden sm:inline-flex text-sm font-medium text-gray-700 hover:text-uicore-green">
            My Account
          </Link>
          <Button asChild className="bg-uicore-green hover:bg-uicore-green/90 text-white rounded-md">
            <Link href="/pricing">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
