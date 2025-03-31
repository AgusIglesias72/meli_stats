import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2 } from "lucide-react";
import Link from 'next/link';

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

interface TrackedItemsTableViewProps {
  trackedItems: TrackedItem[];
  formatCurrency: (amount: number, currency: string) => string;
  formatDate: (dateString: string) => string;
  removeTrackedItem: (id: string) => Promise<void>;
}

export default function TrackedItemsTableView({ 
  trackedItems, 
  formatCurrency, 
  formatDate,
  removeTrackedItem
}: TrackedItemsTableViewProps) {
  
  // Función para confirmar antes de eliminar
  const handleDelete = (id: string, title: string) => {
    if (confirm(`¿Estás seguro de eliminar el seguimiento de: ${title}?`)) {
      removeTrackedItem(id);
    }
  };
  
  return (
    <div className="w-full overflow-auto border rounded-lg">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[50px]">Imagen</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Notas</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Actualizado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trackedItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="w-10 h-10 shrink-0 bg-gray-50 rounded-md flex items-center justify-center overflow-hidden">
                  {item.data?.thumbnail ? (
                    <img 
                      src={item.data.thumbnail} 
                      alt={item.data.title || 'Producto'}
                      className="w-full h-full object-contain" 
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <span className="text-xs text-gray-400">Sin imagen</span>
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-medium max-w-[200px] truncate">
                {item.data?.title || 'Datos no disponibles'}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {item.item_id}
              </TableCell>
              <TableCell>
                {item.data ? (
                  <div>
                    <div className="font-medium">
                      {formatCurrency(item.data.amount || item.data.price, item.data.currency_id)}
                    </div>
                    {item.data.regular_amount && item.data.regular_amount !== (item.data.amount || item.data.price) && (
                      <div className="text-xs line-through text-gray-500">
                        {formatCurrency(item.data.regular_amount, item.data.currency_id)}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">No disponible</span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {item.data?.seller_nickname || item.seller_nickname || '-'}
              </TableCell>
              <TableCell className="max-w-[150px] truncate">
                {item.notes ? (
                  <span className="text-sm">{item.notes}</span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Sin notas</span>
                )}
              </TableCell>
              <TableCell>
                {item.data ? (
                  <Badge 
                    variant="outline"
                    className={`
                      ${item.data.status === 'active' 
                        ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                        : item.data.status === 'paused'
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : item.data.status === 'closed'
                        ? 'bg-red-100 text-red-800 hover:bg-red-200'
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
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-100 text-gray-800">
                    Desconocido
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {item.data ? formatDate(item.data.last_updated) : formatDate(item.created_at)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button 
                    asChild
                    variant="ghost" 
                    size="sm"
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                  >
                    <a href={item.data?.permalink || '#'} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      <span className="sr-only">Ver en ML</span>
                    </a>
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                    onClick={() => handleDelete(item.id, item.data?.title || item.item_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Eliminar</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}