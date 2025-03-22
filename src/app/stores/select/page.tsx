'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Store, ShoppingBag, Plus, Loader2, AlertCircle } from 'lucide-react';

interface StoreData {
  id: string;
  name: string;
  store_id: string;
  ml_user_id: string;
  role: string;
}

export default function StoreSelectionPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  
  // Cargar tiendas al iniciar
  useEffect(() => {
    loadStores();
  }, []);
  
  const loadStores = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/stores');
      
      if (!response.ok) {
        throw new Error('Error al cargar las tiendas');
      }
      
      const data = await response.json();
      setStores(data.stores || []);
      
      // Si solo hay una tienda, seleccionarla automáticamente
      if (data.stores && data.stores.length === 1) {
        selectStore(data.stores[0].id);
      }
      
    } catch (err: any) {
      console.error('Error loading stores:', err);
      setError(err.message || 'Error al cargar las tiendas');
    } finally {
      setLoading(false);
    }
  };
  
  const selectStore = async (storeId: string) => {
    try {
      setSelecting(storeId);
      
      const response = await fetch('/api/stores/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ store_id: storeId })
      });
      
      if (!response.ok) {
        throw new Error('Error al seleccionar la tienda');
      }
      
      // Redirigir al dashboard
      router.push('/dashboard');
      
    } catch (err: any) {
      console.error('Error selecting store:', err);
      setError(err.message || 'Error al seleccionar la tienda');
      setSelecting(null);
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
            <h1 className="text-2xl font-bold mb-6 text-center">Selecciona una Tienda</h1>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6 flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-uicore-green mb-4" />
                <p className="text-gray-500">Cargando tiendas...</p>
              </div>
            ) : stores.length === 0 ? (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="bg-gray-100 p-4 inline-flex rounded-full mb-4">
                    <ShoppingBag className="h-8 w-8 text-gray-500" />
                  </div>
                  <p className="text-gray-500 mb-6">
                    No tienes tiendas conectadas aún.
                  </p>
                </div>
                
                <Button asChild className="w-full bg-uicore-green hover:bg-uicore-green/90 text-white">
                  <Link href="/connect-store">
                    <Plus className="h-4 w-4 mr-2" />
                    Conectar nueva tienda
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4 mb-8">
                {stores.map(store => (
                  <div
                    key={store.id}
                    className="border rounded-lg p-4 hover:border-uicore-green cursor-pointer transition-colors"
                    onClick={() => selectStore(store.id)}
                  >
                    <div className="flex items-center">
                      <div className="bg-zinc-100 p-3 rounded-md">
                        <Store className="h-6 w-6 text-uicore-green" />
                      </div>
                      
                      <div className="ml-4 flex-grow">
                        <h3 className="font-medium">{store.name || `Tienda ${store.store_id}`}</h3>
                        <p className="text-sm text-zinc-500">ID: {store.store_id}</p>
                        
                        <div className="mt-1 flex items-center">
                          <span className={`
                            inline-block w-2 h-2 rounded-full mr-2
                            ${store.role === 'owner' ? 'bg-purple-500' :
                              store.role === 'admin' ? 'bg-blue-500' :
                              store.role === 'editor' ? 'bg-green-500' : 'bg-gray-500'}
                          `}></span>
                          <span className="text-xs text-zinc-500">
                            {store.role.charAt(0).toUpperCase() + store.role.slice(1)}
                          </span>
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={selecting === store.id}
                        className="text-uicore-green"
                      >
                        {selecting === store.id ? (
                          <span className="h-5 w-5 border-2 border-uicore-green border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <span>Acceder</span>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
                
                <div className="pt-4">
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/connect-store">
                      <Plus className="h-4 w-4 mr-2" />
                      Conectar nueva tienda
                    </Link>
                  </Button>
                </div>
              </div>
            )}
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