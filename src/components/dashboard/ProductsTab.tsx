import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Loader2, RefreshCw } from 'lucide-react';

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

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-uicore-green" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center p-8 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            No tienes productos guardados. Utiliza el botón "Auto Importar" para cargar tus productos automáticamente.
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
                            {formatCurrency(item.amount || item.price, item.currency_id)}
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
    </div>
  );
}