// src/auth/AuthContext.jsx
import React, { createContext, useContext } from 'react';
import {
  FirebaseAuthProvider,
  useFirebaseAuth,
} from '@/auth/FirebaseAuthContext';

const UnifiedAuthContext = createContext(null);

function FirebaseAuthBridge({ children }) {
  const firebaseAuth = useFirebaseAuth();

  return (
    <UnifiedAuthContext.Provider value={firebaseAuth}>
      {children}
    </UnifiedAuthContext.Provider>
  );
}

export function AuthProvider({ children }) {
  return (
    <FirebaseAuthProvider>
      <FirebaseAuthBridge>{children}</FirebaseAuthBridge>
    </FirebaseAuthProvider>
  );
}

export function useAuth() {
  const context = useContext(UnifiedAuthContext);

  if (!context) {
    throw new Error('useAuth must be used within the unified AuthProvider');
  }

  return context;
}
