// Se podría eliminar este archivo, ya que se está usando el componente de la página de invitaciones

// src/components/dashboard/TeamManagementTab.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Mail, UserPlus, Trash2, Check, X } from 'lucide-react';
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

interface TeamManagementTabProps {
  storeId: string;
  currentUserRole: string;
}

export default function TeamManagementTab({ storeId, currentUserRole }: TeamManagementTabProps) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'success'
  });

  // Cargar miembros del equipo e invitaciones al iniciar
  useEffect(() => {
    loadTeamData();
  }, [storeId]);
  
  const loadTeamData = async () => {
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
    if (!inviteEmail || !inviteEmail.includes('@')) {
      showToast('error', 'Por favor ingresa un email válido');
      return;
    }
    
    try {
      setSending(true);
      setError(null);
      
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          store_id: storeId,
          email: inviteEmail.trim(),
          role: inviteRole
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al enviar la invitación');
      }
      
      // Limpiar el formulario y recargar los datos
      setInviteEmail('');
      showToast('success', 'Invitación enviada correctamente');
      await loadTeamData();
      
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
      await loadTeamData();
      
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
      await loadTeamData();
      
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
      await loadTeamData();
      
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
      
      showToast('success', 'Invitación reenviada correctamente');
      
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al reenviar la invitación');
      console.error('Error resending invitation:', err);
    }
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
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Gestión de Equipo</h2>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
          {error}
        </div>
      )}
      
      <Tabs defaultValue="members">
        <TabsList className="mb-4">
          <TabsTrigger value="members">Miembros</TabsTrigger>
          <TabsTrigger value="invitations">Invitaciones</TabsTrigger>
          {canManageTeam && <TabsTrigger value="invite">Invitar</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="members">
          <Card>
            <CardContent className="pt-6">
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
                <div className="space-y-4">
                  {members.map(member => (
                    <div key={member.id} className="border rounded-md p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{member.email}</div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <span className={`
                            inline-block w-2 h-2 rounded-full mr-2
                            ${member.role === 'owner' ? 'bg-purple-500' :
                              member.role === 'admin' ? 'bg-blue-500' :
                              member.role === 'editor' ? 'bg-green-500' : 'bg-gray-500'}
                          `}></span>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </div>
                      </div>
                      
                      {canManageTeam && member.role !== 'owner' && (
                        <div className="flex items-center space-x-2">
                          <select
                            value={member.role}
                            onChange={(e) => updateMemberRole(member.id, e.target.value)}
                            disabled={!canManageTeam}
                            className="text-sm border rounded px-2 py-1"
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="invitations">
          <Card>
            <CardContent className="pt-6">
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
                <div className="space-y-4">
                  {invitations.map(invitation => (
                    <div key={invitation.id} className="border rounded-md p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{invitation.email}</div>
                        <div className="text-sm text-gray-500">
                          <span className={`
                            inline-block px-2 py-0.5 rounded-full text-xs
                            ${invitation.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                              invitation.role === 'editor' ? 'bg-green-100 text-green-800' : 
                              'bg-gray-100 text-gray-800'}
                          `}>
                            {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
                          </span>
                          <span className="ml-2">Expira: {new Date(invitation.expires_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      {canManageTeam && (
                        <div className="flex items-center space-x-2">
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
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {canManageTeam && (
          <TabsContent value="invite">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-medium mb-4">Invitar a un Nuevo Miembro</h3>
                
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
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
      
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