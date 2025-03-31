'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TrackedItemsTab from '@/components/dashboard/TrackedItemsTab';
import { Loader2 } from 'lucide-react';

interface TrackedItem {
  id: string;
  item_id: string;
  notes: string | null;
  created_at: string;
  seller_id?: string;
  seller_nickname?: string;
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
    category_id?: string;
    seller_id?: string;
    seller_nickname?: string;
    brand?: string;
    last_updated: string;
  } | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export default function AdminTrackingPage() {
  const router = useRouter();
  const [trackedItems, setTrackedItems] = useState<TrackedItem[]>([]);
  const [loadingTracked, setLoadingTracked] = useState(true);
  const [updatingTrackedItems, setUpdatingTrackedItems] = useState(false);
  const [trackedPagination, setTrackedPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 1000,
    totalItems: 0,
    totalPages: 0
  });
  const [trackedError, setTrackedError] = useState<string | null>(null);

  // Cargar los items trackeados al iniciar
  useEffect(() => {
    loadTrackedItems();
  }, [trackedPagination.page]);

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

  const goToTrackedPage = (page: number) => {
    if (page < 1 || page > trackedPagination.totalPages) return;
    setTrackedPagination(prev => ({ ...prev, page }));
  };

  return (
    <div className="px-4 lg:px-6">
      <h1 className="text-2xl font-bold mb-6">Seguimiento de Productos</h1>
      
      {loadingTracked && trackedItems.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
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
      )}
    </div>
  );
}