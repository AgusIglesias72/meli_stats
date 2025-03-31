'use client';

import React, { useEffect, useState } from 'react';
import SheetsIntegrationTab from '@/components/dashboard/SheetsIntegrationTab';
import { Loader2 } from 'lucide-react';

export default function AdminIntegrationsPage() {
  const [storeInfo, setStoreInfo] = useState<{
    id: string;
    name: string;
    store_id: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Load current store info when component mounts
  useEffect(() => {
    async function fetchStoreInfo() {
      try {
        setLoading(true);
        const response = await fetch('/api/stores/current');
        if (response.ok) {
          const data = await response.json();
          setStoreInfo(data.store || null);
        }
      } catch (error) {
        console.error('Error fetching store info:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchStoreInfo();
  }, []);

  return (
    <div className="px-4 lg:px-6">
      <h1 className="text-2xl font-bold mb-6">Integraciones</h1>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : storeInfo ? (
        <SheetsIntegrationTab storeId={storeInfo.store_id} />
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-md">
          <p>No se ha detectado una tienda conectada. Por favor, conecta una tienda para configurar integraciones.</p>
        </div>
      )}
    </div>
  );
}