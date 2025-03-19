import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import ProductCard from './ProductCard';
import FilterSortControls, { SortField, SortDirection, StatusFilter } from './FilterSortControls';

interface Category {
  id: string;
  name: string;
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
    category_id?: string;
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

interface TrackedItemsTabProps {
  trackedItems: TrackedItem[];
  trackedPagination: PaginationInfo;
  loadingTracked: boolean;
  updatingTrackedItems: boolean;
  trackedError: string | null;
  loadTrackedItems: () => Promise<void>;
  updateAllTrackedItems: () => Promise<void>;
  removeTrackedItem: (id: string) => Promise<void>;
  goToTrackedPage: (page: number) => void;
  formatCurrency: (amount: number, currency: string) => string;
  formatDate: (dateString: string) => string;
}

export default function TrackedItemsTab({
  trackedItems,
  trackedPagination,
  loadingTracked,
  updatingTrackedItems,
  trackedError,
  loadTrackedItems,
  updateAllTrackedItems,
  removeTrackedItem,
  goToTrackedPage,
  formatCurrency,
  formatDate
}: TrackedItemsTabProps) {
  // Estado para filtrado y ordenamiento
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extraer categorías únicas de los items
  const categories = useMemo(() => {
    const uniqueCategories = new Map<string, Category>();
    
    trackedItems.forEach(item => {
      if (item.data?.category_id && !uniqueCategories.has(item.data.category_id)) {
        uniqueCategories.set(item.data.category_id, {
          id: item.data.category_id,
          name: item.data.category_id // Idealmente esto sería el nombre de la categoría
        });
      }
    });
    
    return Array.from(uniqueCategories.values());
  }, [trackedItems]);

  // Filtrar y ordenar items
  const filteredAndSortedItems = useMemo(() => {
    // Primero filtramos
    let result = [...trackedItems];
    
    if (statusFilter !== 'all') {
      result = result.filter(item => item.data?.status === statusFilter);
    }
    
    if (categoryFilter) {
      result = result.filter(item => item.data?.category_id === categoryFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        (item.data?.title?.toLowerCase().includes(query)) || 
        item.item_id.toLowerCase().includes(query) ||
        (item.notes?.toLowerCase().includes(query))
      );
    }
    
    // Luego ordenamos
    if (sortField) {
      result.sort((a, b) => {
        let valueA, valueB;
        
        switch (sortField) {
          case 'title':
            valueA = a.data?.title?.toLowerCase() || '';
            valueB = b.data?.title?.toLowerCase() || '';
            break;
          case 'price':
            valueA = a.data?.amount || a.data?.price || 0;
            valueB = b.data?.amount || b.data?.price || 0;
            break;
          case 'date':
            valueA = a.data ? new Date(a.data.last_updated).getTime() : 0;
            valueB = b.data ? new Date(b.data.last_updated).getTime() : 0;
            break;
          default:
            return 0;
        }
        
        if (valueA < valueB) {
          return sortDirection === 'asc' ? -1 : 1;
        }
        if (valueA > valueB) {
          return sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return result;
  }, [trackedItems, sortField, sortDirection, statusFilter, categoryFilter, searchQuery]);

  // Cambiar ordenamiento
  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  };

  return (
    <div className="space-y-6">
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

      {/* Controles de filtrado y ordenamiento */}
      <FilterSortControls
        sortField={sortField}
        sortDirection={sortDirection}
        statusFilter={statusFilter}
        categoryFilter={categoryFilter}
        searchQuery={searchQuery}
        onSortChange={handleSortChange}
        onStatusFilterChange={setStatusFilter}
        onCategoryFilterChange={setCategoryFilter}
        onSearchQueryChange={setSearchQuery}
        categories={categories}
      />
      
      {/* Indicación de filtros activos para debug */}
      {(statusFilter !== 'all' || categoryFilter || searchQuery || sortField) && (
        <div className="bg-blue-50 p-2 rounded text-xs text-blue-800">
          Filtros activos: 
          {statusFilter !== 'all' && ` Estado: ${statusFilter}`}
          {categoryFilter && ` Categoría: ${categoryFilter}`}
          {searchQuery && ` Búsqueda: "${searchQuery}"`}
          {sortField && ` Ordenado por: ${sortField} (${sortDirection})`}
        </div>
      )}

      {loadingTracked ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-uicore-green" />
        </div>
      ) : filteredAndSortedItems.length === 0 ? (
        <div className="text-center p-8 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            {trackedItems.length === 0 
              ? "No tienes productos trackeados. Agrega tu primer producto para trackear usando la pestaña \"Agregar Tracker\"."
              : "No se encontraron productos con los filtros aplicados."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedItems.map((item) => (
              <ProductCard
                key={item.id}
                id={item.id}
                item_id={item.item_id}
                title={item.data?.title || 'Datos no disponibles'}
                price={item.data?.price || 0}
                regular_amount={item.data?.regular_amount || null}
                amount={item.data?.amount || null}
                currency_id={item.data?.currency_id || 'ARS'}
                thumbnail={item.data?.thumbnail || ''}
                permalink={item.data?.permalink || '#'}
                status={item.data?.status || 'unknown'}
                last_updated={item.data?.last_updated || item.created_at}
                notes={item.notes}
                brand={item.data?.brand}
                onRemove={removeTrackedItem}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
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
    </div>
  );
}