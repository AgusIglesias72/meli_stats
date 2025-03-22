'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingBag, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ConnectStorePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  
  // URL de autorización de Mercado Libre
  const REDIRECT_URI = process.env.NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI || 'http://localhost:3000/connect-callback';
  const APP_ID = process.env.NEXT_PUBLIC_MERCADOLIBRE_APP_ID || '';
  const authUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      <header className="bg-white shadow-sm py-4">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Dashboard
            </Link>
            <div className="flex-grow flex justify-center">
              <Image
                src="https://ext.same-assets.com/2574080482/1493611341.svg+xml"
                alt="MeliStats"
                width={120}
                height={30}
                className="h-8 w-auto"
              />
            </div>
            <div className="w-24"></div> {/* Espaciador para mantener el título centrado */}
          </div>
        </div>
      </header>
      
      <main className="flex-grow flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="bg-yellow-100 p-4 inline-flex rounded-full mb-4">
                <ShoppingBag className="h-8 w-8 text-yellow-600" />
              </div>
              <h1 className="text-2xl font-bold">Conectar Nueva Tienda</h1>
              <p className="text-gray-500 mt-2">
                Conecta tu tienda de Mercado Libre para comenzar a monitorear tus productos y ventas.
              </p>
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6 flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-md">
                <h3 className="text-sm font-medium text-blue-800 mb-2">Información Importante</h3>
                <p className="text-xs text-blue-700">
                  Al conectar tu tienda, nuestra aplicación podrá:
                </p>
                <ul className="text-xs text-blue-700 list-disc list-inside mt-2 space-y-1">
                  <li>Ver información de tus productos</li>
                  <li>Acceder a datos de ventas y métricas</li>
                  <li>Monitorear precios y stock</li>
                </ul>
                <p className="text-xs text-blue-700 mt-2">
                  No realizaremos cambios sin tu consentimiento.
                </p>
              </div>
              
              <Button asChild className="w-full bg-yellow-500 hover:bg-yellow-600 text-black">
                <a href={authUrl}>
                  <Image
                    src="/mercadolibre.svg"
                    alt="Mercado Libre"
                    width={24}
                    height={24}
                    className="h-5 w-5 mr-2"
                  />
                  Conectar con Mercado Libre
                </a>
              </Button>
              
              <p className="text-xs text-center text-gray-500">
                Serás redirigido a Mercado Libre para autorizar el acceso.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
      
      <footer className="bg-white py-4 border-t border-zinc-200">
        <div className="container mx-auto px-4 text-center text-sm text-zinc-500">
          © {new Date().getFullYear()} MeliStats. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}