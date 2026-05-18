import React, { createContext, useContext } from 'react';

interface ToastContextType {
  success: (title: string, message: string) => void;
  error: (title: string, message: string) => void;
  info: (title: string, message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const success = (title: string, message: string) => console.log(`[SUCCESS] ${title}: ${message}`);
  const error = (title: string, message: string) => console.error(`[ERROR] ${title}: ${message}`);
  const info = (title: string, message: string) => console.info(`[INFO] ${title}: ${message}`);

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback para não quebrar se o provider não estiver presente
    return {
      success: (title: string, message: string) => console.log(`[SUCCESS] ${title}: ${message}`),
      error: (title: string, message: string) => console.error(`[ERROR] ${title}: ${message}`),
      info: (title: string, message: string) => console.info(`[INFO] ${title}: ${message}`),
    };
  }
  return context;
};
