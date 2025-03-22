'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Mail, UserPlus, Trash2, Check, X, AlertCircle, Copy } from 'lucide-react';
import Toast from '@/components/ui/toast';

interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

interface StoreInfo {
  id: string;
  name: string;
  store_id: string;
}

export default function TeamManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'success'
  });

  // Obtener el ID de la tienda seleccionada y cargar datos
  useEffect(() => {
    const getStoreId = async () => {
      try {
        // Este endpoint debería devolver la tienda seleccionada actualmente
        const response = await fetch('/api/stores/current');
        if (!response.ok) {
          throw new Error('No se pudo obtener la tienda actual');
        }
        
        const data = await response.json();
        setStoreInfo(data.store);
        setCurrentUserRole(data.role);

        // Cargar miembros e invitaciones
        if (data.store?.id) {
          await loadTeamData(data.store.id);
        }
      } catch (err: any) {
        setError(err.message || 'Error al cargar la información de la tienda');
        setLoading(false);
      }
    };

    getStoreId();
  }, []);
  
  const loadTeamData = async (storeId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Cargar miembros del equipo
      const membersResponse = await fetch(`/api/team/members?store_id=${storeId}`);
      
      if (!membersResponse.ok) {
        throw new Error('Error al cargar los miembros del equipo');
      }
      
      const membersData = await membersResponse.json();
      setMembers(membersData.members || []);
      
      // Cargar invitaciones pendientes
      const invitationsResponse = await fetch(`/api/team/invitations?store_id=${storeId}`);
      
      if (!invitationsResponse.ok) {
        throw new Error('Error al cargar las invitaciones pendientes');
      }
      
      const invitationsData = await invitationsResponse.json();
      setInvitations(invitationsData.invitations || []);
      
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al cargar los datos del equipo');
      console.error('Error loading team data:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const sendInvitation = async () => {
    if (!storeInfo?.id) {
      showToast('error', 'No hay tienda seleccionada');
      return;
    }
    
    if (!inviteEmail || !inviteEmail.includes('@')) {
      showToast('error', 'Por favor ingresa un email válido');
      return;
    }
    
    try {
      setSending(true);
      setError(null);
      setInvitationLink(null);
      
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          store_id: storeInfo.id,
          email: inviteEmail.trim(),
          role: inviteRole
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al enviar la invitación');
      }
      
      const data = await response.json();
      
      // Mostrar enlace de invitación (en entorno de producción esto sería enviado por email)
      if (data.invitation?.invitation_link) {
        setInvitationLink(data.invitation.invitation_link);
      }
      
      // Limpiar el formulario y recargar los datos
      setInviteEmail('');
      showToast('success', 'Invitación enviada correctamente');
      await loadTeamData(storeInfo.id);
      
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al enviar la invitación');
      console.error('Error sending invitation:', err);
    } finally {
      setSending(false);
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
      
      showToast('success', 'Invitación cancelada');
      
      if (storeInfo?.id) {
        await loadTeamData(storeInfo.id);
      }
      
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al cancelar la invitación');
      console.error('Error canceling invitation:', err);
    }
  };
  
  const removeMember = async (memberId: string) => {
    if (!confirm('¿Estás seguro de eliminar a este miembro del equipo?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/team/members/${memberId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Error al eliminar al miembro del equipo');
      }
      
      showToast('success', 'Miembro eliminado del equipo');
      
      if (storeInfo?.id) {
        await loadTeamData(storeInfo.id);
      }
      
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al eliminar al miembro del equipo');
      console.error('Error removing team member:', err);
    }
  };
  
  const updateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/team/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: newRole
        }),
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar el rol del miembro');
      }
      
      showToast('success', 'Rol actualizado correctamente');
      
      if (storeInfo?.id) {
        await loadTeamData(storeInfo.id);
      }
      
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al actualizar el rol');
      console.error('Error updating member role:', err);
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
      
      const data = await response.json();
      
      if (data.invitation_link) {
        setInvitationLink(data.invitation_link);
      }
      
      showToast('success', 'Invitación reenviada correctamente');
      
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al reenviar la invitación');
      console.error('Error resending invitation:', err);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        showToast('success', 'Enlace copiado al portapapeles');
      })
      .catch(() => {
        showToast('error', 'No se pudo copiar al portapapeles');
      });
  };
  
  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({
      visible: true,
      message,
      type
    });
  };
  
  // Verificar si el usuario actual puede realizar acciones
  const canManageTeam = ['owner', 'admin'].includes(currentUserRole);
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow bg-zinc-50 py-8">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Gestión de Equipo</h1>
              {storeInfo && (
                <p className="text-gray-500">Tienda: {storeInfo.name}</p>
              )}
            </div>
            <Button 
              variant="outline" 
              onClick={() => router.push('/dashboard')}
            >
              Volver al Dashboard
            </Button>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6 flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
          
          {invitationLink && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-md mb-6">
              <div className="flex justify-between items-center">
                <div className="flex-grow">
                  <p className="font-medium mb-1">Enlace de invitación:</p>
                  <p className="text-sm truncate">{invitationLink}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(invitationLink)}
                  className="ml-2 flex-shrink-0"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar
                </Button>
              </div>
              <p className="text-xs mt-2">
                Nota: En un entorno de producción, este enlace sería enviado automáticamente por correo electrónico.
              </p>
            </div>
          )}
          
          <Card className="shadow-sm mb-8">
            <CardContent className="p-0">
              <Tabs defaultValue="members" className="w-full">
                <TabsList className="w-full rounded-t-lg rounded-b-none bg-gray-50 border-b">
                  <TabsTrigger className="flex-1" value="members">Miembros</TabsTrigger>
                  <TabsTrigger className="flex-1" value="invitations">Invitaciones</TabsTrigger>
                  {canManageTeam && <TabsTrigger className="flex-1" value="invite">Invitar</TabsTrigger>}
                </TabsList>
                
                <div className="p-6">
                  <TabsContent value="members">
                    <h3 className="text-lg font-medium mb-4">Miembros del Equipo</h3>
                    
                    {loading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-uicore-green" />
                      </div>
                    ) : members.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No hay miembros en el equipo aún.
                      </div>
                    ) : (
                      <div className="overflow-hidden border rounded-lg">
                        <table className="min-w-full divide-y">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Usuario
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Rol
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Fecha de unión
                              </th>
                              {canManageTeam && (
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Acciones
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {members.map(member => (
                              <tr key={member.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="font-medium">{member.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <span className={`
                                      inline-block w-2 h-2 rounded-full mr-2
                                      ${member.role === 'owner' ? 'bg-purple-500' :
                                        member.role === 'admin' ? 'bg-blue-500' :
                                        member.role === 'editor' ? 'bg-green-500' : 'bg-gray-500'}
                                    `}></span>
                                    <span>
                                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(member.created_at).toLocaleDateString()}
                                </td>
                                {canManageTeam && (
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    {member.role !== 'owner' && (
                                      <div className="flex items-center justify-end space-x-2">
                                        <select
                                          value={member.role}
                                          onChange={(e) => updateMemberRole(member.id, e.target.value)}
                                          className="text-sm border rounded px-2 py-1"
                                          disabled={!canManageTeam}
                                        >
                                          <option value="admin">Admin</option>
                                          <option value="editor">Editor</option>
                                          <option value="viewer">Viewer</option>
                                        </select>
                                        
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          onClick={() => removeMember(member.id)}
                                          className="text-red-500 hover:text-red-700"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="invitations">
                    <h3 className="text-lg font-medium mb-4">Invitaciones Pendientes</h3>
                    
                    {loading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-uicore-green" />
                      </div>
                    ) : invitations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No hay invitaciones pendientes.
                      </div>
                    ) : (
                      <div className="overflow-hidden border rounded-lg">
                        <table className="min-w-full divide-y">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Email
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Rol
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Fecha de expiración
                              </th>
                              {canManageTeam && (
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Acciones
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {invitations.map(invitation => (
                              <tr key={invitation.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="font-medium">{invitation.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`
                                    inline-block px-2 py-0.5 rounded-full text-xs
                                    ${invitation.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                                      invitation.role === 'editor' ? 'bg-green-100 text-green-800' : 
                                      'bg-gray-100 text-gray-800'}
                                  `}>
                                    {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(invitation.expires_at).toLocaleDateString()}
                                </td>
                                {canManageTeam && (
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => resendInvitation(invitation.id)}
                                        className="text-blue-500 hover:text-blue-700"
                                      >
                                        <Mail className="h-4 w-4" />
                                      </Button>
                                      
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => cancelInvitation(invitation.id)}
                                        className="text-red-500 hover:text-red-700"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TabsContent>
                  
                  {canManageTeam && (
                    <TabsContent value="invite">
                      <h3 className="text-lg font-medium mb-4">Invitar a un Nuevo Miembro</h3>
                      
                      <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-md mb-6">
                        <p className="text-sm">
                          <strong>Nota:</strong> La persona invitada recibirá un enlace para unirse a tu tienda. 
                          Necesitará crear una cuenta si aún no tiene una.
                        </p>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700 mb-1">
                            Email del nuevo miembro
                          </label>
                          <Input
                            id="inviteEmail"
                            type="email"
                            placeholder="correo@ejemplo.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="inviteRole" className="block text-sm font-medium text-gray-700 mb-1">
                            Rol del nuevo miembro
                          </label>
                          <select
                            id="inviteRole"
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                          >
                            <option value="admin">Admin - Control total excepto eliminar la tienda</option>
                            <option value="editor">Editor - Puede gestionar productos y precios</option>
                            <option value="viewer">Viewer - Solo puede ver datos</option>
                          </select>
                        </div>
                        
                        <Button 
                          onClick={sendInvitation} 
                          disabled={sending || !inviteEmail}
                          className="w-full bg-uicore-green hover:bg-uicore-green/90 text-white"
                        >
                          {sending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <UserPlus className="h-4 w-4 mr-2" />
                          )}
                          Enviar Invitación
                        </Button>
                      </div>
                    </TabsContent>
                  )}
                </div>
              </Tabs>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium mb-4">Sobre los Roles de Equipo</h3>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="bg-purple-100 p-2 rounded-full mr-4">
                    <span className="inline-block w-2 h-2 rounded-full bg-purple-500"></span>
                  </div>
                  <div>
                    <h4 className="font-medium">Propietario (Owner)</h4>
                    <p className="text-sm text-gray-600">Control total sobre la tienda. Puede gestionar miembros, configuraciones y eliminar la tienda.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-blue-100 p-2 rounded-full mr-4">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                  </div>
                  <div>
                    <h4 className="font-medium">Administrador (Admin)</h4>
                    <p className="text-sm text-gray-600">Puede gestionar productos, precios, invitar a nuevos miembros y cambiar roles, pero no puede eliminar la tienda.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-green-100 p-2 rounded-full mr-4">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                  </div>
                  <div>
                    <h4 className="font-medium">Editor</h4>
                    <p className="text-sm text-gray-600">Puede gestionar productos, actualizar precios y ver estadísticas, pero no puede gestionar miembros del equipo.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-gray-100 p-2 rounded-full mr-4">
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-500"></span>
                  </div>
                  <div>
                    <h4 className="font-medium">Visualizador (Viewer)</h4>
                    <p className="text-sm text-gray-600">Solo puede ver productos, precios y estadísticas, sin capacidad de realizar cambios.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
      
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