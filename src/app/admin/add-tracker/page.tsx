'use client';

import React, { useState } from 'react';
import AddTrackerTab from '@/components/dashboard/AddTrackerTab';

export default function AdminAddTrackerPage() {
  const [trackItemIdInput, setTrackItemIdInput] = useState('');
  const [trackItemNotes, setTrackItemNotes] = useState('');
  const [trackingItem, setTrackingItem] = useState(false);
  const [trackedError, setTrackedError] = useState<string | null>(null);

  const trackItem = async () => {
    if (!trackItemIdInput.trim()) {
      setTrackedError('Por favor, introduce un ID de ítem válido');
      return Promise.reject(new Error('ID de ítem vacío'));
    }

    try {
      setTrackingItem(true);
      setTrackedError(null);
      
      const response = await fetch('/api/tracked-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          itemId: trackItemIdInput.trim(),
          notes: trackItemNotes.trim() || null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error tracking item');
      }

      // Limpiamos el formulario
      setTrackItemIdInput('');
      setTrackItemNotes('');
      
      // Retornamos promesa exitosa
      return Promise.resolve();
    } catch (err: any) {
      setTrackedError(err.message || 'Ocurrió un error al agregar el ítem para trackear');
      console.error('Error tracking item:', err);
      return Promise.reject(err);
    } finally {
      setTrackingItem(false);
    }
  };

  return (
    <div className="px-4 lg:px-6">
      <h1 className="text-2xl font-bold mb-6">Agregar Producto para Seguimiento</h1>
      
      <AddTrackerTab 
        trackItemIdInput={trackItemIdInput}
        trackItemNotes={trackItemNotes}
        trackingItem={trackingItem}
        trackedError={trackedError}
        setTrackItemIdInput={setTrackItemIdInput}
        setTrackItemNotes={setTrackItemNotes}
        trackItem={trackItem}
      />
    </div>
  );
}