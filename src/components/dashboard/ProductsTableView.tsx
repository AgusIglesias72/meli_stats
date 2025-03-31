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
import { ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from 'next/link';

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

interface ProductsTableViewProps {
  items: Item[];
  formatCurrency: (amount: number, currency: string) => string;
  formatDate: (dateString: string) => string;
}

export default function ProductsTableView({ 
  items, 
  formatCurrency, 
  formatDate 
}: ProductsTableViewProps) {
  return (
    <div className="w-full overflow-auto border rounded-lg">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[50px]">Imagen</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Actualizado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="w-10 h-10 shrink-0 bg-gray-50 rounded-md flex items-center justify-center overflow-hidden">
                  {item.thumbnail ? (
                    <img 
                      src={item.thumbnail} 
                      alt={item.title}
                      className="w-full h-full object-contain" 
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <span className="text-xs text-gray-400">Sin imagen</span>
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-medium max-w-[250px] truncate">
                {item.title}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {item.item_id}
              </TableCell>
              <TableCell>
                <div className="font-medium">
                  {formatCurrency(item.amount || item.price, item.currency_id)}
                </div>
                {item.regular_amount && item.regular_amount !== (item.amount || item.price) && (
                  <div className="text-xs line-through text-gray-500">
                    {formatCurrency(item.regular_amount, item.currency_id)}
                  </div>
                )}
              </TableCell>
              <TableCell>
                {item.available_quantity}
              </TableCell>
              <TableCell>
                <Badge 
                  variant="outline"
                  className={`
                    ${item.status === 'active' 
                      ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                      : item.status === 'paused'
                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      : item.status === 'closed'
                      ? 'bg-red-100 text-red-800 hover:bg-red-200'
                      : 'bg-gray-100 text-gray-800'
                    }`}
                >
                  {item.status === 'active' 
                    ? 'Activo' 
                    : item.status === 'paused'
                    ? 'En Pausa'
                    : item.status === 'closed'
                    ? 'Finalizada'
                    : item.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(item.last_updated)}
              </TableCell>
              <TableCell className="text-right">
                <Button 
                  asChild
                  variant="ghost" 
                  size="sm"
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                >
                  <a href={item.permalink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    <span className="sr-only">Ver en ML</span>
                  </a>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}