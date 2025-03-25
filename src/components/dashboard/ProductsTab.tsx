import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import ProductCard from './ProductCard';
import FilterSortControls, { SortField, SortDirection, StatusFilter } from './FilterSortControls';

interface Category {
  id: string;
  name: string;
}

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

interface ProductsTabProps {
  items: Item[];
  pagination: PaginationInfo;
  loading: boolean;
  error: string | null;
  autoImportMessage: string | null;
  autoImporting: boolean;
  loadItems: () => Promise<void>;
  autoImportItems: () => Promise<void>;
  goToPage: (page: number) => void;
  formatCurrency: (amount: number, currency: string) => string;
  formatDate: (dateString: string) => string;
}

export default function ProductsTab({
  items,
  pagination,
  loading,
  error,
  autoImportMessage,
  autoImporting,
  loadItems,
  autoImportItems,
  goToPage,
  formatCurrency,
  formatDate
}: ProductsTabProps) {
  // Estado para filtrado y ordenamiento
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extraer categorías únicas de los items
  const categories = useMemo(() => {
    const uniqueCategories = new Map<string, Category>();
    
    items.forEach(item => {
      if (item.category_id && !uniqueCategories.has(item.category_id)) {
        uniqueCategories.set(item.category_id, {
          id: item.category_id,
          name: item.category_id // Idealmente esto sería el nombre de la categoría
        });
      }
    });
    
    return Array.from(uniqueCategories.values());
  }, [items]);

  // Filtrar y ordenar items
  const filteredAndSortedItems = useMemo(() => {
    // Primero filtramos
    let result = [...items];
    
    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter);
    }
    
    if (categoryFilter) {
      result = result.filter(item => item.category_id === categoryFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.title.toLowerCase().includes(query) || 
        item.item_id.toLowerCase().includes(query) ||
        (item.seller_nickname && item.seller_nickname.toLowerCase().includes(query)) // También buscar por vendedor
      );
    }
    
    // Luego ordenamos
    if (sortField) {
      result.sort((a, b) => {
        let valueA, valueB;
        
        switch (sortField) {
          case 'title':
            valueA = a.title.toLowerCase();
            valueB = b.title.toLowerCase();
            break;
          case 'price':
            valueA = a.amount || a.price;
            valueB = b.amount || b.price;
            break;
          case 'date':
            valueA = new Date(a.last_updated).getTime();
            valueB = new Date(b.last_updated).getTime();
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
  }, [items, sortField, sortDirection, statusFilter, categoryFilter, searchQuery]);

  // Cambiar ordenamiento
  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          Productos ({pagination.totalItems || 0})
        </h2>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadItems} 
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={autoImportItems} 
            disabled={autoImporting}
            className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
          >
            {autoImporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Auto Importar
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
          {error}
        </div>
      )}
      
      {autoImportMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md mb-4">
          {autoImportMessage}
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
      
      {/* Indicación de filtros activos */}
      {(statusFilter !== 'all' || categoryFilter || searchQuery || sortField) && (
        <div className="bg-blue-50 p-2 rounded text-xs text-blue-800">
          Filtros activos: 
          {statusFilter !== 'all' && ` Estado: ${statusFilter}`}
          {categoryFilter && ` Categoría: ${categoryFilter}`}
          {searchQuery && ` Búsqueda: "${searchQuery}"`}
          {sortField && ` Ordenado por: ${sortField} (${sortDirection})`}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-uicore-green" />
        </div>
      ) : filteredAndSortedItems.length === 0 ? (
        <div className="text-center p-8 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            {items.length === 0 
              ? "No tienes productos guardados. Utiliza el botón \"Auto Importar\" para cargar tus productos automáticamente."
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
                title={item.title}
                price={item.price}
                regular_amount={item.regular_amount}
                amount={item.amount}
                currency_id={item.currency_id}
                thumbnail={item.thumbnail}
                permalink={item.permalink}
                status={item.status}
                seller_nickname={item.seller_nickname} // Pasamos el seller_nickname
                seller_id={item.seller_id} // Pasamos el seller_id
                last_updated={item.last_updated}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
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
    </div>
  );
}