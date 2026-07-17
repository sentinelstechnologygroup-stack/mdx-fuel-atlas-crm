// src/auth/FirebaseAuthContext.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  requestFirebasePasswordReset,
  signInWithFirebase,
  signOutFromFirebase,
  subscribeToFirebaseSession,
} from '@/auth/firebaseAuthService';

const FirebaseAuthContext = createContext(null);

export function FirebaseAuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToFirebaseSession((session) => {
      setFirebaseUser(session.firebaseUser);
      setProfile(session.profile);
      setAuthError(session.error);
      setIsLoadingAuth(false);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (email, password) => {
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      const session = await signInWithFirebase(email, password);
      setFirebaseUser(session.firebaseUser);
      setProfile(session.profile);
      return session;
    } catch (error) {
      setFirebaseUser(null);
      setProfile(null);
      setAuthError(error);
      throw error;
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      await signOutFromFirebase();
      setFirebaseUser(null);
      setProfile(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    setAuthError(null);

    try {
      await requestFirebasePasswordReset(email);
    } catch (error) {
      setAuthError(error);
      throw error;
    }
  }, []);

  const value = useMemo(() => ({
    authProvider: 'firebase',
    user: profile,
    firebaseUser,
    profile,
    isAuthenticated: Boolean(firebaseUser && profile),
    isLoadingAuth,
    isLoadingPublicSettings: false,
    authError,
    appPublicSettings: null,
    login,
    logout,
    requestPasswordReset,
    navigateToLogin: () => {},
  }), [
    authError,
    firebaseUser,
    isLoadingAuth,
    login,
    logout,
    profile,
    requestPasswordReset,
  ]);

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth() {
  const context = useContext(FirebaseAuthContext);

  if (!context) {
    throw new Error(
      'useFirebaseAuth must be used within a FirebaseAuthProvider'
    );
  }

  return context;
}
