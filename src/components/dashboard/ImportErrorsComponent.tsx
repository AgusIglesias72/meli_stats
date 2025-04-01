// src/components/dashboard/ImportErrorsComponent.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Info, RefreshCw, CheckCircle, Search, X, Loader2 } from 'lucide-react';
import Toast from '@/components/ui/toast';

interface ImportError {
  id: string;
  item_id: string;
  error_message: string;
  user_id: string;
  created_at: string;
  resolved: boolean;
  resolved_at: string | null;
  notes: string | null;
}

export default function ImportErrorsComponent() {
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'resolved' | 'unresolved'>('unresolved');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState<string>('');
  const [selectedError, setSelectedError] = useState<ImportError | null>(null);
  
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'success'
  });
  
  // Cargar errores al iniciar
  useEffect(() => {
    loadErrors();
  }, [filter]);
  
  // Función para cargar errores desde la API
  const loadErrors = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/import-errors?filter=${filter}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar los errores de importación');
      }
      
      const data = await response.json();
      setErrors(data.errors || []);
      
    } catch (error: any) {
      console.error('Error loading import errors:', error);
      showToast('error', error.message || 'Error al cargar los errores');
    } finally {
      setLoading(false);
    }
  };
  
  // Función para marcar un error como resuelto
  const markAsResolved = async (id: string) => {
    try {
      setUpdatingId(id);
      
      const response = await fetch(`/api/import-errors/${id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: noteInput }),
      });
      
      if (!response.ok) {
        throw new Error('Error al marcar como resuelto');
      }
      
      // Actualizar la lista de errores
      await loadErrors();
      showToast('success', 'Error marcado como resuelto');
      setSelectedError(null);
      setNoteInput('');
      
    } catch (error: any) {
      console.error('Error resolving issue:', error);
      showToast('error', error.message || 'Error al marcar como resuelto');
    } finally {
      setUpdatingId(null);
    }
  };
  
  // Función para reintentar importar un item
  const retryImport = async (itemId: string, errorId: string) => {
    try {
      setUpdatingId(errorId);
      
      const response = await fetch('/api/items/retry-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId, errorId }),
      });
      
      if (!response.ok) {
        throw new Error('Error al reintentar la importación');
      }
      
      // Verificar resultado
      const result = await response.json();
      
      if (result.success) {
        showToast('success', 'Producto importado correctamente');
        
        // Actualizar la lista de errores
        await loadErrors();
      } else {
        throw new Error(result.error || 'No se pudo importar el producto');
      }
      
    } catch (error: any) {
      console.error('Error retrying import:', error);
      showToast('error', error.message || 'Error al reintentar la importación');
    } finally {
      setUpdatingId(null);
    }
  };
  
  // Mostrar toast
  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({
      visible: true,
      message,
      type
    });
  };
  
  // Filtrar errores por búsqueda
  const filteredErrors = errors.filter(error => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      error.item_id.toLowerCase().includes(searchLower) ||
      error.error_message.toLowerCase().includes(searchLower) ||
      (error.notes && error.notes.toLowerCase().includes(searchLower))
    );
  });
  
  // Formatear fecha
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div>
          <h2 className="text-xl font-semibold">Errores de Importación</h2>
          <p className="text-sm text-muted-foreground">
            Gestiona los errores ocurridos durante la importación automática de productos
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadErrors}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="searchErrors" className="sr-only">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="searchErrors"
              type="search"
              placeholder="Buscar por ID o mensaje de error..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-9 w-9"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Limpiar</span>
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="min-w-24"
          >
            Todos
          </Button>
          <Button
            variant={filter === 'unresolved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unresolved')}
            className="min-w-24"
          >
            Pendientes
          </Button>
          <Button
            variant={filter === 'resolved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('resolved')}
            className="min-w-24"
          >
            Resueltos
          </Button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : filteredErrors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Info className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay errores {filter !== 'all' ? (filter === 'resolved' ? 'resueltos' : 'pendientes') : ''}</h3>
            <p className="text-muted-foreground max-w-md">
              {filter === 'all' 
                ? 'No se encontraron errores de importación en el sistema.' 
                : filter === 'resolved' 
                  ? 'No se encontraron errores resueltos que coincidan con tu búsqueda.'
                  : 'No hay errores pendientes. ¡Todo está funcionando correctamente!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              <div className="flex justify-between items-center">
                <span>Lista de Errores</span>
                <Badge variant="outline">
                  {filteredErrors.length} {filteredErrors.length === 1 ? 'error' : 'errores'}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Producto</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredErrors.map(error => (
                    <TableRow key={error.id}>
                      <TableCell className="font-mono text-xs">
                        {error.item_id}
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        <div className="truncate text-sm" title={error.error_message}>
                          {error.error_message}
                        </div>
                        {error.notes && (
                          <div className="text-xs text-muted-foreground mt-1 italic">
                            Nota: {error.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(error.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={error.resolved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                        >
                          {error.resolved ? 'Resuelto' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!error.resolved && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => retryImport(error.item_id, error.id)}
                                disabled={!!updatingId}
                                className="text-green-600 border-green-200 hover:text-green-700 hover:bg-green-50"
                              >
                                {updatingId === error.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4 mr-1" />
                                )}
                                <span className="hidden sm:inline">Reintentar</span>
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedError(error);
                                  setNoteInput(error.notes || '');
                                }}
                                disabled={!!updatingId}
                                className="text-blue-600 border-blue-200 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                <span className="hidden sm:inline">Resolver</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Modal para resolver error */}
      {selectedError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Resolver Error</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                className="absolute top-2 right-2" 
                onClick={() => setSelectedError(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="errorItemId">ID del Producto</Label>
                <Input id="errorItemId" value={selectedError.item_id} readOnly />
              </div>
              
              <div>
                <Label htmlFor="errorMessage">Mensaje de Error</Label>
                <div className="bg-muted p-2 rounded-md text-sm max-h-32 overflow-y-auto">
                  {selectedError.error_message}
                </div>
              </div>
              
              <div>
                <Label htmlFor="errorNotes">Notas de Resolución</Label>
                <Input
                  id="errorNotes"
                  placeholder="Explica cómo se resolvió el problema..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedError(null)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => markAsResolved(selectedError.id)}
                  disabled={updatingId === selectedError.id}
                >
                  {updatingId === selectedError.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Marcar Resuelto
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <Toast 
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
        duration={5000}
      />
    </div>
  );
}