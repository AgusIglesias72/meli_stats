'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

// Mapeo de códigos de error a mensajes amigables
const errorMessages: Record<string, string> = {
  'no_code': 'No se recibió código de autorización de Mercado Libre.',
  'token_exchange': 'Hubo un problema al intercambiar el código por un token de acceso.',
  'user_fetch': 'No pudimos obtener la información de tu usuario de Mercado Libre.',
  'server_error': 'Ocurrió un error en el servidor durante el proceso de autenticación.',
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  useEffect(() => {
    const errorCode = searchParams.get('error');
    if (errorCode && errorMessages[errorCode]) {
      setErrorMessage(errorMessages[errorCode]);
    } else {
      setErrorMessage('Ocurrió un error durante el proceso de autenticación.');
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow flex items-center justify-center bg-zinc-50">
        <div className="container max-w-md mx-auto p-6">
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-12 w-12 mx-auto text-red-500 mb-4" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
            
            <h1 className="text-2xl font-bold mb-4">Error de autenticación</h1>
            
            <p className="text-gray-600 mb-6">
              {errorMessage}
            </p>
            
            <div className="space-y-3">
              <Button asChild className="w-full bg-uicore-green hover:bg-uicore-green/90 text-white">
                <Link href="/login">
                  Volver a intentar
                </Link>
              </Button>
              
              <Button asChild variant="outline" className="w-full">
                <Link href="/">
                  Volver al inicio
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}