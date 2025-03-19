'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ProductsTab from '@/components/dashboard/ProductsTab';
import TrackedItemsTab from '@/components/dashboard/TrackedItemsTab';
import AddTrackerTab from '@/components/dashboard/AddTrackerTab';

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
  category_id: string;
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
  const [autoImporting, setAutoImporting] = useState(false);
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
  const [trackItemIdInput, setTrackItemIdInput] = useState('');
  const [trackItemNotes, setTrackItemNotes] = useState('');
  const [trackingItem, setTrackingItem] = useState(false);
  const [updatingTrackedItems, setUpdatingTrackedItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoImportMessage, setAutoImportMessage] = useState<string | null>(null);
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

  const autoImportItems = async () => {
    if (autoImporting) return;

    try {
      setAutoImporting(true);
      setError(null);
      setAutoImportMessage('Importando productos...');
      
      const response = await fetch('/api/items/auto-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error importing items');
      }

      const result = await response.json();
      
      // Recargar la lista de items después de importar
      await loadItems();
      
      // Mostrar mensaje de éxito
      setAutoImportMessage(`Importación completada. Importados: ${result.imported}, Fallidos: ${result.failed}`);
      
      // Limpiar el mensaje después de unos segundos
      setTimeout(() => {
        setAutoImportMessage(null);
      }, 5000);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al importar los ítems');
      console.error('Error auto-importing items:', err);
    } finally {
      setAutoImporting(false);
    }
  };
  
  const trackItem = async () => {
    if (!trackItemIdInput.trim()) {
      setTrackedError('Por favor, introduce un ID de ítem válido');
      return Promise.reject(new Error('ID de ítem vacío'));
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
      
      // Retornamos promesa exitosa
      return Promise.resolve();
    } catch (err: any) {
      setTrackedError(err.message || 'Ocurrió un error al agregar el ítem para trackear');
      console.error('Error tracking item:', err);
      return Promise.reject(err);
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
        <div className="container mx-auto px-4 max-w-7xl">
          <h1 className="text-3xl font-bold mb-6">Panel de Control</h1>

          <Tabs defaultValue="items" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="items">Mis Productos</TabsTrigger>
              <TabsTrigger value="tracked">Productos Trackeados</TabsTrigger>
              <TabsTrigger value="track">Agregar Tracker</TabsTrigger>
            </TabsList>

            <TabsContent value="items">
              <ProductsTab 
                items={items}
                pagination={pagination}
                loading={loading}
                error={error}
                autoImportMessage={autoImportMessage}
                autoImporting={autoImporting}
                loadItems={loadItems}
                autoImportItems={autoImportItems}
                goToPage={goToPage}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            </TabsContent>
            
            <TabsContent value="tracked">
              <TrackedItemsTab 
                trackedItems={trackedItems}
                trackedPagination={trackedPagination}
                loadingTracked={loadingTracked}
                updatingTrackedItems={updatingTrackedItems}
                trackedError={trackedError}
                loadTrackedItems={loadTrackedItems}
                updateAllTrackedItems={updateAllTrackedItems}
                removeTrackedItem={removeTrackedItem}
                goToTrackedPage={goToTrackedPage}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            </TabsContent>
            
            <TabsContent value="track">
              <AddTrackerTab 
                trackItemIdInput={trackItemIdInput}
                trackItemNotes={trackItemNotes}
                trackingItem={trackingItem}
                trackedError={trackedError}
                setTrackItemIdInput={setTrackItemIdInput}
                setTrackItemNotes={setTrackItemNotes}
                trackItem={trackItem}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}