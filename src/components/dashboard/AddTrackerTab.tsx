import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search, AlertCircle } from 'lucide-react';
import Toast from '@/components/ui/toast';

interface AddTrackerTabProps {
  trackItemIdInput: string;
  trackItemNotes: string;
  trackingItem: boolean;
  trackedError: string | null;
  setTrackItemIdInput: (value: string) => void;
  setTrackItemNotes: (value: string) => void;
  trackItem: () => Promise<void>;
}

export default function AddTrackerTab({
  trackItemIdInput,
  trackItemNotes,
  trackingItem,
  trackedError,
  setTrackItemIdInput,
  setTrackItemNotes,
  trackItem
}: AddTrackerTabProps) {
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'success'
  });

  const handleTrackItem = async () => {
    try {
      await trackItem();
      
      // Mostrar toast de éxito si no hubo errores
      setToast({
        visible: true,
        message: 'Producto agregado correctamente al tracker',
        type: 'success'
      });
    } catch (error) {
      // El error ya es manejado en el componente principal
      // pero podemos mostrar un toast adicional si queremos
      setToast({
        visible: true,
        message: 'Ocurrió un error al agregar el producto',
        type: 'error'
      });
    }
  };

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold mb-4">Agregar Producto para Trackear</h2>
          
          <p className="text-sm text-gray-500 mb-4">
            Ingresa el ID de un producto de Mercado Libre para comenzar a trackear sus cambios de precio y disponibilidad.
            Puedes encontrar el ID en la URL del producto (ej. MLA1234567890).
          </p>
          
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-md mb-4 flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm">
              Los productos trackeados te permiten monitorear cambios en precio y disponibilidad a lo largo del tiempo. 
              Puedes trackear tanto tus propios productos como productos de la competencia.
            </p>
          </div>
          
          {trackedError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
              {trackedError}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="trackItemId" className="block text-sm font-medium text-gray-700 mb-1">
                ID del producto
              </label>
              <Input
                id="trackItemId"
                type="text"
                placeholder="ID del producto (ej. MLA1234567890)"
                value={trackItemIdInput}
                onChange={(e) => setTrackItemIdInput(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="trackItemNotes" className="block text-sm font-medium text-gray-700 mb-1">
                Notas (opcional)
              </label>
              <Input
                id="trackItemNotes"
                type="text"
                placeholder="Ej: Competidor A, Producto a monitorear, etc."
                value={trackItemNotes}
                onChange={(e) => setTrackItemNotes(e.target.value)}
              />
            </div>
            
            <Button 
              onClick={handleTrackItem} 
              disabled={trackingItem || !trackItemIdInput.trim()}
              className="w-full bg-uicore-green hover:bg-uicore-green/90 text-white"
            >
              {trackingItem ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Comenzar a trackear
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