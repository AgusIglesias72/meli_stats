import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function FeatureSection() {
  return (
    <section className="bg-white py-20">
      <div className="uicore-container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">UiCore Framework v.6</h2>
          <p className="text-xl text-gray-600 mb-6">A true powerhouse for WordPress.</p>
          <p className="max-w-3xl mx-auto text-gray-600">
            Packed with a lot of amazing tools and features, UiCore PRO allows you to customize every bit of your website in a powerful new way.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-20">
          <div>
            <h3 className="text-2xl font-bold mb-6">Huge Design Collection</h3>
            <p className="text-gray-600 mb-8">
              With a great range of blocks, widgets, and pages, you'll have everything you need to create a truly exceptional website, that stands out.
            </p>

            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="text-center">
                <div className="text-5xl font-bold mb-2 text-uicore-green">02</div>
                <div className="text-xl font-bold">500+</div>
                <div className="text-sm text-gray-500">Blocks</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold mb-2 text-uicore-green">02</div>
                <div className="text-xl font-bold">500+</div>
                <div className="text-sm text-gray-500">Widgets</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold mb-2 text-uicore-green">06</div>
                <div className="text-xl font-bold">000+</div>
                <div className="text-sm text-gray-500">Inner Pages</div>
              </div>
            </div>
          </div>
          <div className="relative">
            <Image
              src="https://ext.same-assets.com/3040793705/2920567719.webp"
              alt="Design Collection"
              width={600}
              height={400}
              className="rounded-lg shadow-lg w-full h-auto"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-20">
          <div className="order-2 md:order-1 relative">
            <div className="absolute top-0 right-0 -translate-y-10 translate-x-10 bg-uicore-green text-white rounded-lg p-4 shadow-lg z-10">
              <div className="font-bold text-3xl">PageSpeed Score</div>
              <div className="text-xl">Grade A</div>
            </div>
            <Image
              src="https://ext.same-assets.com/1703427799/1256119652.webp"
              alt="Outstanding Performance"
              width={600}
              height={400}
              className="rounded-lg shadow-lg w-full h-auto"
            />
          </div>
          <div className="order-1 md:order-2">
            <h3 className="text-2xl font-bold mb-6">Outstanding Performance</h3>
            <p className="text-gray-600 mb-8">
              Analyze and manage your website features and make better performance-related decisions, all in one panel, with no extra plugins to think about.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-20">
          <div>
            <h3 className="text-2xl font-bold mb-6">eCommerce Ready</h3>
            <p className="text-gray-600 mb-8">
              Fully equipped for eCommerce, with everything you need to start selling online.
            </p>
          </div>
          <div className="relative">
            <Image
              src="https://ext.same-assets.com/3000931115/97239584.webp"
              alt="eCommerce Ready"
              width={600}
              height={400}
              className="rounded-lg shadow-lg w-full h-auto"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-20">
          <div className="order-2 md:order-1 relative">
            <Image
              src="https://ext.same-assets.com/359811796/1890395100.webp"
              alt="Next-Gen Theme Options"
              width={600}
              height={400}
              className="rounded-lg shadow-lg w-full h-auto"
            />
          </div>
          <div className="order-1 md:order-2">
            <h3 className="text-2xl font-bold mb-6">Next-Gen Theme Options</h3>
            <p className="text-gray-600 mb-8">
              With this powerful tool, you'll be able to control every aspect of your website from one location. From global fonts and colors to layouts and features, you'll have complete control over your site's look and feel.
            </p>
          </div>
        </div>

        <div className="text-center mt-24">
          <h2 className="text-3xl md:text-4xl font-bold mb-12">Full Websites</h2>
          <h3 className="text-xl md:text-2xl font-bold mb-8">70+ pre-built websites</h3>
          <p className="max-w-3xl mx-auto text-gray-600 mb-12">
            Explore an ever-growing collection of ready-made websites to help you kickstart your design journey. Import any design in one-click, mix-and-match sections, and adapt it to your branding in no time.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            <div className="group relative overflow-hidden rounded-lg shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-t from-uicore-dark/90 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Image
                src="https://ext.same-assets.com/484673310/1798587424.webp"
                alt="Template - Suergy"
                width={400}
                height={300}
                className="w-full h-auto transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute bottom-0 left-0 right-0 p-6 z-20 transform translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <div className="text-lg font-bold text-white">Suergy<span className="text-xs ml-1 px-1.5 py-0.5 bg-uicore-green text-white rounded">NEW</span></div>
                <div className="text-sm text-gray-300">Energy, Solar Panels</div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-lg shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-t from-uicore-dark/90 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Image
                src="https://ext.same-assets.com/28840800/2693126915.webp"
                alt="Template - Social Vibes"
                width={400}
                height={300}
                className="w-full h-auto transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute bottom-0 left-0 right-0 p-6 z-20 transform translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <div className="text-lg font-bold text-white">Social Vibes<span className="text-xs ml-1 px-1.5 py-0.5 bg-uicore-green text-white rounded">NEW</span></div>
                <div className="text-sm text-gray-300">Marketing, Social Media</div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-lg shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-t from-uicore-dark/90 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Image
                src="https://ext.same-assets.com/1328004003/1851155449.webp"
                alt="Template - Overlays"
                width={400}
                height={300}
                className="w-full h-auto transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute bottom-0 left-0 right-0 p-6 z-20 transform translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <div className="text-lg font-bold text-white">Overlays<span className="text-xs ml-1 px-1.5 py-0.5 bg-uicore-green text-white rounded">NEW</span></div>
                <div className="text-sm text-gray-300">Logistics, Local Services</div>
              </div>
            </div>
          </div>

          <div className="text-center mt-8 mb-4">
            <Link href="/templates" className="font-medium text-uicore-green hover:text-uicore-green/80 transition-colors">
              See all 60+ templates
            </Link>
            <p className="text-sm text-gray-500 mt-2">We regularly update our template library with brand-new designs.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
