import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Copy, FileSpreadsheet, RefreshCw, Info, Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import Toast from '@/components/ui/toast';

interface SheetsIntegrationTabProps {
  storeId: string;
}

export default function SheetsIntegrationTab({ storeId }: SheetsIntegrationTabProps) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [storeIdMl, setStoreIdMl] = useState<string | null>(null); // ID de tienda de ML
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'success'
  });

  // Base URL para la API
  const baseApiUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}/api/`
    : 'https://yourdomain.com/api/';

  // Cargar la API key al iniciar
  useEffect(() => {
    loadApiKey();
  }, []);
  
  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({
      visible: true,
      message,
      type
    });
  };

  const loadApiKey = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sheets/get-key');
      
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.apiKey || null);
        setStoreIdMl(data.storeId || null);
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = async () => {
    try {
      setGenerating(true);
      const response = await fetch('/api/sheets/generate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.apiKey);
        setStoreIdMl(data.storeId);
        showToast('success', 'API Key generada correctamente');
      } else {
        throw new Error('Error al generar la API Key');
      }
    } catch (error) {
      console.error('Error generating API key:', error);
      showToast('error', 'Ocurrió un error al generar la API Key');
    } finally {
      setGenerating(false);
    }
  };

  const resetApiKey = async () => {
    const confirm = window.confirm('¿Estás seguro de regenerar la API Key? La clave anterior dejará de funcionar.');
    if (!confirm) return;
    
    try {
      setGenerating(true);
      const response = await fetch('/api/sheets/generate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reset: true }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.apiKey);
        showToast('success', 'API Key regenerada correctamente');
      } else {
        throw new Error('Error al regenerar la API Key');
      }
    } catch (error) {
      console.error('Error resetting API key:', error);
      showToast('error', 'Ocurrió un error al regenerar la API Key');
    } finally {
      setGenerating(false);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        showToast('success', 'Copiado al portapapeles');
      })
      .catch(() => {
        showToast('error', 'No se pudo copiar al portapapeles');
      });
  };
  
  const testConnection = async () => {
    try {
      setTestingConnection(true);
      setTestResult(null);
      
      const response = await fetch(`/api/sheets/test`);
      
      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          message: `Conexión exitosa. Se encontraron ${data.items?.length || 0} productos y ${data.tracked_items?.length || 0} items trackeados.`
        });
      } else {
        const errorData = await response.json();
        setTestResult({
          success: false,
          message: errorData.error || 'Error al probar la conexión'
        });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setTestResult({
        success: false,
        message: 'Error al probar la conexión: ' + (error instanceof Error ? error.message : 'Error desconocido')
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const getAppsScriptConfig = () => {
    return `const CONFIG = {
  // URL base de la API (asegúrate de incluir https:// y finalizar con /)
  API_BASE_URL: '${baseApiUrl}',
  
  // Clave API para autenticar las solicitudes
  API_KEY: '${apiKey}',
  
  // ID de la tienda (store_id)
  STORE_ID: '${storeIdMl}',
  
  // Intervalo de sincronización automática en minutos
  SYNC_INTERVAL_MINUTES: 60
};`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Integración con Google Sheets</h2>
        {!loading && apiKey && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={testConnection}
            disabled={testingConnection}
            className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
          >
            {testingConnection ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Probar conexión
          </Button>
        )}
      </div>

      {testResult && (
        <div className={`p-4 rounded-md mb-4 flex items-start ${
          testResult.success 
            ? 'bg-green-50 border border-green-200 text-green-700' 
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {testResult.success 
            ? <Check className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" /> 
            : <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />}
          <p>{testResult.message}</p>
        </div>
      )}

      <Tabs defaultValue="setup">
        <TabsList className="mb-4">
          <TabsTrigger value="setup">Configuración</TabsTrigger>
          <TabsTrigger value="instructions">Instrucciones</TabsTrigger>
        </TabsList>
        
        <TabsContent value="setup">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">API Key para Google Sheets</h3>
              
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-uicore-green" />
                </div>
              ) : apiKey ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tu API Key
                    </label>
                    <div className="flex">
                      <Input
                        type="text"
                        value={apiKey}
                        readOnly
                        className="rounded-r-none"
                      />
                      <Button 
                        className="rounded-l-none" 
                        onClick={() => copyToClipboard(apiKey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Esta clave se usa para autenticar las solicitudes desde Google Sheets a tu cuenta.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ID de tu tienda
                    </label>
                    <div className="flex">
                      <Input
                        type="text"
                        value={storeIdMl || ''}
                        readOnly
                        className="rounded-r-none"
                      />
                      <Button 
                        className="rounded-l-none" 
                        onClick={() => copyToClipboard(storeIdMl || '')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button 
                      variant="outline" 
                      onClick={resetApiKey} 
                      disabled={generating}
                      className="w-full bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100"
                    >
                      {generating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Regenerar API Key
                    </Button>
                    <p className="text-xs text-gray-500 mt-1">
                      ⚠️ Cuidado: Regenerar la API Key invalidará la anterior y cualquier integración con Sheets dejará de funcionar.
                    </p>
                  </div>

                  <div className="pt-4">
                    <h4 className="text-md font-medium mb-2">Configuración para Google Apps Script</h4>
                    <div 
                      className="relative bg-gray-50 p-2 rounded-md cursor-pointer"
                      onClick={() => setShowScript(!showScript)}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Mostrar código de configuración</span>
                        {showScript ? 
                          <ChevronUp className="h-4 w-4" /> : 
                          <ChevronDown className="h-4 w-4" />
                        }
                      </div>
                      
                      {showScript && (
                        <div className="mt-2 relative">
                          <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                            {getAppsScriptConfig()}
                          </pre>
                          <Button 
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(getAppsScriptConfig());
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="mb-4">
                    No tienes una API Key generada para Google Sheets. Genera una para comenzar a sincronizar tus datos con Google Sheets.
                  </p>
                  <Button 
                    onClick={generateApiKey} 
                    disabled={generating}
                    className="w-full bg-uicore-green hover:bg-uicore-green/90 text-white"
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                    )}
                    Generar API Key
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="instructions">
          <Card>
            <CardContent className="pt-6 space-y-6">
              <h3 className="text-lg font-medium">Cómo configurar la integración con Google Sheets</h3>
              
              <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-md mb-4 flex items-start">
                <Info className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  Esta integración te permite sincronizar automáticamente tus productos y productos trackeados con Google Sheets, 
                  facilitando el análisis, reportes y seguimiento de tus datos.
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-md font-medium mb-2">Paso 1: Generar API Key</h4>
                  <p className="text-sm text-gray-600">
                    En la pestaña de "Configuración", genera una API Key. Esta clave es necesaria para autenticar las solicitudes desde Google Sheets.
                  </p>
                </div>
                
                <div>
                  <h4 className="text-md font-medium mb-2">Paso 2: Crear una hoja de cálculo en Google Sheets</h4>
                  <p className="text-sm text-gray-600">
                    Crea una nueva hoja de cálculo en <a href="https://sheets.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Sheets</a>.
                  </p>
                </div>
                
                <div>
                  <h4 className="text-md font-medium mb-2">Paso 3: Configurar Apps Script</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 pl-4">
                    <li>En Google Sheets, ve a <strong>Extensiones &gt; Apps Script</strong></li>
                    <li>Copia y pega el código de Apps Script proporcionado en el archivo de ejemplo</li>
                    <li>Actualiza la configuración con tus datos (API Key, ID de tienda)</li>
                    <li>Guarda el script (ícono de disquete o Ctrl+S)</li>
                    <li>Ejecuta la función <code>setup()</code> para inicializar la hoja</li>
                    <li>Autoriza los permisos solicitados por Google</li>
                  </ol>
                </div>
                
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open('/google-apps-script.js', '_blank')}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Descargar código de ejemplo
                  </Button>
                </div>
                
                <div className="pt-4">
                  <h4 className="text-md font-medium mb-2">Código de Google Apps Script</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Aquí tienes un fragmento del código que debes copiar y pegar en el editor de Apps Script.
                    Asegúrate de reemplazar la sección de configuración con tus datos.
                  </p>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">app.gs</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => copyToClipboard(getAppsScriptConfig())}
                      >
                        Copiar configuración
                      </Button>
                    </div>
                    <div className="text-xs bg-gray-100 p-3 rounded overflow-x-auto max-h-60">
                      <pre>{`/**
 * Mercado Libre Manager - Integración con Google Sheets
 */

// ===== CONFIGURACIÓN =====
${getAppsScriptConfig()}

/**
 * Función de configuración inicial.
 * Ejecutar una sola vez para configurar el libro y los disparadores.
 */
function setup() {
  // Configurar estructura del libro
  setupSpreadsheet();
  
  // Configurar disparador para sincronización automática
  setupTrigger();
  
  // Realizar sincronización inicial
  syncData();
}

// ... (resto del código)
`}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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