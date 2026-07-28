// src/auth/firebaseAuthService.js
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/firebase/client';
import {
  ACCOUNT_STATUSES,
  isKnownAccountStatus,
  isKnownUserRole,
} from '@/auth/constants';
import { normalizeFirebaseProfile } from '@/auth/normalizeFirebaseProfile';

export class FirebaseAuthServiceError extends Error {
  constructor(code, message, cause = null) {
    super(message);
    this.name = 'FirebaseAuthServiceError';
    this.code = code;
    this.cause = cause;
  }
}

export async function getUserProfile(uid) {
  const profileSnapshot = await getDoc(doc(firestore, 'userProfiles', uid));

  if (!profileSnapshot.exists()) {
    throw new FirebaseAuthServiceError(
      'profile_not_found',
      'No MDX Fuel ATLAS CRM employee profile is assigned to this account.'
    );
  }

  const profile = normalizeFirebaseProfile(
    profileSnapshot.id,
    profileSnapshot.data()
  );

  if (!isKnownUserRole(profile.application_role)) {
    throw new FirebaseAuthServiceError(
      'invalid_role',
      'This employee profile has an invalid role assignment.'
    );
  }

  if (!isKnownAccountStatus(profile.account_status)) {
    throw new FirebaseAuthServiceError(
      'invalid_status',
      'This employee profile has an invalid account status.'
    );
  }

  if (profile.account_status !== ACCOUNT_STATUSES.ACTIVE) {
    throw new FirebaseAuthServiceError(
      'account_inactive',
      'This employee account is inactive.'
    );
  }

  return profile;
}

export async function signInWithFirebase(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(
      firebaseAuth,
      email.trim(),
      password
    );
    const profile = await getUserProfile(credential.user.uid);

    return {
      firebaseUser: credential.user,
      profile,
    };
  } catch (error) {
    if (firebaseAuth.currentUser) {
      await signOut(firebaseAuth);
    }

    if (error instanceof FirebaseAuthServiceError) {
      throw error;
    }

    throw new FirebaseAuthServiceError(
      error?.code || 'sign_in_failed',
      'Unable to sign in with the supplied email and password.',
      error
    );
  }
}

export async function signOutFromFirebase() {
  await signOut(firebaseAuth);
}

export async function requestFirebasePasswordReset(email) {
  try {
    await sendPasswordResetEmail(firebaseAuth, email.trim());
  } catch (error) {
    throw new FirebaseAuthServiceError(
      error?.code || 'password_reset_failed',
      'Unable to send the password reset email.',
      error
    );
  }
}

export function subscribeToFirebaseSession(onSessionChanged) {
  return onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
    if (!firebaseUser) {
      onSessionChanged({
        firebaseUser: null,
        profile: null,
        error: null,
      });
      return;
    }

    try {
      const profile = await getUserProfile(firebaseUser.uid);
      onSessionChanged({
        firebaseUser,
        profile,
        error: null,
      });
    } catch (error) {
      await signOut(firebaseAuth);
      onSessionChanged({
        firebaseUser: null,
        profile: null,
        error,
      });
    }
  });
}
