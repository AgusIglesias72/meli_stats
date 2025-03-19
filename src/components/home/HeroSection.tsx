import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-20 pb-28 bg-white" style={{
      backgroundImage: `url(https://ext.same-assets.com/4133311658/3799278513.webp)`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent to-white/90"></div>

      <div className="uicore-container relative z-20 text-center">
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 max-w-4xl mx-auto">
          Meet the new UiCore PRO V2.
        </h1>

        <p className="text-lg md:text-xl mb-8 max-w-3xl mx-auto text-gray-600">
          A huge update packed with new pre-built templates, enhanced WooCommerce features, improvements, and more.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <Button asChild size="lg" className="bg-uicore-green hover:bg-uicore-green/90 text-white rounded-md px-8 py-6">
            <Link href="/pricing">
              Get started with UiCore PRO
            </Link>
          </Button>
          <p className="text-sm text-gray-500">30-day money back guarantee</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6 mt-16">
          <div className="overflow-hidden rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300">
            <Image
              src="https://ext.same-assets.com/3975317595/3577299289.webp"
              alt="Template preview"
              width={400}
              height={300}
              className="w-full h-auto object-cover"
            />
          </div>
          <div className="overflow-hidden rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300">
            <Image
              src="https://ext.same-assets.com/1137287559/3834928369.webp"
              alt="Template preview"
              width={400}
              height={300}
              className="w-full h-auto object-cover"
            />
          </div>
          <div className="overflow-hidden rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300">
            <Image
              src="https://ext.same-assets.com/4032968476/1071316879.webp"
              alt="Template preview"
              width={400}
              height={300}
              className="w-full h-auto object-cover"
            />
          </div>
          <div className="overflow-hidden rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300">
            <Image
              src="https://ext.same-assets.com/1456198343/4073993043.webp"
              alt="Template preview"
              width={400}
              height={300}
              className="w-full h-auto object-cover"
            />
          </div>
          <div className="overflow-hidden rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300">
            <Image
              src="https://ext.same-assets.com/3502612695/1322517361.webp"
              alt="Template preview"
              width={400}
              height={300}
              className="w-full h-auto object-cover"
            />
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2">
            <Image
              src="https://ext.same-assets.com/3588655524/639698195.svg+xml"
              alt="New in v.2"
              width={20}
              height={20}
              className="w-5 h-5"
            />
            <span className="text-sm font-medium">See what's new in v.2</span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Image
              src="https://ext.same-assets.com/2651564679/1418086149.webp"
              alt="Featured on"
              width={120}
              height={30}
              className="h-6 w-auto opacity-50 hover:opacity-80 transition-opacity"
            />
            <Image
              src="https://ext.same-assets.com/1343055095/1614798489.webp"
              alt="Featured on"
              width={120}
              height={30}
              className="h-6 w-auto opacity-50 hover:opacity-80 transition-opacity"
            />
            <Image
              src="https://ext.same-assets.com/2945016377/760879907.webp"
              alt="Featured on"
              width={120}
              height={30}
              className="h-6 w-auto opacity-50 hover:opacity-80 transition-opacity"
            />
            <Image
              src="https://ext.same-assets.com/3463244815/905632202.webp"
              alt="Featured on"
              width={120}
              height={30}
              className="h-6 w-auto opacity-50 hover:opacity-80 transition-opacity"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
