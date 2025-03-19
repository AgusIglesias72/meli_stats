import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Filter, SortAsc, SortDesc } from 'lucide-react';

export type SortField = 'title' | 'price' | 'date' | null;
export type SortDirection = 'asc' | 'desc';
export type StatusFilter = 'all' | 'active' | 'paused' | 'closed';

interface FilterSortControlsProps {
  sortField: SortField;
  sortDirection: SortDirection;
  statusFilter: StatusFilter;
  categoryFilter: string;
  searchQuery: string;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  onStatusFilterChange: (status: StatusFilter) => void;
  onCategoryFilterChange: (category: string) => void;
  onSearchQueryChange: (query: string) => void;
  categories: { id: string; name: string }[];
}

export default function FilterSortControls({
  sortField,
  sortDirection,
  statusFilter,
  categoryFilter,
  searchQuery,
  onSortChange,
  onStatusFilterChange,
  onCategoryFilterChange,
  onSearchQueryChange,
  categories
}: FilterSortControlsProps) {
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      onSortChange(field, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to ascending for new field
      onSortChange(field, 'asc');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="text-sm font-medium mb-1 text-gray-700">Buscar</div>
          <Input
            type="text"
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full"
          />
        </div>
        
        {/* Status Filter */}
        <div className="w-full md:w-auto">
          <div className="text-sm font-medium mb-1 text-gray-700">Estado</div>
          <div className="flex space-x-1">
            <Button
              size="sm"
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              onClick={() => onStatusFilterChange('all')}
              className="text-xs h-9"
            >
              Todos
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'active' ? 'default' : 'outline'}
              onClick={() => onStatusFilterChange('active')}
              className="text-xs h-9 bg-green-100 text-green-800 hover:bg-green-200 border-green-200"
            >
              Activos
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'paused' ? 'default' : 'outline'}
              onClick={() => onStatusFilterChange('paused')}
              className="text-xs h-9 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200"
            >
              En Pausa
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'closed' ? 'default' : 'outline'}
              onClick={() => onStatusFilterChange('closed')}
              className="text-xs h-9 bg-red-100 text-red-800 hover:bg-red-200 border-red-200"
            >
              Finalizados
            </Button>
          </div>
        </div>
        
        {/* Category Filter */}
        <div className="w-full md:w-auto">
          <div className="text-sm font-medium mb-1 text-gray-700">Categoría</div>
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Sort Controls */}
        <div className="w-full md:w-auto">
          <div className="text-sm font-medium mb-1 text-gray-700">Ordenar por</div>
          <div className="flex space-x-1">
            <Button
              size="sm"
              variant={sortField === 'title' ? 'default' : 'outline'}
              onClick={() => handleSort('title')}
              className="text-xs h-9"
            >
              Nombre
              {sortField === 'title' && (
                sortDirection === 'asc' 
                  ? <SortAsc className="ml-1 h-3 w-3" /> 
                  : <SortDesc className="ml-1 h-3 w-3" />
              )}
            </Button>
            <Button
              size="sm"
              variant={sortField === 'price' ? 'default' : 'outline'}
              onClick={() => handleSort('price')}
              className="text-xs h-9"
            >
              Precio
              {sortField === 'price' && (
                sortDirection === 'asc' 
                  ? <SortAsc className="ml-1 h-3 w-3" /> 
                  : <SortDesc className="ml-1 h-3 w-3" />
              )}
            </Button>
            <Button
              size="sm"
              variant={sortField === 'date' ? 'default' : 'outline'}
              onClick={() => handleSort('date')}
              className="text-xs h-9"
            >
              Fecha
              {sortField === 'date' && (
                sortDirection === 'asc' 
                  ? <SortAsc className="ml-1 h-3 w-3" /> 
                  : <SortDesc className="ml-1 h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}