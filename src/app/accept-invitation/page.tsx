'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Check } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function AcceptInvitationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitationDetails, setInvitationDetails] = useState<{
    email: string;
    role: string;
    storeName: string;
    expiresAt: string;
  } | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Obtener el token de la URL al cargar la página
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (!token) {
      setError('Token de invitación no proporcionado');
      setVerifying(false);
      setLoading(false);
      return;
    }
    
    verifyInvitation(token);
  }, []);
  
  const verifyInvitation = async (token: string) => {
    try {
      const response = await fetch('/api/team/verify-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al verificar la invitación');
      }
      
      setInvitationDetails(data.invitation);
    } catch (err: any) {
      setError(err.message || 'No se pudo verificar la invitación');
    } finally {
      setVerifying(false);
      setLoading(false);
    }
  };
  
  const acceptInvitation = async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (!token) {
      setError('Token de invitación no proporcionado');
      return;
    }
    
    try {
      setAccepting(true);
      setError(null);
      
      const response = await fetch('/api/team/accept-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al aceptar la invitación');
      }
      
      setSuccess(true);
      
      // Redirigir al dashboard después de un momento
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
      
    } catch (err: any) {
      setError(err.message || 'No se pudo aceptar la invitación');
    } finally {
      setAccepting(false);
    }
  };
  
  const renderRoleText = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'editor':
        return 'Editor';
      case 'viewer':
        return 'Visualizador';
      default:
        return role.charAt(0).toUpperCase() + role.slice(1);
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      <Header />
      
      <main className="flex-grow flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-md">
          <CardContent className="p-6">
            <h1 className="text-2xl font-bold mb-6 text-center">Invitación al Equipo</h1>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-uicore-green mb-4" />
                <p className="text-gray-500">
                  {verifying ? 'Verificando invitación...' : 'Procesando...'}
                </p>
              </div>
            ) : error ? (
              <div className="space-y-6">
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-start">
                  <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Error de invitación</p>
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-3">
                  <Button asChild className="w-full bg-uicore-green hover:bg-uicore-green/90 text-white">
                    <Link href="/dashboard">
                      Volver al Dashboard
                    </Link>
                  </Button>
                </div>
              </div>
            ) : success ? (
              <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md flex items-start">
                  <Check className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">¡Invitación aceptada!</p>
                    <p className="text-sm">Has sido agregado al equipo correctamente. Serás redirigido al dashboard en unos segundos.</p>
                  </div>
                </div>
              </div>
            ) : invitationDetails ? (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-md flex flex-col">
                  <p className="font-medium text-lg mb-3">Has sido invitado a unirte a un equipo</p>
                  
                  <div className="space-y-2">
                    <div className="flex items-start">
                      <span className="font-medium w-32">Tienda:</span>
                      <span>{invitationDetails.storeName}</span>
                    </div>
                    
                    <div className="flex items-start">
                      <span className="font-medium w-32">Rol:</span>
                      <div>
                        <span className={`
                          inline-block px-2 py-0.5 rounded-full text-xs mr-2
                          ${invitationDetails.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                            invitationDetails.role === 'editor' ? 'bg-green-100 text-green-800' : 
                            'bg-gray-100 text-gray-800'}
                        `}>
                          {renderRoleText(invitationDetails.role)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <span className="font-medium w-32">Email:</span>
                      <span>{invitationDetails.email}</span>
                    </div>
                    
                    <div className="flex items-start">
                      <span className="font-medium w-32">Expira:</span>
                      <span>{new Date(invitationDetails.expiresAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4">
                  <p className="text-sm text-gray-500 mb-6">
                    Al aceptar esta invitación, tendrás acceso a la tienda según el rol asignado. Puedes colaborar con el equipo según los permisos de tu rol.
                  </p>
                </div>
                
                <div className="flex flex-col space-y-3">
                  <Button
                    onClick={acceptInvitation}
                    disabled={accepting}
                    className="w-full bg-uicore-green hover:bg-uicore-green/90 text-white"
                  >
                    {accepting ? (
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
      
      <Footer />
    </div>
  );
}