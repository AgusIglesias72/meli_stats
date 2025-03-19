import React from "react";
import Link from "next/link";
import Image from "next/image";

const footerLinks = [
  {
    title: "Features",
    links: [
      { title: "Page Builder", href: "#" },
      { title: "Theme Options", href: "#" },
      { title: "Theme Builder", href: "#" },
      { title: "Popup Builder", href: "#" },
      { title: "Animations Engine", href: "#" },
    ],
  },
  {
    title: "Features",
    links: [
      { title: "Builder Widgets", href: "#" },
      { title: "Performance Manager", href: "#" },
      { title: "Template Library", href: "#" },
      { title: "White Label", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { title: "Contact", href: "#" },
      { title: "Documentation", href: "#" },
      { title: "Support", href: "#" },
      { title: "Suggest a Feature", href: "#" },
      { title: "TrustPilot", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { title: "Privacy Policy", href: "#" },
      { title: "Terms and Conditions", href: "#" },
    ],
  },
];

const partnerLogos = [
  { src: "https://ext.same-assets.com/2855477648/1274579215.png", alt: "Partner 1" },
  { src: "https://ext.same-assets.com/970356342/3631938119.png", alt: "Partner 2" },
  { src: "https://ext.same-assets.com/1181696292/2070781933.png", alt: "Partner 3" },
  { src: "https://ext.same-assets.com/2353943444/2054934336.webp", alt: "Partner 4" },
];

export default function Footer() {
  return (
    <footer className="bg-uicore-dark text-white" style={{
      backgroundImage: `url(https://ext.same-assets.com/772088779/3472354281.webp)`,
      backgroundPosition: 'center',
      backgroundSize: 'cover'
    }}>
      <div className="uicore-container py-16">
        {/* CTA Section */}
        <div className="bg-uicore-dark rounded-xl p-8 md:p-12 mb-16 text-center md:text-left flex flex-col md:flex-row items-center justify-between">
          <div className="mb-8 md:mb-0">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Take your website to the next level!</h2>
            <p className="text-gray-300 max-w-2xl">
              Unlock powerful tools and features to stand out from the competition. From stunning design elements to advanced functionality, our toolkit empowers you to create a digital masterpiece that captivates and converts.
            </p>
          </div>
          <Link
            href="/pricing"
            className="bg-uicore-green hover:bg-opacity-90 text-white px-6 py-3 rounded-md font-medium transition-all duration-200 whitespace-nowrap"
          >
            Get started now
          </Link>
        </div>

        {/* Partners */}
        <div className="mb-16">
          <p className="text-center text-sm text-gray-400 mb-8">
            20,000+ professionals used UiCore themes to build their websites
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8">
            {partnerLogos.map((logo, index) => (
              <div key={index} className="h-12 flex items-center">
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  width={100}
                  height={40}
                  className="h-auto w-auto max-h-10 object-contain"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Hosting Banner */}
        <div className="mb-16 bg-black/30 rounded-lg p-6 flex flex-col sm:flex-row items-center justify-between">
          <div className="flex items-center mb-4 sm:mb-0">
            <Image
              src="https://ext.same-assets.com/1100357527/3425098667.webp"
              alt="SiteGround"
              width={120}
              height={30}
              className="h-8 w-auto mr-4"
            />
            <p className="text-sm text-gray-300">Don't have hosting yet? Get started in no time with SiteGround</p>
          </div>
          <Link
            href="#"
            className="bg-white text-uicore-dark px-4 py-2 rounded text-sm font-medium"
          >
            Get Hosting
          </Link>
        </div>

        {/* Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {footerLinks.map((category, index) => (
            <div key={index}>
              <h3 className="text-white font-medium text-base mb-4">{category.title}</h3>
              <ul className="space-y-2">
                {category.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <Link href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <Image
              src="https://ext.same-assets.com/3607037830/3007962539.png"
              alt="UiCore"
              width={120}
              height={30}
              className="h-8 w-auto mb-4"
            />
            <p className="text-sm text-gray-400">© Copyright 2025 UiCore, All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
