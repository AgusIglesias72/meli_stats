'use client';

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  
  // Verificar si el usuario está autenticado y redirigir al admin
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/user/info');
        if (response.ok) {
          // Si el usuario está autenticado, redirigir al panel de administración
          router.push('/admin');
        }
      } catch (error) {
        // Si hay un error, asumimos que no está autenticado
        console.error("Error checking authentication:", error);
      }
    };
    
    checkAuth();
  }, [router]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <section className="bg-gradient-to-b from-white to-gray-50 py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">Gestiona tus productos de Mercado Libre con facilidad</h1>
              <p className="text-xl text-gray-600 mb-8">
                Monitorea precios, stock y ventas. Integra con Google Sheets. Trabaja en equipo.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg" className="bg-uicore-green hover:bg-uicore-green/90 text-white px-8">
                  <Link href="/login">
                    Comenzar ahora
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="#features">
                    Ver características
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
        
        <section id="features" className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Características principales</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-xl font-semibold mb-3">Monitoreo en tiempo real</h3>
                <p className="text-gray-600">
                  Mantén un seguimiento detallado de tus productos y los de la competencia.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-xl font-semibold mb-3">Integración con Google Sheets</h3>
                <p className="text-gray-600">
                  Exporta y sincroniza tus datos para análisis avanzados.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-xl font-semibold mb-3">Gestión de equipo</h3>
                <p className="text-gray-600">
                  Invita a otros colaboradores y asigna diferentes niveles de acceso.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; {new Date().getFullYear()} ML Manager. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}