'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Check, X } from 'lucide-react';

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitationDetails, setInvitationDetails] = useState<{
    email: string;
    role: string;
    storeName: string;
    expiresAt: string;
  } | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Verificar y cargar detalles de la invitación
  useEffect(() => {
    if (!token) {
      setError('Token de invitación no proporcionado');
      setLoading(false);
      return;
    }
    
    async function verifyInvitation() {
      try {
        const response = await fetch('/api/team/verify-invitation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token })
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Error al verificar la invitación');
        }
        
        const data = await response.json();
        setInvitationDetails(data.invitation);
      } catch (err: any) {
        setError(err.message || 'No se pudo verificar la invitación');
      } finally {
        setLoading(false);
      }
    }
    
    verifyInvitation();
  }, [token]);
  
  const handleAcceptInvitation = async () => {
    if (!token) return;
    
    try {
      setProcessing(true);
      setError(null);
      
      const response = await fetch('/api/team/accept-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al aceptar la invitación');
      }
      
      setSuccess(true);
      
      // Redirigir al dashboard después de 3 segundos
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
      
    } catch (err: any) {
      setError(err.message || 'No se pudo aceptar la invitación');
    } finally {
      setProcessing(false);
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      <header className="bg-white shadow-sm py-4">
        <div className="container mx-auto px-4">
          <div className="flex justify-center">
            <Image
              src="https://ext.same-assets.com/2574080482/1493611341.svg+xml"
              alt="MeliStats"
              width={120}
              height={30}
              className="h-8 w-auto"
            />
          </div>
        </div>
      </header>
      
      <main className="flex-grow flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <h1 className="text-2xl font-bold mb-6 text-center">Invitación al Equipo</h1>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-uicore-green mb-4" />
                <p className="text-gray-500">Verificando invitación...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6 flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Error al procesar la invitación</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            ) : success ? (
              <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md mb-6 flex items-start">
                <Check className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">¡Invitación aceptada!</p>
                  <p className="text-sm">Has sido agregado al equipo correctamente. Serás redirigido al dashboard en unos segundos.</p>
                </div>
              </div>
            ) : invitationDetails ? (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-md flex items-start">
                  <div>
                    <p className="font-medium">Has sido invitado a unirte a un equipo</p>
                    <p className="text-sm mt-1">
                      <span className="font-medium">Tienda:</span> {invitationDetails.storeName}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Rol:</span> {invitationDetails.role}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Email:</span> {invitationDetails.email}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Expira:</span> {new Date(invitationDetails.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-3">
                  <Button
                    onClick={handleAcceptInvitation}
                    disabled={processing}
                    className="w-full bg-uicore-green hover:bg-uicore-green/90 text-white"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      "Aceptar Invitación"
                    )}
                  </Button>
                  
                  <Button asChild variant="outline">
                    <Link href="/dashboard">
                      Cancelar
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No se encontró información de la invitación.
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      <footer className="bg-white py-4 border-t border-zinc-200">
        <div className="container mx-auto px-4 text-center text-sm text-zinc-500">
          © {new Date().getFullYear()} MeliStats. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}