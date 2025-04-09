import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, UploadCloud, Check, AlertTriangle, RefreshCw, X, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';

interface BulkTrackerImportProps {
  onImportComplete?: () => Promise<void>;
}

interface StatusCounts {
  pending: number;
  success: number;
  error: number;
  error_data: number;
  total: number;
}

interface ErrorItem {
  id: string;
  item_id: string;
  processing_status: string;
  processing_message: string | null;
}

const BulkTrackerImport: React.FC<BulkTrackerImportProps> = ({ 
  onImportComplete 
}) => {
  const [inputType, setInputType] = useState<'text' | 'file'>('text');
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [rawInput, setRawInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusPolling, setStatusPolling] = useState<boolean>(false);
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);
  const [failedItems, setFailedItems] = useState<ErrorItem[]>([]);
  const [selectedTab, setSelectedTab] = useState('input');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Efecto para limpiar el intervalo de polling cuando el componente se desmonta
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Efecto para actualizar el estado cuando se inicia/detiene el polling
  useEffect(() => {
    if (statusPolling) {
      pollImportStatus();
      pollingIntervalRef.current = setInterval(pollImportStatus, 5000);
    } else if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [statusPolling]);

  // Función para sondear el estado de la importación
  const pollImportStatus = async () => {
    try {
      const response = await fetch('/api/tracked-items/bulk/status?counts_only=true');
      
      if (!response.ok) {
        throw new Error('Error fetching import status');
      }
      
      const data = await response.json();
      setStatusCounts(data.counts);
      
      // Si no hay items pendientes, obtener los items con error
      if (data.counts.pending === 0 && (data.counts.error > 0 || data.counts.error_data > 0)) {
        fetchFailedItems();
      }
      
      // Si no hay items pendientes, detener el polling
      if (data.counts.pending === 0) {
        setStatusPolling(false);
        
        // Notificar que la importación está completa
        if (onImportComplete) {
          await onImportComplete();
        }
      }
    } catch (err) {
      console.error('Error polling import status:', err);
      setStatusPolling(false);
    }
  };

  // Función para obtener los items que fallaron
  const fetchFailedItems = async () => {
    try {
      const response = await fetch('/api/tracked-items/bulk/status?status=error&limit=100');
      
      if (!response.ok) {
        throw new Error('Error fetching failed items');
      }
      
      const data = await response.json();
      setFailedItems(data.items || []);
    } catch (err) {
      console.error('Error fetching failed items:', err);
    }
  };

  // Función para reintentar los items fallidos
  const retryFailedItems = async (itemIds: string[]) => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/tracked-items/bulk/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemIds }),
      });
      
      if (!response.ok) {
        throw new Error('Error retrying failed items');
      }
      
      // Iniciar polling de nuevo
      setStatusPolling(true);
      
      // Limpiar la lista de fallidos
      setFailedItems([]);
      
      // Actualizar pestaña a status
      setSelectedTab('status');
    } catch (err: any) {
      setError(err.message || 'Error retrying failed items');
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar cambio en el area de texto
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRawInput(e.target.value);
    setError(null);
  };

  // Manejar clic en botón de archivo
  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Manejar cambio de archivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    
    if (!file) {
      return;
    }
    
    setIsLoading(true);
    
    // Verificar el tipo de archivo
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      // Procesar CSV
      Papa.parse(file, {
        complete: (results) => {
          processFileResults(results.data);
          setIsLoading(false);
        },
        error: (error) => {
          setError(`Error parsing CSV: ${error.message}`);
          setIsLoading(false);
        }
      });
    } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      // Procesar TXT
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        setItemIds(lines);
        setRawInput(lines.join('\n'));
        setIsLoading(false);
      };
      reader.onerror = () => {
        setError('Error reading file');
        setIsLoading(false);
      };
      reader.readAsText(file);
    } else {
      setError('Unsupported file type. Please upload a CSV or TXT file.');
      setIsLoading(false);
    }
    
    // Limpiar el input para permitir cargar el mismo archivo nuevamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Procesar resultados del archivo
  const processFileResults = (data: any[]) => {
    const ids: string[] = [];
    
    data.forEach(row => {
      // Si es un array (CSV), tomar el primer valor de cada fila
      if (Array.isArray(row)) {
        const id = row[0]?.toString().trim();
        if (id) ids.push(id);
      } 
      // Si es string (posible línea de texto)
      else if (typeof row === 'string') {
        const id = row.trim();
        if (id) ids.push(id);
      }
    });
    
    setItemIds(ids);
    setRawInput(ids.join('\n'));
  };

  // Procesar entrada de texto
  const processTextInput = () => {
    if (!rawInput.trim()) {
      setError('Please enter at least one item ID');
      return;
    }
    
    // Separar por líneas, comas o espacios y filtrar valores vacíos
    const ids = rawInput
      .split(/[\n,\s]+/)
      .map(id => id.trim())
      .filter(id => id);
    
    if (ids.length === 0) {
      setError('No valid item IDs found');
      return;
    }
    
    setItemIds(ids);
    return ids;
  };

  // Iniciar la importación
  const startImport = async () => {
    try {
      if (inputType === 'text') {
        const ids = processTextInput();
        if (!ids) return;
      }
      
      if (itemIds.length === 0) {
        setError('No valid item IDs found');
        return;
      }
      
      setIsImporting(true);
      setError(null);
      
      const response = await fetch('/api/tracked-items/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemIds }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error importing items');
      }
      
      const result = await response.json();
      setImportResult(result);
      
      // Iniciar polling de estado
      setStatusPolling(true);
      
      // Cambiar a la pestaña de estado
      setSelectedTab('status');
      
    } catch (err: any) {
      setError(err.message || 'Error starting import');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Importación Masiva de Productos</CardTitle>
        <CardDescription>
          Importa múltiples productos para seguimiento utilizando sus IDs.
        </CardDescription>
      </CardHeader>
      
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="mx-6">
          <TabsTrigger value="input">Entrada</TabsTrigger>
          <TabsTrigger value="status">Estado</TabsTrigger>
          {failedItems.length > 0 && (
            <TabsTrigger value="errors">
              Errores ({failedItems.length})
            </TabsTrigger>
          )}
        </TabsList>
        
        <CardContent>
          <TabsContent value="input" className="mt-4">
            <div className="space-y-4">
              <div className="flex space-x-4">
                <Button 
                  variant={inputType === 'text' ? 'default' : 'outline'} 
                  onClick={() => setInputType('text')}
                >
                  Texto
                </Button>
                <Button 
                  variant={inputType === 'file' ? 'default' : 'outline'} 
                  onClick={() => setInputType('file')}
                >
                  Archivo
                </Button>
              </div>
              
              {inputType === 'text' && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Ingresa los IDs de producto, uno por línea o separados por comas.
                  </p>
                  <Textarea 
                    placeholder="MLA1234567&#10;MLA7654321&#10;MLA9876543"
                    rows={10}
                    value={rawInput}
                    onChange={handleTextChange}
                    className="font-mono"
                  />
                </div>
              )}
              
              {inputType === 'file' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed rounded-md p-8 text-center">
                    <UploadCloud className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm mb-2">
                      Arrastra o selecciona un archivo CSV o TXT
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Cada ID debe estar en una línea o columna separada
                    </p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".csv,.txt"
                      className="hidden"
                    />
                    <Button onClick={handleFileButtonClick}>
                      Seleccionar Archivo
                    </Button>
                  </div>
                  
                  {itemIds.length > 0 && (
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm mb-2">
                        {itemIds.length} IDs cargados
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {itemIds.slice(0, 3).join(', ')}
                        {itemIds.length > 3 && ', ...'}
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setRawInput('');
                    setItemIds([]);
                    setError(null);
                  }}
                >
                  Limpiar
                </Button>
                <Button 
                  onClick={startImport} 
                  disabled={isLoading || isImporting || itemIds.length === 0}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    'Importar'
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="status" className="mt-4">
            <div className="space-y-6">
              {statusPolling ? (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertTitle>Procesando</AlertTitle>
                  <AlertDescription>
                    La importación está en progreso. Esta página se actualizará automáticamente.
                  </AlertDescription>
                </Alert>
              ) : statusCounts && statusCounts.total > 0 ? (
                <Alert variant={statusCounts.error > 0 ? "destructive" : "default"}>
                  {statusCounts.error > 0 ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {statusCounts.error > 0 
                      ? 'Importación completada con errores' 
                      : 'Importación completada'}
                  </AlertTitle>
                  <AlertDescription>
                    {statusCounts.success} de {statusCounts.total} productos importados correctamente.
                  </AlertDescription>
                </Alert>
              ) : importResult ? (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertTitle>Iniciando importación</AlertTitle>
                  <AlertDescription>
                    Se están procesando {importResult.results?.new} productos nuevos.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Sin datos</AlertTitle>
                  <AlertDescription>
                    No hay ninguna importación en progreso.
                  </AlertDescription>
                </Alert>
              )}
              
              {statusCounts && statusCounts.total > 0 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progreso</span>
                      <span>{statusCounts.success + statusCounts.error} de {statusCounts.total}</span>
                    </div>
                    <Progress value={(statusCounts.success + statusCounts.error) / statusCounts.total * 100} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded-md border border-green-100">
                      <h3 className="text-sm font-medium mb-1">Éxito</h3>
                      <p className="text-2xl font-bold text-green-600">{statusCounts.success}</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-md border border-amber-100">
                      <h3 className="text-sm font-medium mb-1">Pendientes</h3>
                      <p className="text-2xl font-bold text-amber-600">{statusCounts.pending}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-md border border-red-100">
                      <h3 className="text-sm font-medium mb-1">Errores</h3>
                      <p className="text-2xl font-bold text-red-600">{statusCounts.error + statusCounts.error_data}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                      <h3 className="text-sm font-medium mb-1">Total</h3>
                      <p className="text-2xl font-bold text-blue-600">{statusCounts.total}</p>
                    </div>
                  </div>
                  
                  {statusCounts.error > 0 && statusPolling === false && (
                    <Button
                      variant="outline"
                      onClick={() => setSelectedTab('errors')}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Ver errores
                    </Button>
                  )}
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                {statusPolling ? (
                  <Button 
                    variant="outline" 
                    onClick={() => setStatusPolling(false)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Detener actualización
                  </Button>
                ) : statusCounts && statusCounts.total > 0 && (
                  <Button 
                    variant="outline" 
                    onClick={pollImportStatus}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Actualizar estado
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="errors" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Items con errores ({failedItems.length})</h3>
                <Button 
                  onClick={() => retryFailedItems(failedItems.map(item => item.item_id))}
                  disabled={isLoading || failedItems.length === 0}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Reintentar todos
                </Button>
              </div>
              
              {failedItems.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {failedItems.map(item => (
                    <div key={item.id} className="bg-red-50 p-4 rounded-md border border-red-100">
                      <div className="flex justify-between">
                        <div>
                          <h4 className="font-medium">{item.item_id}</h4>
                          <p className="text-sm text-red-600">
                            {item.processing_message || `Error: ${item.processing_status}`}
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => retryFailedItems([item.item_id])}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  No hay items con errores o no se han cargado todavía.
                </div>
              )}
              
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedTab('status')}
                >
                  Volver a estado
                </Button>
              </div>
            </div>
          </TabsContent>
        </CardContent>
      </Tabs>
      
      <CardFooter className="flex justify-between border-t pt-6">
        <p className="text-sm text-muted-foreground">
          Puedes importar hasta 5,000 productos a la vez.
        </p>
      </CardFooter>
    </Card>
  );
}

export default BulkTrackerImport;