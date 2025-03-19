'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';

interface Item {
  id: string;
  item_id: string;
  title: string;
  price: number;
  base_price: number;
  regular_amount: number | null;
  amount: number | null;
  currency_id: string;
  available_quantity: number;
  status: string;
  permalink: string;
  thumbnail: string;
  last_updated: string;
}

interface TrackedItem {
  id: string;
  item_id: string;
  notes: string | null;
  created_at: string;
  data: {
    id: string;
    title: string;
    price: number;
    base_price: number;
    regular_amount: number | null;
    amount: number | null;
    currency_id: string;
    available_quantity: number;
    status: string;
    permalink: string;
    thumbnail: string;
    last_updated: string;
  } | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [trackedItems, setTrackedItems] = useState<TrackedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTracked, setLoadingTracked] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });
  const [trackedPagination, setTrackedPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });
  const [itemIdInput, setItemIdInput] = useState('');
  const [trackItemIdInput, setTrackItemIdInput] = useState('');
  const [trackItemNotes, setTrackItemNotes] = useState('');
  const [fetchingItem, setFetchingItem] = useState(false);
  const [trackingItem, setTrackingItem] = useState(false);
  const [updatingTrackedItems, setUpdatingTrackedItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackedError, setTrackedError] = useState<string | null>(null);

  // Cargar los items al iniciar
  useEffect(() => {
    loadItems();
  }, [pagination.page]);

  // Cargar los items trackeados al iniciar
  useEffect(() => {
    loadTrackedItems();
  }, [trackedPagination.page]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/items?page=${pagination.page}&limit=${pagination.limit}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Si no está autenticado, redirigir al login
          router.push('/login');
          return;
        }
        throw new Error('Error fetching items');
      }
      
      const data = await response.json();
      setItems(data.items);
      setPagination(data.pagination);
      setError(null);
    } catch (err) {
      setError('No se pudieron cargar los ítems. Por favor, intenta de nuevo.');
      console.error('Error loading items:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTrackedItems = async () => {
    try {
      setLoadingTracked(true);
      const response = await fetch(`/api/tracked-items?page=${trackedPagination.page}&limit=${trackedPagination.limit}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Si no está autenticado, redirigir al login
          router.push('/login');
          return;
        }
        throw new Error('Error fetching tracked items');
      }
      
      const data = await response.json();
      setTrackedItems(data.trackedItems);
      setTrackedPagination(data.pagination);
      setTrackedError(null);
    } catch (err) {
      setTrackedError('No se pudieron cargar los ítems trackeados. Por favor, intenta de nuevo.');
      console.error('Error loading tracked items:', err);
    } finally {
      setLoadingTracked(false);
    }
  };

  const fetchItem = async () => {
    if (!itemIdInput.trim()) {
      setError('Por favor, introduce un ID de ítem válido');
      return;
    }

    try {
      setFetchingItem(true);
      setError(null);
      
      const response = await fetch('/api/items/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId: itemIdInput.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error fetching item');
      }

      // Recargar la lista de items después de agregar uno nuevo
      await loadItems();
      setItemIdInput('');
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al obtener el ítem');
      console.error('Error fetching item:', err);
    } finally {
      setFetchingItem(false);
    }
  };
  
  const trackItem = async () => {
    if (!trackItemIdInput.trim()) {
      setTrackedError('Por favor, introduce un ID de ítem válido');
      return;
    }

    try {
      setTrackingItem(true);
      setTrackedError(null);
      
      const response = await fetch('/api/tracked-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          itemId: trackItemIdInput.trim(),
          notes: trackItemNotes.trim() || null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error tracking item');
      }

      // Recargar la lista de items trackeados después de agregar uno nuevo
      await loadTrackedItems();
      setTrackItemIdInput('');
      setTrackItemNotes('');
    } catch (err: any) {
      setTrackedError(err.message || 'Ocurrió un error al agregar el ítem para trackear');
      console.error('Error tracking item:', err);
    } finally {
      setTrackingItem(false);
    }
  };
  
  const removeTrackedItem = async (id: string) => {
    try {
      const response = await fetch(`/api/tracked-items?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error removing tracked item');
      }

      // Recargar la lista de items trackeados
      await loadTrackedItems();
    } catch (err: any) {
      setTrackedError(err.message || 'Ocurrió un error al eliminar el ítem');
      console.error('Error removing tracked item:', err);
    }
  };
  
  const updateAllTrackedItems = async () => {
    try {
      setUpdatingTrackedItems(true);
      setTrackedError(null);
      
      const response = await fetch('/api/tracked-items/update', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error updating tracked items');
      }

      const data = await response.json();
      
      // Recargar la lista de items trackeados después de actualizarlos
      await loadTrackedItems();
      
      // Mostrar notificación de éxito
      alert(`Se actualizaron ${data.updated} items. Fallaron: ${data.failed}`);
    } catch (err: any) {
      setTrackedError(err.message || 'Ocurrió un error al actualizar los ítems');
      console.error('Error updating tracked items:', err);
    } finally {
      setUpdatingTrackedItems(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    const formatter = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency || 'ARS',
    });
    return formatter.format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > pagination.totalPages) return;
    setPagination(prev => ({ ...prev, page }));
  };
  
  const goToTrackedPage = (page: number) => {
    if (page < 1 || page > trackedPagination.totalPages) return;
    setTrackedPagination(prev => ({ ...prev, page }));
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow bg-zinc-50 py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold mb-6">Panel de Control</h1>

          <Tabs defaultValue="items" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="items">Mis Productos</TabsTrigger>
              <TabsTrigger value="tracked">Productos Trackeados</TabsTrigger>
              <TabsTrigger value="add">Agregar Producto</TabsTrigger>
              <TabsTrigger value="track">Agregar Tracker</TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  Productos ({pagination.totalItems || 0})
                </h2>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadItems} 
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refrescar
                </Button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-uicore-green" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center p-8 bg-white rounded-lg shadow">
                  <p className="text-gray-500">
                    No tienes productos guardados. Agrega tu primer producto usando la pestaña "Agregar Producto".
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((item) => (
                      <Card key={item.id} className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="p-4">
                            <div className="flex items-start space-x-4">
                              <div className="w-16 h-16 shrink-0">
                                <img 
                                  src={item.thumbnail} 
                                  alt={item.title}
                                  className="w-full h-full object-contain rounded-md" 
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium truncate">{item.title}</h3>
                                <p className="text-xs text-gray-500">ID: {item.item_id}</p>
                                
                                <div className="mt-2 text-sm">
                                  <p className="font-semibold">
                                    {formatCurrency(item.price, item.currency_id)}
                                  </p>
                                  {item.regular_amount && item.regular_amount !== item.amount && (
                                    <p className="text-xs line-through text-gray-500">
                                      {formatCurrency(item.regular_amount, item.currency_id)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-3 text-xs text-gray-500 flex justify-between">
                              <span>
                                Disponible: {item.available_quantity}
                              </span>
                              <span>
                                <span 
                                  className={`inline-block px-2 py-1 rounded-full text-[10px] ${
                                    item.status === 'active' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {item.status === 'active' ? 'Activo' : item.status}
                                </span>
                              </span>
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                              Actualizado: {formatDate(item.last_updated)}
                            </div>
                          </div>
                          <div className="border-t">
                            <a 
                              href={item.permalink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="block text-center py-2 text-sm text-uicore-green hover:bg-gray-50 transition-colors"
                            >
                              Ver en Mercado Libre
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Paginación */}
                  {pagination.totalPages > 1 && (
                    <div className="flex justify-center items-center space-x-2 mt-6">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => goToPage(pagination.page - 1)}
                        disabled={pagination.page === 1}
                      >
                        Anterior
                      </Button>
                      
                      <span className="text-sm">
                        Página {pagination.page} de {pagination.totalPages}
                      </span>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => goToPage(pagination.page + 1)}
                        disabled={pagination.page === pagination.totalPages}
                      >
                        Siguiente
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
            
            <TabsContent value="tracked" className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  Productos Trackeados ({trackedPagination.totalItems || 0})
                </h2>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadTrackedItems} 
                    disabled={loadingTracked}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingTracked ? 'animate-spin' : ''}`} />
                    Refrescar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={updateAllTrackedItems}
                    disabled={updatingTrackedItems || trackedItems.length === 0}
                    className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                  >
                    <Loader2 className={`h-4 w-4 mr-2 ${updatingTrackedItems ? 'animate-spin' : 'hidden'}`} />
                    Actualizar Datos
                  </Button>
                </div>
              </div>

              {trackedError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
                  {trackedError}
                </div>
              )}

              {loadingTracked ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-uicore-green" />
                </div>
              ) : trackedItems.length === 0 ? (
                <div className="text-center p-8 bg-white rounded-lg shadow">
                  <p className="text-gray-500">
                    No tienes productos trackeados. Agrega tu primer producto para trackear usando la pestaña "Agregar Tracker".
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {trackedItems.map((item) => (
                      <Card key={item.id} className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="p-4">
                            <div className="flex items-start space-x-4">
                              <div className="w-16 h-16 shrink-0">
                                {item.data?.thumbnail ? (
                                  <img 
                                    src={item.data.thumbnail} 
                                    alt={item.data.title || 'Sin datos'}
                                    className="w-full h-full object-contain rounded-md" 
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-md">
                                    <span className="text-xs text-gray-400">Sin imagen</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium truncate">
                                  {item.data?.title || 'Datos no disponibles'}
                                </h3>
                                <p className="text-xs text-gray-500">ID: {item.item_id}</p>
                                
                                {item.data ? (
                                  <div className="mt-2 text-sm">
                                    <p className="font-semibold">
                                      {formatCurrency(item.data.price, item.data.currency_id)}
                                    </p>
                                    {item.data.regular_amount && item.data.regular_amount !== item.data.amount && (
                                      <p className="text-xs line-through text-gray-500">
                                        {formatCurrency(item.data.regular_amount, item.data.currency_id)}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="mt-2 text-xs text-gray-500">
                                    Sin datos actualizados
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {item.notes && (
                              <div className="mt-2 text-xs bg-gray-50 p-2 rounded-md">
                                <span className="font-medium">Notas:</span> {item.notes}
                              </div>
                            )}
                            
                            {item.data ? (
                              <>
                                <div className="mt-3 text-xs text-gray-500 flex justify-between">
                                  <span>
                                    Disponible: {item.data.available_quantity}
                                  </span>
                                  <span>
                                    <span 
                                      className={`inline-block px-2 py-1 rounded-full text-[10px] ${
                                        item.data.status === 'active' 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {item.data.status === 'active' ? 'Activo' : item.data.status}
                                    </span>
                                  </span>
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                  Actualizado: {formatDate(item.data.last_updated)}
                                </div>
                              </>
                            ) : (
                              <div className="mt-3 text-xs text-gray-500">
                                <Button 
                                  size="sm" 
                                  className="w-full text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                                  onClick={() => updateAllTrackedItems()}
                                  disabled={updatingTrackedItems}
                                >
                                  Actualizar datos
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="border-t flex">
                            {item.data?.permalink && (
                              <a 
                                href={item.data.permalink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex-1 block text-center py-2 text-sm text-uicore-green hover:bg-gray-50 transition-colors"
                              >
                                Ver en ML
                              </a>
                            )}
                            <button 
                              onClick={() => removeTrackedItem(item.id)}
                              className="flex-1 flex justify-center items-center py-2 text-sm text-red-600 hover:bg-red-50 transition-colors border-l"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Eliminar
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Paginación */}
                  {trackedPagination.totalPages > 1 && (
                    <div className="flex justify-center items-center space-x-2 mt-6">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => goToTrackedPage(trackedPagination.page - 1)}
                        disabled={trackedPagination.page === 1}
                      >
                        Anterior
                      </Button>
                      
                      <span className="text-sm">
                        Página {trackedPagination.page} de {trackedPagination.totalPages}
                      </span>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => goToTrackedPage(trackedPagination.page + 1)}
                        disabled={trackedPagination.page === trackedPagination.totalPages}
                      >
                        Siguiente
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
            
            <TabsContent value="add">
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-xl font-semibold mb-4">Agregar Producto por ID</h2>
                  
                  <p className="text-sm text-gray-500 mb-4">
                    Ingresa el ID de un producto de Mercado Libre para agregarlo a tu panel de control.
                    Puedes encontrar el ID en la URL del producto (ej. MLA1234567890).
                  </p>
                  
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
                      {error}
                    </div>
                  )}
                  
                  <div className="flex space-x-2">
                    <div className="flex-1">
                      <Input
                        type="text"
                        placeholder="ID del producto (ej. MLA1234567890)"
                        value={itemIdInput}
                        onChange={(e) => setItemIdInput(e.target.value)}
                      />
                    </div>
                    <Button 
                      onClick={fetchItem} 
                      disabled={fetchingItem || !itemIdInput.trim()}
                      className="bg-uicore-green hover:bg-uicore-green/90 text-white"
                    >
                      {fetchingItem ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Buscar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="track">
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-xl font-semibold mb-4">Agregar Producto para Trackear</h2>
                  
                  <p className="text-sm text-gray-500 mb-4">
                    Ingresa el ID de un producto de Mercado Libre para comenzar a trackear sus cambios de precio y disponibilidad.
                    Puedes encontrar el ID en la URL del producto (ej. MLA1234567890).
                  </p>
                  
                  {trackedError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
                      {trackedError}
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="trackItemId" className="block text-sm font-medium text-gray-700 mb-1">
                        ID del producto
                      </label>
                      <Input
                        id="trackItemId"
                        type="text"
                        placeholder="ID del producto (ej. MLA1234567890)"
                        value={trackItemIdInput}
                        onChange={(e) => setTrackItemIdInput(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="trackItemNotes" className="block text-sm font-medium text-gray-700 mb-1">
                        Notas (opcional)
                      </label>
                      <Input
                        id="trackItemNotes"
                        type="text"
                        placeholder="Ej: Competidor A, Producto a monitorear, etc."
                        value={trackItemNotes}
                        onChange={(e) => setTrackItemNotes(e.target.value)}
                      />
                    </div>
                    
                    <Button 
                      onClick={trackItem} 
                      disabled={trackingItem || !trackItemIdInput.trim()}
                      className="w-full bg-uicore-green hover:bg-uicore-green/90 text-white"
                    >
                      {trackingItem ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Comenzar a trackear
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}