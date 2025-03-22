import React from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import FeatureSection from "@/components/home/FeatureSection";
import DashboardNav from "@/components/layout/DashboardNav";
export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <DashboardNav />
      <main className="flex-grow">
        <HeroSection />
        <FeatureSection />
      </main>
      <Footer />
    </div>
  );
}
