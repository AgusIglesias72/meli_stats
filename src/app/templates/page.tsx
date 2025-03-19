import React from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "UiCore PRO Templates - 60+ Website Templates",
  description: "Explore our collection of 60+ ready-to-use website templates for various industries. Premium WordPress themes by UiCore PRO.",
};

const templateData = [
  {
    id: 1,
    title: "Suergy",
    category: "Energy, Solar Panels",
    image: "https://ext.same-assets.com/484673310/1798587424.webp",
    isNew: true,
  },
  {
    id: 2,
    title: "Social Vibes",
    category: "Marketing, Social Media",
    image: "https://ext.same-assets.com/28840800/2693126915.webp",
    isNew: true,
  },
  {
    id: 3,
    title: "Overlays",
    category: "Logistics, Local Services",
    image: "https://ext.same-assets.com/1328004003/1851155449.webp",
    isNew: true,
  },
  {
    id: 4,
    title: "Glam",
    category: "eCommerce, Beauty",
    image: "https://ext.same-assets.com/2188465167/2337953191.webp",
    isNew: true,
  },
  {
    id: 5,
    title: "Greenhouse",
    category: "Gardening, Local Services",
    image: "https://ext.same-assets.com/2239708579/1105935198.webp",
    isNew: false,
  },
  {
    id: 6,
    title: "Gobta",
    category: "SaaS, Ai",
    image: "https://ext.same-assets.com/4190815486/3256184885.webp",
    isNew: false,
  },
  {
    id: 7,
    title: "Elipsee",
    category: "Technology, SaaS",
    image: "https://ext.same-assets.com/2913850489/2352616130.webp",
    isNew: false,
  },
  {
    id: 8,
    title: "Yofood",
    category: "Restaurant, Local Services",
    image: "https://ext.same-assets.com/787198110/3900292081.webp",
    isNew: false,
  },
  {
    id: 9,
    title: "Sunside",
    category: "Business, Agency",
    image: "https://ext.same-assets.com/1680756666/2677170706.webp",
    isNew: false,
  },
];

export default function TemplatesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <section className="py-16 bg-zinc-50">
          <div className="uicore-container">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">Website Templates</h1>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Explore our collection of 60+ ready-to-use website templates for various industries
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
              {templateData.map((template) => (
                <div key={template.id} className="group relative overflow-hidden rounded-lg bg-white shadow-md">
                  <div className="relative h-64 overflow-hidden">
                    <Image
                      src={template.image}
                      alt={template.title}
                      width={500}
                      height={300}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      <Button asChild variant="secondary" size="sm" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white rounded">
                        <Link href="#">View Demo</Link>
                      </Button>
                    </div>
                    {template.isNew && (
                      <div className="absolute top-4 right-4 bg-uicore-green text-white text-xs px-2 py-1 rounded">
                        NEW
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-bold">{template.title}</h3>
                    <p className="text-sm text-gray-500">{template.category}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500 mb-4">
                We regularly update our template library with brand-new designs.
              </p>
              <Button asChild className="bg-uicore-green hover:bg-uicore-green/90 text-white">
                <Link href="/pricing">Get UiCore PRO</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
