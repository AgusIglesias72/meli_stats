import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function LoginPage() {
  // Esta URL debe construirse con tus credenciales de aplicación de Mercado Libre
  const REDIRECT_URI = process.env.NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';
  const APP_ID = process.env.NEXT_PUBLIC_MERCADOLIBRE_APP_ID || '';
  
  const authUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow flex items-center justify-center bg-zinc-50">
        <div className="container max-w-md mx-auto p-6">
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <h1 className="text-3xl font-bold mb-6">Iniciar sesión</h1>
            <p className="text-gray-600 mb-8">
              Para utilizar nuestra aplicación, necesitas conectar tu cuenta de Mercado Libre.
              Esto nos permitirá acceder a la información de tus productos.
            </p>
            
            <Button asChild className="w-full bg-uicore-green hover:bg-uicore-green/90 text-white">
              <Link href={authUrl}>
                Conectar con Mercado Libre
              </Link>
            </Button>
            
            <p className="text-sm text-gray-500 mt-6">
              Al conectar tu cuenta, aceptas nuestros{' '}
              <Link href="/terms" className="text-uicore-green hover:underline">
                Términos de servicio
              </Link>{' '}
              y{' '}
              <Link href="/privacy" className="text-uicore-green hover:underline">
                Política de privacidad
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}