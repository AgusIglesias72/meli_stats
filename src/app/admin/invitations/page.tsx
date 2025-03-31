'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, Check, X, AlertCircle, RefreshCw } from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  store_name: string;
  store_id: string;
}

export default function AdminInvitationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Cargar invitaciones al iniciar
  useEffect(() => {
    loadInvitations();
  }, []);
  
  const loadInvitations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/team/all-invitations');
      
      if (!response.ok) {
        throw new Error('Error al cargar las invitaciones');
      }
      
      const data = await response.json();
      setInvitations(data.invitations || []);
      
    } catch (err: any) {
      console.error('Error loading invitations:', err);
      setError(err.message || 'Error al cargar las invitaciones');
    } finally {
      setLoading(false);
    }
  };
  
  const cancelInvitation = async (invitationId: string) => {
    if (!confirm('¿Estás seguro de cancelar esta invitación?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/team/invitations/${invitationId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Error al cancelar la invitación');
      }
      
      // Recargar invitaciones
      await loadInvitations();
      
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al cancelar la invitación');
      console.error('Error canceling invitation:', err);
    }
  };
  
  const resendInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/team/invitations/${invitationId}/resend`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Error al reenviar la invitación');
      }
      
      alert('Invitación reenviada correctamente');
      
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al reenviar la invitación');
      console.error('Error resending invitation:', err);
    }
  };

  // Función para formatear la fecha en un formato legible
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="px-4 lg:px-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Invitaciones</h1>
        
        <Button
          variant="outline"
          size="sm"
          onClick={loadInvitations}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6 flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : invitations.length === 0 ? (
        <div className="bg-muted p-8 rounded-lg text-center">
          <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No hay invitaciones pendientes</h3>
          <p className="text-muted-foreground mb-4">Cuando invites a miembros a tus tiendas, las invitaciones aparecerán aquí.</p>
          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href="/admin/team">
              Gestionar equipo
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {invitations.map(invitation => (
            <Card key={invitation.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{invitation.email}</CardTitle>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Tienda</div>
                    <div className="text-sm">{invitation.store_name || invitation.store_id}</div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Rol</div>
                      <span className={`
                        inline-block px-2 py-0.5 rounded-full text-xs
                        ${invitation.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                          invitation.role === 'editor' ? 'bg-green-100 text-green-800' : 
                          'bg-gray-100 text-gray-800'}
                      `}>
                        {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
                      </span>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Estado</div>
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">
                        Pendiente
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Enviada</div>
                    <div className="text-sm">{formatDate(invitation.created_at)}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Expira</div>
                    <div className="text-sm">{formatDate(invitation.expires_at)}</div>
                  </div>
                  
                  <div className="pt-2 flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1"
                      onClick={() => resendInvitation(invitation.id)}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Reenviar
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1 text-destructive hover:text-destructive"
                      onClick={() => cancelInvitation(invitation.id)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}