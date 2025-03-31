'use client';

import React, { useState } from 'react';
import BulkImportTab from '@/components/dashboard/BulkImportTracker';

export default function AdminBulkImportPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const handleImportComplete = async () => {
    // Incrementar el trigger para forzar la actualización de componentes dependientes
    setRefreshTrigger(prev => prev + 1);
    return Promise.resolve();
  };

  return (
    <div className="px-4 lg:px-6">
      <h1 className="text-2xl font-bold mb-6">Importación Masiva de Productos</h1>
      
      <BulkImportTab onImportComplete={handleImportComplete} />
    </div>
  );
}