// src/auth/AuthContext.jsx
import React, { createContext, useContext } from 'react';
import {
  AuthProvider as Base44AuthProvider,
  useAuth as useBase44Auth,
} from '@/lib/AuthContext';
import {
  FirebaseAuthProvider,
  useFirebaseAuth,
} from '@/auth/FirebaseAuthContext';

const UnifiedAuthContext = createContext(null);

function Base44AuthBridge({ children }) {
  const base44Auth = useBase44Auth();

  return (
    <UnifiedAuthContext.Provider
      value={{ authProvider: 'base44', ...base44Auth }}
    >
      {children}
    </UnifiedAuthContext.Provider>
  );
}

function FirebaseAuthBridge({ children }) {
  const firebaseAuth = useFirebaseAuth();

  return (
    <UnifiedAuthContext.Provider value={firebaseAuth}>
      {children}
    </UnifiedAuthContext.Provider>
  );
}

export function AuthProvider({ children }) {
  const selectedProvider =
    import.meta.env.VITE_AUTH_PROVIDER?.toLowerCase() || 'base44';

  if (selectedProvider === 'firebase') {
    return (
      <FirebaseAuthProvider>
        <FirebaseAuthBridge>{children}</FirebaseAuthBridge>
      </FirebaseAuthProvider>
    );
  }

  return (
    <Base44AuthProvider>
      <Base44AuthBridge>{children}</Base44AuthBridge>
    </Base44AuthProvider>
  );
}

export function useAuth() {
  const context = useContext(UnifiedAuthContext);

  if (!context) {
    throw new Error('useAuth must be used within the unified AuthProvider');
  }

  return context;
}
