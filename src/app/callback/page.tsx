'use client';

import React, { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';

// Componente que usa useSearchParams, envuelto en Suspense
function CallbackContent() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();
  
  // Extraer código desde la URL usando window.location
  React.useEffect(() => {
    // Usar URLSearchParams con window.location
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errorParam = params.get('error');
    
    if (errorParam) {
      setError(`Error de autorización: ${errorParam}`);
      setLoading(false);
      return;
    }
    
    if (!code) {
      setError('No se recibió código de autorización');
      setLoading(false);
      return;
    }
    
    // Proceder con el procesamiento del código
    processAuthCode(code);
  }, [router]);
  
  const processAuthCode = async (code: string) => {
    try {
      // Llamar a tu API para intercambiar el código por tokens
      const response = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al procesar la autorización');
      }
      
      // Redirigir al dashboard en caso de éxito
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Error processing authorization:', err);
      setError(err.message || 'Error al procesar la autorización');
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-uicore-green mb-4" />
        <p className="text-gray-500">Procesando autorización...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error de autorización</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
        
        <div className="flex flex-col space-y-3">
          <Button asChild className="w-full bg-uicore-green hover:bg-uicore-green/90 text-white">
            <Link href="/login">
              Volver al inicio de sesión
            </Link>
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="h-12 w-12 animate-spin text-uicore-green mb-4" />
      <p className="text-gray-500">Finalizando autorización...</p>
    </div>
  );
}

export default function CallbackPage() {
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
            <h1 className="text-2xl font-bold mb-6 text-center">Procesando Autorización</h1>
            
            <Suspense fallback={
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-uicore-green mb-4" />
                <p className="text-gray-500">Cargando...</p>
              </div>
            }>
              <CallbackContent />
            </Suspense>
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