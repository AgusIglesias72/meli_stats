'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProductsTab from '@/components/dashboard/ProductsTab';
import { Loader2 } from 'lucide-react';

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
  seller_id?: string;
  seller_nickname?: string;
  last_updated: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export default function AdminProductsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoImporting, setAutoImporting] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [autoImportMessage, setAutoImportMessage] = useState<string | null>(null);
  
  // Cargar los items al iniciar
  useEffect(() => {
    loadItems();
  }, [pagination.page]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/items?page=${pagination.page}&limit=${pagination.limit}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Si no está autenticado, redirigir al login
          //router.push('/login');
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

  return (
    <div className="px-4 lg:px-6">
      <h1 className="text-2xl font-bold mb-6">Productos</h1>
      
      {loading && items.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
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
      )}
    </div>
  );
}