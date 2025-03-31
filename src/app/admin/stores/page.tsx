'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Store, ShoppingBag, Plus, AlertCircle } from 'lucide-react';

interface StoreData {
  id: string;
  name: string;
  store_id: string;
  ml_user_id: string;
  role: string;
}

export default function AdminStoresPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreData | null>(null);
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
      
      // Cargar información de la tienda seleccionada
      const currentStoreResponse = await fetch('/api/stores/current');
      if (currentStoreResponse.ok) {
        const currentStoreData = await currentStoreResponse.json();
        if (currentStoreData.store) {
          setSelectedStore(currentStoreData.store);
        }
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
      
      // Actualizar el estado local
      const selectedStoreData = stores.find(store => store.id === storeId) || null;
      setSelectedStore(selectedStoreData);
      
      // Recargar la página para reflejar los cambios
      window.location.reload();
      
    } catch (err: any) {
      console.error('Error selecting store:', err);
      setError(err.message || 'Error al seleccionar la tienda');
    } finally {
      setSelecting(null);
    }
  };

  return (
    <div className="px-4 lg:px-6 w-full">
      <h1 className="text-2xl font-bold mb-6">Gestión de Tiendas</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6 flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
      
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="w-full mb-6">
          <TabsTrigger className="flex-1" value="list">Mis Tiendas</TabsTrigger>
          <TabsTrigger className="flex-1" value="connect">Conectar Tienda</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full flex justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : stores.length === 0 ? (
              <div className="col-span-full bg-yellow-50 border border-yellow-200 text-yellow-700 p-6 rounded-lg text-center">
                <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
                <h3 className="text-lg font-medium mb-2">No tienes tiendas conectadas</h3>
                <p className="mb-4">Para comenzar, conecta tu tienda de Mercado Libre usando el botón de abajo.</p>
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => {
                    const connectTab = document.querySelector('[data-value="connect"]') as HTMLElement;
                    if (connectTab) connectTab.click();
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Conectar Tienda
                </Button>
              </div>
            ) : (
              <>
                {stores.map(store => (
                  <Card key={store.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl flex justify-between items-center">
                        <span className="truncate">{store.name || `Tienda ${store.store_id}`}</span>
                        {selectedStore?.id === store.id && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Activa</span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="text-sm font-medium text-muted-foreground mb-1">ID de tienda</div>
                          <div className="font-mono text-sm bg-muted p-2 rounded">{store.store_id}</div>
                        </div>
                        
                        <div className="flex items-center">
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                            ${store.role === 'owner' ? 'bg-purple-100 text-purple-800' :
                              store.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                              store.role === 'editor' ? 'bg-green-100 text-green-800' : 
                              'bg-gray-100 text-gray-800'}`}>
                            {store.role.charAt(0).toUpperCase() + store.role.slice(1)}
                          </div>
                        </div>
                        
                        <div className="pt-2 flex gap-3">
                          {selectedStore?.id !== store.id ? (
                            <Button
                              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                              onClick={() => selectStore(store.id)}
                              disabled={!!selecting}
                            >
                              {selecting === store.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Store className="h-4 w-4 mr-2" />
                              )}
                              Seleccionar
                            </Button>
                          ) : (
                            <Button variant="outline" className="flex-1" disabled>
                              <Store className="h-4 w-4 mr-2" />
                              Seleccionada
                            </Button>
                          )}
                          
                          <Button variant="outline" asChild className="flex-1">
                            <Link href={`/admin/stores/${store.id}`}>
                              Detalles
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="connect">
          <div className="max-w-md mx-auto">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  <div className="bg-yellow-100 p-4 inline-flex rounded-full mb-4">
                    <ShoppingBag className="h-8 w-8 text-yellow-600" />
                  </div>
                  <h2 className="text-2xl font-bold">Conectar Nueva Tienda</h2>
                  <p className="text-muted-foreground mt-2">
                    Conecta tu tienda de Mercado Libre para comenzar a monitorear tus productos y ventas.
                  </p>
                </div>
                
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
                    <Link href="/connect-store">
                      <ShoppingBag className="h-5 w-5 mr-2" />
                      Conectar con Mercado Libre
                    </Link>
                  </Button>
                  
                  <p className="text-xs text-center text-muted-foreground">
                    Serás redirigido a Mercado Libre para autorizar el acceso.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}