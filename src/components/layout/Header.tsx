import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

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

interface NavSubItem {
  title: string;
  href: string;
  description?: string;
}

interface NavItem {
  title: string;
  href: string;
  subItems?: NavSubItem[];
  badge?: string;
}

const mainNavItems: NavItem[] = [
  {
    title: "Templates",
    href: "/templates",
  },
  {
    title: "Features",
    href: "#",
    subItems: [
      {
        title: "Page Builder",
        description: "Elementor - The Most Popular Page Builder.",
        href: "#",
      },
      {
        title: "Theme Builder",
        description: "Control every part of your website.",
        href: "#",
      },
      {
        title: "Theme Options",
        description: "Customize every bit of your website in a powerful new way.",
        href: "#",
      },
      {
        title: "Animations",
        description: "Create stunning animations in just a few clicks.",
        href: "#",
      },
      {
        title: "Builder Widgets",
        description: "Hundreds of widgets to help you build anything.",
        href: "#",
      },
      {
        title: "WooCommerce",
        description: "Build a stunning online store effortlessly.",
        href: "#",
      },
    ],
  },
  {
    title: "Pricing",
    href: "/pricing",
  },
  {
    title: "Resources",
    href: "#",
    subItems: [
      {
        title: "Documentation",
        href: "#",
      },
      {
        title: "Support",
        href: "#",
      },
      {
        title: "Contact",
        href: "#",
      },
      {
        title: "Changelog",
        href: "#",
      },
      {
        title: "Suggest New Features",
        href: "#",
      },
    ],
  },
  {
    title: "Gutenberg",
    href: "/gutenberg",
    badge: "BETA",
  },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8">
        <UiCoreLogo />

        <div className="hidden lg:flex lg:items-center lg:space-x-6">
          <nav className="flex items-center space-x-6">
            {mainNavItems.map((item, index) => (
              <React.Fragment key={index}>
                {item.subItems ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center text-sm font-medium text-gray-700 hover:text-uicore-green transition-colors">
                        {item.title} <ChevronDown className="ml-1 h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-60">
                      {item.subItems.map((subItem, subIndex) => (
                        <DropdownMenuItem key={subIndex} asChild>
                          <Link
                            href={subItem.href}
                            className="flex flex-col w-full py-2"
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
