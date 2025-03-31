'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertCircle, Save, Loader2 } from 'lucide-react';
import Toast from '@/components/ui/toast';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    user_id: string;
    email: string;
    nickname: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storeInfo, setStoreInfo] = useState<{
    id: string;
    name: string;
    store_id: string;
  } | null>(null);
  const [storeName, setStoreName] = useState('');
  
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'success'
  });
  
  // Cargar información del usuario y la tienda al iniciar
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Cargar información del usuario
        const userResponse = await fetch('/api/user/info');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUserInfo(userData);
        }
        
        // Cargar información de la tienda
        const storeResponse = await fetch('/api/stores/current');
        if (storeResponse.ok) {
          const storeData = await storeResponse.json();
          setStoreInfo(storeData.store);
          if (storeData.store) {
            setStoreName(storeData.store.name || '');
          }
        }
        
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  const updateStoreName = async () => {
    if (!storeInfo) return;
    
    try {
      setSaving(true);
      
      const response = await fetch(`/api/stores/${storeInfo.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: storeName
        }),
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar el nombre de la tienda');
      }
      
      // Actualizar el estado local
      setStoreInfo(prev => prev ? { ...prev, name: storeName } : null);
      
      // Mostrar mensaje de éxito
      setToast({
        visible: true,
        message: 'Nombre de la tienda actualizado correctamente',
        type: 'success'
      });
      
    } catch (err: any) {
      console.error('Error updating store name:', err);
      setError(err.message || 'Error al actualizar el nombre de la tienda');
      
      // Mostrar mensaje de error
      setToast({
        visible: true,
        message: 'Error al actualizar el nombre de la tienda',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };
  
  const logout = async () => {
    if (!confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      return;
    }
    
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      
      if (response.ok) {
        // Redirigir a la página de inicio
        window.location.href = '/';
      } else {
        throw new Error('Error al cerrar sesión');
      }
    } catch (err: any) {
      console.error('Error logging out:', err);
      setError(err.message || 'Error al cerrar sesión');
    }
  };

  return (
    <div className="px-4 lg:px-6">
      <h1 className="text-2xl font-bold mb-6">Configuración</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6 flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
      
      <Tabs defaultValue="account" className="w-full">
        <TabsList className="w-full mb-6">
          <TabsTrigger className="flex-1" value="account">Cuenta</TabsTrigger>
          <TabsTrigger className="flex-1" value="store">Tienda</TabsTrigger>
          <TabsTrigger className="flex-1" value="notifications">Notificaciones</TabsTrigger>
          <TabsTrigger className="flex-1" value="security">Seguridad</TabsTrigger>
        </TabsList>
        
        <TabsContent value="account">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Información de la Cuenta</CardTitle>
                <CardDescription>
                  Información básica de tu cuenta de Mercado Libre conectada.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : userInfo ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="user_id">ID de Usuario</Label>
                        <Input id="user_id" value={userInfo.user_id} readOnly />
                      </div>
                      
                      <div>
                        <Label htmlFor="nickname">Nickname</Label>
                        <Input id="nickname" value={userInfo.nickname || ''} readOnly />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={userInfo.email || ''} readOnly />
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <Button variant="destructive" onClick={logout}>
                      Cerrar Sesión
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    No se encontró información de la cuenta.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="store">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de la Tienda</CardTitle>
                <CardDescription>
                  Administra la configuración de tu tienda actual.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : storeInfo ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="store_id">ID de Tienda</Label>
                      <Input id="store_id" value={storeInfo.store_id} readOnly />
                    </div>
                    
                    <div>
                      <Label htmlFor="store_name">Nombre de la Tienda</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="store_name" 
                          value={storeName} 
                          onChange={(e) => setStoreName(e.target.value)}
                        />
                        <Button 
                          onClick={updateStoreName}
                          disabled={saving || !storeName}
                          className="whitespace-nowrap"
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Guardar
                        </Button>
                      </div>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-md flex items-start">
                      <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Zona de peligro</p>
                        <p className="text-sm mt-1">
                          Las siguientes acciones son irreversibles y pueden afectar a todos los usuarios de la tienda.
                        </p>
                      </div>
                    </div>
                    
                    <Button 
                      variant="destructive"
                      onClick={() => {
                        alert('Esta funcionalidad será implementada próximamente');
                      }}
                    >
                      Desvincular Tienda
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    No hay ninguna tienda seleccionada actualmente.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Preferencias de Notificaciones</CardTitle>
              <CardDescription>
                Configura cómo y cuándo quieres recibir notificaciones.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 text-muted-foreground">
                Esta funcionalidad será implementada próximamente.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Seguridad</CardTitle>
              <CardDescription>
                Administra la seguridad de tu cuenta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 text-muted-foreground">
                Esta funcionalidad será implementada próximamente.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
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