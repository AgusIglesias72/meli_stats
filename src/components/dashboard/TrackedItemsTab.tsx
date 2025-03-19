import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, RefreshCw, Trash2 } from 'lucide-react';

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
    brand?: string;
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
                              {formatCurrency(item.data.amount || item.data.price, item.data.currency_id)}
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
                    {item.data && item.data.brand && (
                      <div className="mt-2 text-xs bg-blue-50 p-2 rounded-md">
                        <span className="font-medium">Marca:</span> {item.data.brand}
                      </div>
                    )}
                    
                    {item.data ? (
                      <>
                        <div className="mt-3 text-xs text-gray-500 flex justify-end">
                          <span>
                            <span 
                              className={`inline-block px-2 py-1 rounded-full text-[10px] ${
                                item.data.status === 'active' 
                                  ? 'bg-green-100 text-green-800' 
                                  : item.data.status === 'paused'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : item.data.status === 'closed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {item.data.status === 'active' 
                                ? 'Activo' 
                                : item.data.status === 'paused'
                                ? 'En Pausa'
                                : item.data.status === 'closed'
                                ? 'Finalizada'
                                : item.data.status}
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
    </div>
  );
}