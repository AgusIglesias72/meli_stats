import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';

// Logo de Mercado Libre como componente SVG
const MercadoLibreLogo = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 1000 1000" 
    className="inline-block w-4 h-4 mr-1.5"
    aria-hidden="true"
  >
    <path d="M418.2 386.4c-8.1 0-14.4 4.6-17.6 12.1h35.1c-3.1-7.5-9.5-12.1-17.5-12.1zm-118.7 19.9c-8 0-14.4 4.6-17.5 12.2h35c-3.1-7.6-9.4-12.2-17.5-12.2zm-58.6-19.9c-17.7 0-30.2 13.1-30.2 31.4 0 18.3 12.5 31.4 30.2 31.4 10.9 0 20.6-5.7 25.7-15l-12.6-7.3c-2.6 4.8-7.5 7.8-13.1 7.8-8 0-13.9-6.6-13.9-16.9 0-10.3 5.8-16.9 13.9-16.9 5.6 0 10.5 3 13.1 7.8l12.6-7.3c-5.1-9.4-14.8-15-25.7-15zm312.9 0c-8.5 0-16.2 3.5-21.7 9.8v-7h-15.6v60.1h16v-32.3c0-9.6 5.3-15.6 13.7-15.6 7.8 0 12.5 5.3 12.5 14.4v33.5h16v-37.7c0-16.8-11.1-25.2-20.9-25.2zm-209.3 0c-18.3 0-31.3 13-31.3 31.4 0 18.4 13 31.4 31.3 31.4 18.4 0 31.3-13 31.3-31.4 0-18.4-12.9-31.4-31.3-31.4zm0 47.7c-8.4 0-14.9-7-14.9-16.3 0-9.3 6.5-16.3 14.9-16.3 8.4 0 14.9 7 14.9 16.3 0 9.3-6.5 16.3-14.9 16.3zm118.7-47.7c-18.1 0-31.4 13-31.4 31.4 0 18.4 13.3 31.4 31.4 31.4s31.3-13 31.3-31.4c0-18.4-13.2-31.4-31.3-31.4zm0 47.7c-8.8 0-15.1-7-15.1-16.3 0-9.3 6.3-16.3 15.1-16.3 8.7 0 15 7 15 16.3 0 9.3-6.3 16.3-15 16.3zm-177.3-47.7c-18.4 0-30.8 13.1-30.8 31.4 0 18.3 12.4 31.4 30.8 31.4 13.1 0 24.4-7.5 28.9-18.9h-17.3c-2.1 3.7-6.3 6-11.6 6-7.4 0-13.2-5-14.5-13.4h46.5v-5.1c0-18.3-12.5-31.4-32-31.4zm208.9 0c-9.5 0-17.7 4.9-22.7 12.9v-10.1h-15.7v60.1h16v-32.3c0-9.4 5.3-15.3 13-15.3 1.9 0 3.7.3 5.3.9l5.3-15.4c-.5-.4-1-.8-1.2-.8z" fill="#4a4a4a"/>
    <path d="M583.5 429.4c0-22.4-23.6-21.8-23.6-32.2 0-3.5 3.2-6.3 10.1-6.3 6.2 0 11 1.9 11 1.9l1.7-12.5s-3.7-2.5-13.9-2.5c-11.5 0-23.1 6.6-23.1 22.7 0 8.9 6.3 15.6 14.3 20.4 6.6 3.9 8.9 6.5 8.9 10.3 0 4.1-3.3 7.4-9.4 7.4-7.9 0-15.3-3.3-15.3-3.3l-1.8 12.8s6.9 3.7 18.4 3.7c16.8 0 25.7-10.1 25.7-22.4z" fill="#2d3277"/>
    <path d="M672 379.4c-8.2 0-14.7 3.9-14.7 3.9v-33h-16v89.6h16v-45.3c0-5.3 3.8-10.7 11.5-10.7 8.2 0 13.5 5.3 13.5 16.2v39.8h16v-42.8c-.1-17.8-10.6-17.7-26.3-17.7z" fill="#009ee3"/>
    <path d="M737.3 386.3c-2.1-.4-4.1-.6-6.2-.6-8.3 0-13.9 6.3-13.9 6.3v-6.3h-15.8v60.1h16v-36.9c0-8.9 6.3-14.7 15.2-14.7 1.9 0 3.6.3 4.7.5l2-8.4h-2z" fill="#0864ee"/>
  </svg>
);

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
            <MercadoLibreLogo />
            Ver en ML
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