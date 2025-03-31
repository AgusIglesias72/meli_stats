'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, LineChart } from 'lucide-react';

export default function AdminAnalyticsPage() {
  return (
    <div className="px-4 lg:px-6">
      <h1 className="text-2xl font-bold mb-6">Estadísticas</h1>
      
      <Card className="w-full">
        <CardContent className="pt-6 flex flex-col items-center justify-center text-center p-12">
          <div className="flex gap-4 text-primary opacity-70 mb-6 text-gray-700">
            <BarChart className="h-16 w-16" />
            <LineChart className="h-16 w-16" />
          </div>
          
          <h2 className="text-xl font-semibold mb-3">Funcionalidad en desarrollo</h2>
          {/*
          <p className="text-muted-foreground max-w-lg mb-6">
            Estamos trabajando para brindarte estadísticas detalladas sobre tus productos.
            Pronto podrás acceder a reportes, gráficos y análisis completos de tu tienda.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-md text-sm w-full max-w-xl">
            <p className="font-medium">Funcionalidades en desarrollo:</p>
            <ul className="list-disc list-inside mt-2 text-left space-y-1">
              <li>Tendencias de ventas por producto y categoría</li>
              <li>Comparativa con la competencia</li>
              <li>Análisis de precios históricos</li>
              <li>Gráficos de rendimiento por período</li>
              <li>Reportes exportables a PDF y Excel</li>
              <li>Integración con Google Analytics</li>
            </ul>
          </div>
          */}

          </CardContent>
      </Card>
    </div>
  );
}