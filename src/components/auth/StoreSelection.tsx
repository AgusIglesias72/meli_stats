// src/components/auth/StoreSelection.tsx
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Store, ShoppingBag, Plus } from 'lucide-react';

interface StoreData {
  id: string;
  name: string;
  store_id: string;
  ml_user_id: string;
  role: string;
}

interface StoreSelectionProps {
  stores: StoreData[];
  onSelect: (storeId: string) => Promise<void>;
}

export default function StoreSelection({ stores, onSelect }: StoreSelectionProps) {
  const router = useRouter();
  const [selecting, setSelecting] = React.useState<string | null>(null);
  
  const handleStoreSelect = async (storeId: string) => {
    try {
      setSelecting(storeId);
      await onSelect(storeId);
      router.push('/dashboard');
    } catch (error) {
      console.error('Error selecting store:', error);
      setSelecting(null);
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
            <h1 className="text-2xl font-bold mb-6 text-center">Selecciona una Tienda</h1>
            
            <div className="space-y-4 mb-8">
              {stores.map(store => (
                <div
                  key={store.id}
                  className="border rounded-lg p-4 hover:border-uicore-green cursor-pointer transition-colors"
                  onClick={() => handleStoreSelect(store.id)}
                >
                  <div className="flex items-center">
                    <div className="bg-zinc-100 p-3 rounded-md">
                      <Store className="h-6 w-6 text-uicore-green" />
                    </div>
                    
                    <div className="ml-4 flex-grow">
                      <h3 className="font-medium">{store.name || `Tienda ${store.store_id}`}</h3>
                      <p className="text-sm text-zinc-500">ID: {store.store_id}</p>
                      
                      <div className="mt-1 flex items-center">
                        <span className={`
                          inline-block w-2 h-2 rounded-full mr-2
                          ${store.role === 'owner' ? 'bg-purple-500' :
                            store.role === 'admin' ? 'bg-blue-500' :
                            store.role === 'editor' ? 'bg-green-500' : 'bg-gray-500'}
                        `}></span>
                        <span className="text-xs text-zinc-500">
                          {store.role.charAt(0).toUpperCase() + store.role.slice(1)}
                        </span>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={selecting === store.id}
                      className="text-uicore-green"
                    >
                      {selecting === store.id ? (
                        <span className="h-5 w-5 border-2 border-uicore-green border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <span>Acceder</span>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-center">
              <Button asChild variant="outline" className="w-full">
                <Link href="/connect-store">
                  <Plus className="h-4 w-4 mr-2" />
                  Conectar nueva tienda
                </Link>
              </Button>
              
              <p className="mt-4 text-sm text-zinc-500">
                ¿No ves tu tienda? Conéctala para comenzar a monitorear sus productos.
              </p>
            </div>
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