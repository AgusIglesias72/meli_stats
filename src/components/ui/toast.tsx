import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, visible, onClose, duration = 5000 }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        const exitTimer = setTimeout(() => {
          setIsExiting(false);
          onClose();
        }, 300); // Tiempo de la animación de salida
        
        return () => clearTimeout(exitTimer);
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [visible, onClose, duration]);

  if (!visible) return null;

  return (
    <div 
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white rounded-lg shadow-lg px-4 py-3 max-w-md transition-all duration-300",
        isExiting ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0",
        type === 'success' ? "border-l-4 border-green-500" : 
        type === 'error' ? "border-l-4 border-red-500" : 
        "border-l-4 border-blue-500"
      )}
    >
      {type === 'success' && <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />}
      {type === 'error' && <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
      {type === 'info' && <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />}
      
      <p className="text-sm text-gray-700 flex-1">{message}</p>
      
      <button 
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => {
            setIsExiting(false);
            onClose();
          }, 300);
        }}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}