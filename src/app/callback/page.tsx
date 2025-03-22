'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export default function ConnectCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  useEffect(() => {
    // Si hay un error en los parámetros de URL
    if (error) {
      setLoading(false);
      setConnectionError(errorDescription || 'Error al conectar con Mercado Libre');
      return;
    }
    
    // Si no hay código de autorización
    if (!code) {
      setLoading(false);
      setConnectionError('No se recibió el código de autorización');
      return;
    }
    
    // Proceder con la conexión
    connectStore();
  }, [code, error, errorDescription]);
  
  const connectStore = async () => {
    try {
      setConnecting(true);
      
      const response = await fetch('/api/stores/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: process.env.NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al conectar la tienda');
      }
      
      // Conexión exitosa
      setSuccess(true);
      
      // Redirigir al dashboard después de 2 segundos
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
      
    } catch (err: any) {
      console.error('Error connecting store:', err);
      setConnectionError(err.message || 'Error al conectar la tienda');
    } finally {
      setLoading(false);
      setConnecting(false);
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      <header className="bg-white shadow-sm py-4">
        <div className="container mx-auto px-4">
          <div className="flex justify-center">
            <Image
              src="https://ext.same-assets.com/2574080482/1493611341.svg+xml"
              alt="MeliStats"
              width={120}
              height={30}
              className="h-8 w-auto"
            />
          </div>
        </div>
      </header>
      
      <main className="flex-grow flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <h1 className="text-2xl font-bold mb-6 text-center">Conectando Tienda</h1>
            
            {loading || connecting ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-uicore-green mb-4" />
                <p className="text-gray-500">
                  {loading 
                    ? 'Verificando código de autorización...' 
                    : 'Conectando tu tienda de Mercado Libre...'}
                </p>
              </div>
            ) : connectionError ? (
              <div className="space-y-6">
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-start">
                  <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Error de conexión</p>
                    <p className="text-sm">{connectionError}</p>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-3">
                  <Button asChild className="w-full bg-uicore-green hover:bg-uicore-green/90 text-white">
                    <Link href="/connect-store">
                      Intentar de nuevo
                    </Link>
                  </Button>
                  
                  <Button asChild variant="outline">
                    <Link href="/dashboard">
                      Volver al Dashboard
                    </Link>
                  </Button>
                </div>
              </div>
            ) : success ? (
              <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md flex items-start">
                  <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">¡Conexión exitosa!</p>
                    <p className="text-sm">Tu tienda ha sido conectada correctamente. Serás redirigido al dashboard en unos segundos.</p>
                  </div>
                </div>
              </div>
            ) : null}
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