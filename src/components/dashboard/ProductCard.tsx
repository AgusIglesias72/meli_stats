import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, ExternalLink } from 'lucide-react';



interface ProductCardProps {
    id: string;
    item_id: string;
    title: string;
    price: number;
    regular_amount: number | null;
    amount: number | null;
    currency_id: string;
    thumbnail: string;
    permalink: string;
    status: string;
    last_updated: string;
    notes?: string | null;
    brand?: string | null; 
    onRemove?: (id: string) => Promise<void>;
    formatCurrency: (amount: number, currency: string) => string;
    formatDate: (dateString: string) => string;
  }
  
  export default function ProductCard({
    id,
    item_id,
    title,
    price,
    regular_amount,
    amount,
    currency_id,
    thumbnail,
    permalink,
    status,
    last_updated,
    notes,
    brand,
    onRemove,
    formatCurrency,
    formatDate
  }: ProductCardProps) {
    return (
      <Card className="overflow-hidden h-full flex flex-col">
        <CardContent className="p-0 flex flex-col h-full">
          <div className="p-4 flex-grow">
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 shrink-0 bg-gray-50 rounded-md flex items-center justify-center overflow-hidden">
                {thumbnail ? (
                  <img 
                    src={thumbnail} 
                    alt={title}
                    className="w-full h-full object-contain" 
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <span className="text-xs text-gray-400">Sin imagen</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium truncate">{title}</h3>
                <p className="text-xs text-gray-500">ID: {item_id}</p>
                
                <div className="mt-3 h-12"> {/* Altura fija para los precios */}
                  <p className="font-semibold">
                    {formatCurrency(amount || price, currency_id)}
                  </p>
                  {regular_amount && regular_amount !== amount && (
                    <p className="text-xs line-through text-gray-500">
                      {formatCurrency(regular_amount, currency_id)}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {notes && (
              <div className="mt-2 text-xs bg-gray-50 p-2 rounded-md">
                <span className="font-medium">Notas:</span> {notes}
              </div>
            )}
            
            {brand && (
              <div className="mt-2 text-xs bg-blue-50 p-2 rounded-md">
                <span className="font-medium">Marca:</span> {brand}
              </div>
            )}
            
            <div className="mt-3 flex justify-between items-center">
              <span className="text-xs text-gray-500">
                Actualizado: {formatDate(last_updated)}
              </span>
              <span>
                <span 
                  className={`inline-block px-2 py-1 rounded-full text-[10px] ${
                    status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : status === 'paused'
                      ? 'bg-yellow-100 text-yellow-800'
                      : status === 'closed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {status === 'active' 
                    ? 'Activo' 
                    : status === 'paused'
                    ? 'En Pausa'
                    : status === 'closed'
                    ? 'Finalizada'
                    : status}
                </span>
              </span>
            </div>
          </div>
          
          <div className="border-t mt-auto flex">
            <a 
              href={permalink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center py-2.5 text-sm bg-[#ffe600] hover:bg-[#f1d900] text-black font-medium transition-colors"
            >
              Ver en ML
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
            
            {onRemove && (
              <button 
                onClick={() => onRemove(id)}
                className="flex-1 flex justify-center items-center py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors border-l"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Eliminar
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }