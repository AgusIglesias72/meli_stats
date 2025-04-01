'use client';

import React from 'react';
import ImportErrorsComponent from '@/components/dashboard/ImportErrorsComponent';

export default function AdminImportErrorsPage() {
  return (
    <div className="px-4 lg:px-6">
      <h1 className="text-2xl font-bold mb-6">Errores de Importación</h1>
      
      <ImportErrorsComponent />
    </div>
  );
}