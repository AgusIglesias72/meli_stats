import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Upload, Clipboard, AlertCircle, FileText, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import Toast from '@/components/ui/toast';
import Papa from 'papaparse';

interface BulkImportProps {
  onImportComplete: () => Promise<void>;  // Callback to refresh tracked items list
}

export default function BulkImportTab({ onImportComplete }: BulkImportProps) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkIds, setBulkIds] = useState<string>('');
  const [importMethod, setImportMethod] = useState<'paste' | 'file'>('paste');
  const [fileSelected, setFileSelected] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDetailedErrors, setShowDetailedErrors] = useState(false);
  const [importResults, setImportResults] = useState<{
    total: number;
    new: number;
    existing: number;
    successful: number;
    failed: number;
    progress: number;
    inProgress: boolean;
    errors: Array<{ id: string; error: string }>;
  } | null>(null);
  
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'success'
  });
  
  // Función para validar ID de Mercado Libre (formato MLA seguido de números)
  const isValidMercadoLibreId = (id: string): boolean => {
    return typeof id === 'string' && /^ML[A-Z][0-9]+$/.test(id);
  };
  
  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({
      visible: true,
      message,
      type
    });
  };
  
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setFileSelected(false);
      setFileName('');
      return;
    }
    
    setFileSelected(true);
    setFileName(file.name);
    setError(null);
  };
  
  const filterAndResolveIds = (ids: string[], resolve: (value: {all: string[], valid: string[], invalid: string[]}) => void) => {
    const filteredIds = ids.filter(id => id && id.length > 0);
    const validIds = filteredIds.filter(isValidMercadoLibreId);
    const invalidIds = filteredIds.filter(id => !isValidMercadoLibreId(id));
    
    resolve({
      all: filteredIds,
      valid: validIds,
      invalid: invalidIds
    });
  };
  
  const parseAndProcessCSV = (file: File): Promise<{all: string[], valid: string[], invalid: string[]}> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,  // Intentamos con cabecera primero
        skipEmptyLines: true,
        complete: (results) => {
          try {
            let ids: string[] = [];
            
            // Si solo hay una columna sin cabecera, o el parsing falló
            if (results.data.length > 0 && Object.keys(results.data[0] as object).length <= 1) {
              // Intentar sin cabecera
              Papa.parse(file, {
                header: false,
                skipEmptyLines: true,
                complete: (simpleResults) => {
                  ids = simpleResults.data.flatMap((row: any) => {
                    if (Array.isArray(row) && row.length > 0) {
                      return row[0]?.toString().trim() || [];
                    }
                    return [];
                  });
                  
                  filterAndResolveIds(ids, resolve);
                },
                error: (error) => {
                  reject(new Error(`Error parsing CSV: ${error.message}`));
                }
              });
            } else {
              // Con cabecera, buscar en las columnas más probables
              ids = results.data.flatMap((row: any) => {
                // Columnas comunes para IDs
                const possibleIdColumns = [
                  'id', 'ID', 'item_id', 'ITEM_ID', 'codigo', 'CODIGO', 
                  'código', 'CÓDIGO', 'code', 'CODE', 'producto', 'PRODUCTO'
                ];
                
                // Buscar en las columnas posibles
                for (const column of possibleIdColumns) {
                  if (row[column]) {
                    return row[column].toString().trim();
                  }
                }
                
                // Si no encontramos en columnas específicas, usar la primera columna
                const firstColumnName = Object.keys(row as object)[0];
                if (firstColumnName && row[firstColumnName]) {
                  return row[firstColumnName].toString().trim();
                }
                
                return [];
              });
              
              filterAndResolveIds(ids, resolve);
            }
          } catch (error) {
            reject(new Error('Error processing CSV: Invalid format'));
          }
        },
        error: (error) => {
          reject(new Error(`Error parsing CSV: ${error.message}`));
        }
      });
    });
  };
  
  const processPastedIds = (text: string): {all: string[], valid: string[], invalid: string[]} => {
    const lines = text
      .split(/[\n,;\t]+/) // Split by newlines, commas, semicolons, or tabs
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    const validIds = lines.filter(isValidMercadoLibreId);
    const invalidIds = lines.filter(id => !isValidMercadoLibreId(id));
    
    return {
      all: lines,
      valid: validIds,
      invalid: invalidIds
    };
  };
  
  const startBulkImport = async () => {
    setError(null);
    setImportResults(null);
    
    let extractedIds: {all: string[], valid: string[], invalid: string[]} = {all: [], valid: [], invalid: []};
    
    try {
      // Get IDs based on selected method
      if (importMethod === 'paste') {
        if (!bulkIds.trim()) {
          setError('Por favor, ingresa al menos un ID de producto.');
          return;
        }
        extractedIds = processPastedIds(bulkIds);
      } else if (importMethod === 'file') {
        if (!fileInputRef.current?.files?.length) {
          setError('Por favor, selecciona un archivo CSV.');
          return;
        }
        const file = fileInputRef.current.files[0];
        extractedIds = await parseAndProcessCSV(file);
      }
      
      const productIds = extractedIds.valid;
      
      // Validate we have IDs to process
      if (productIds.length === 0) {
        setError(`No se encontraron IDs de productos válidos. ${
          extractedIds.invalid.length > 0 
            ? `Se encontraron ${extractedIds.invalid.length} IDs inválidos.` 
            : 'Verifica el formato de los IDs (ej. MLA123456789).'
        }`);
        return;
      }
      
      if (productIds.length > 5000) {
        setError(`Demasiados IDs (${productIds.length}). El máximo permitido es 5000.`);
        return;
      }
      
      // Show warning if there are invalid IDs
      if (extractedIds.invalid.length > 0) {
        console.warn(`Se encontraron ${extractedIds.invalid.length} IDs inválidos que serán ignorados.`);
      }
      
      // Begin import process
      setImporting(true);
      
      // Initialize results tracking
      const results = {
        total: productIds.length,
        new: 0,
        existing: 0,
        successful: 0,
        failed: 0,
        progress: 0,
        inProgress: true,
        errors: [] as Array<{ id: string; error: string }>
      };
      setImportResults(results);
      
      // Send request to bulk import API endpoint
      const response = await fetch('/api/tracked-items/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          itemIds: productIds 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en la importación masiva');
      }
      
      const responseData = await response.json();
      
      // Update results with API response
      results.new = responseData.results.new || 0;
      results.existing = responseData.results.existing || 0;
      results.successful = responseData.results.successful || 0;
      results.failed = responseData.results.failed || 0;
      results.errors = responseData.results.errors || [];
      results.inProgress = false;
      results.progress = 100;
      
      setImportResults({ ...results });
      
      // Show success message
      if (results.failed === 0 && responseData.results.existing === 0) {
        showToast('success', `¡Importación exitosa! Se han agregado ${results.successful} productos.`);
      } else if (responseData.results.existing > 0) {
        showToast('info', `Importación completada. ${results.successful} productos añadidos. ${responseData.results.existing} ya estaban siendo trackeados.`);
      } else if (results.failed > 0) {
        showToast('info', `Importación completada con ${results.successful} éxitos y ${results.failed} fallos.`);
      }
      
      // Reset form if successful
      if (results.successful > 0) {
        setBulkIds('');
        setFileSelected(false);
        setFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        
        // Refresh the tracked items list
        await onImportComplete();
      }
      
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al procesar los IDs.');
      console.error('Error in bulk import:', err);
      
      // Update results to show failure
      if (importResults) {
        setImportResults({
          ...importResults,
          inProgress: false,
          errors: [{ id: 'general', error: err.message || 'Error desconocido' }]
        });
      }
    } finally {
      setImporting(false);
    }
  };
  
  const cancelImport = () => {
    // This doesn't actually cancel in-progress API calls,
    // but it stops the UI from updating and resets the state
    if (importResults && importResults.inProgress) {
      setImportResults({
        ...importResults,
        inProgress: false
      });
      setImporting(false);
      showToast('info', 'Importación cancelada. Algunos productos pueden haber sido importados.');
    }
  };
  
  // Función para mostrar u ocultar detalles de errores
  const toggleDetailedErrors = () => {
    setShowDetailedErrors(!showDetailedErrors);
  };
  
  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold mb-4">Importación Masiva de Productos</h2>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4 flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          {importResults && (
            <div className={`border rounded-md p-4 mb-4 ${
              importResults.inProgress ? 'bg-blue-50 border-blue-200' :
              importResults.failed === 0 ? 'bg-green-50 border-green-200' :
              'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex justify-between mb-2">
                <h3 className="font-medium">Estado de la importación</h3>
                {importResults.inProgress && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 text-xs"
                    onClick={cancelImport}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
              
              <div className="h-2 w-full bg-gray-200 rounded-full mb-3">
                <div 
                  className={`h-2 rounded-full ${
                    importResults.inProgress ? 'bg-blue-500' :
                    importResults.failed === 0 ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                  style={{ width: `${importResults.progress}%` }}
                ></div>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-center text-sm mb-2">
                <div>
                  <p className="font-medium">Total</p>
                  <p>{importResults.total}</p>
                </div>
                <div className="text-green-700">
                  <p className="font-medium">Exitosos</p>
                  <p>{importResults.successful}</p>
                </div>
                <div className={importResults.failed > 0 ? "text-red-700" : "text-gray-700"}>
                  <p className="font-medium">Fallidos</p>
                  <p>{importResults.failed}</p>
                </div>
                <div className={importResults.existing > 0 ? "text-blue-700" : "text-gray-700"}>
                  <p className="font-medium">Ya Existentes</p>
                  <p>{importResults.existing}</p>
                </div>
              </div>
              
              {!importResults.inProgress && importResults.errors && importResults.errors.length > 0 && (
                <div className="mt-3">
                  <div 
                    className="flex justify-between items-center cursor-pointer bg-gray-100 p-2 rounded-md mb-2"
                    onClick={toggleDetailedErrors}
                  >
                    <p className="text-sm font-medium">Detalles de errores ({importResults.errors.length})</p>
                    {showDetailedErrors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                  
                  {showDetailedErrors && (
                    <div className="max-h-48 overflow-y-auto text-xs bg-white rounded border p-2">
                      {importResults.errors.map((error, index) => (
                        <div key={index} className="mb-1 pb-1 border-b border-gray-100 last:border-0">
                          <span className="font-medium">{error.id}</span>: {error.error}
                        </div>
                      ))}
                      {importResults.errors.length > 50 && (
                        <div className="text-gray-500 italic text-center mt-2">
                          ...y {importResults.failed - 50} más
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {!importResults.inProgress && (
                <div className="mt-3 text-xs text-gray-700">
                  <p>Completado. {importResults.new} nuevos ítems agregados para rastrear.</p>
                  <p className="mt-1">
                    {importResults.failed > 0 ? 
                      `Nota: ${importResults.failed} ítems fallaron. Puedes ver los detalles arriba.` : 
                      ''}
                  </p>
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-4">
            <Tabs defaultValue="paste" onValueChange={(value) => setImportMethod(value as 'paste' | 'file')}>
              <TabsList className="w-full">
                <TabsTrigger value="paste" className="flex-1">
                  <Clipboard className="h-4 w-4 mr-2" />
                  Copiar y Pegar
                </TabsTrigger>
                <TabsTrigger value="file" className="flex-1">
                  <FileText className="h-4 w-4 mr-2" />
                  Archivo CSV
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="paste" className="pt-4 space-y-4">
                <p className="text-sm text-gray-600">
                  Pega tus IDs de productos de Mercado Libre (formato MLA123456789), uno por línea o separados por comas.
                </p>
                <div>
                  <textarea
                    className="w-full h-40 p-3 border rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="MLA123456789&#10;MLA987654321&#10;MLA111222333"
                    value={bulkIds}
                    onChange={(e) => setBulkIds(e.target.value)}
                    disabled={importing}
                  ></textarea>
                </div>
              </TabsContent>
              
              <TabsContent value="file" className="pt-4 space-y-4">
                <p className="text-sm text-gray-600">
                  Sube un archivo CSV con IDs de productos. Puede tener una cabecera y debe tener al menos una columna con los IDs.
                </p>
                <div className="space-y-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={importing}
                  />
                  
                  <div 
                    className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${
                      fileSelected ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onClick={triggerFileInput}
                  >
                    {fileSelected ? (
                      <div className="flex flex-col items-center">
                        <Check className="h-8 w-8 text-green-500 mb-2" />
                        <p className="text-sm font-medium">{fileName}</p>
                        <p className="text-xs text-gray-500 mt-1">Haz clic para cambiar el archivo</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm font-medium">Haz clic para seleccionar archivo</p>
                        <p className="text-xs text-gray-500 mt-1">o arrastra y suelta aquí</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-md">
              <h4 className="text-sm font-medium mb-1">Consejos:</h4>
              <ul className="text-xs list-disc list-inside space-y-1">
                <li>Puedes importar hasta 5,000 productos a la vez.</li>
                <li>Los IDs deben ser del formato MLA123456789 (ML seguido de una letra y números).</li>
                <li>Si usas CSV, la primera columna debe contener los IDs, o usar cabeceras como "id", "item_id", "codigo", etc.</li>
                <li>Los IDs que no tengan el formato correcto serán ignorados automáticamente.</li>
                <li>Los productos ya trackeados serán identificados y no generarán error.</li>
                <li>Si algunos productos fallan, se mostrarán los detalles para que puedas intentarlos individualmente.</li>
              </ul>
            </div>
            
            <Button 
              onClick={startBulkImport} 
              disabled={importing || (importMethod === 'file' && !fileSelected) || (importMethod === 'paste' && !bulkIds.trim())}
              className="w-full bg-uicore-green hover:bg-uicore-green/90 text-white"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                'Comenzar Importación'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Toast 
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
        duration={5000}
      />
    </>
  );
}