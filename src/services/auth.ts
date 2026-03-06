// ─────────────────────────────────────────────────────────────────────────────
// Auth service — Firebase Email/Password
// Replaces previous Supabase auth service
// ─────────────────────────────────────────────────────────────────────────────

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { User } from '../types';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Map a Firebase user + Firestore profile into our internal User type */
async function buildUser(firebaseUser: FirebaseUser): Promise<User | null> {
  try {
    const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
    const profile = snap.data() as Partial<User> | undefined;
    return {
      id:                firebaseUser.uid,
      email:             firebaseUser.email ?? '',
      company_name:      profile?.company_name ?? '',
      subscription_tier: profile?.subscription_tier ?? 'free',
      created_at:        profile?.created_at ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ── authService ───────────────────────────────────────────────────────────────

export const authService = {
  /**
   * Create a new account.
   * Writes the user profile to Firestore users/{uid}.
   */
  async signUp(
    email: string,
    password: string,
    companyName: string,
  ): Promise<{ user: User | null; error: string | null }> {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const { user: fbUser } = cred;

      // Persist display name
      await updateProfile(fbUser, { displayName: companyName });

      // Write profile doc to Firestore
      const profile: User = {
        id:                fbUser.uid,
        email:             email.toLowerCase().trim(),
        company_name:      companyName.trim(),
        subscription_tier: 'free',
        created_at:        new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', fbUser.uid), {
        ...profile,
        created_at: serverTimestamp(),
      });

      return { user: profile, error: null };
    } catch (err: any) {
      const msg = (err?.message as string) ?? 'Sign-up failed';
      return { user: null, error: friendlyError(msg) };
    }
  },

  /**
   * Sign in with email + password.
   * Fetches the Firestore profile and returns a User object.
   */
  async signIn(
    email: string,
    password: string,
  ): Promise<{ user: User | null; error: string | null }> {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = await buildUser(cred.user);
      return { user, error: user ? null : 'Profile not found' };
    } catch (err: any) {
      return { user: null, error: friendlyError(err?.message ?? 'Sign-in failed') };
    }
  },

  /** Send password-reset email */
  async resetPassword(
    email: string,
  ): Promise<{ error: string | null }> {
    try {
      await sendPasswordResetEmail(auth, email);
      return { error: null };
    } catch (err: any) {
      return { error: friendlyError(err?.message ?? 'Reset failed') };
    }
  },

  /** Return the currently logged-in Firebase user (or null) */
  getCurrentFirebaseUser(): FirebaseUser | null {
    return auth.currentUser;
  },

  /** Fetch the Firestore profile for the current user */
  async getCurrentUser(): Promise<User | null> {
    const fbUser = auth.currentUser;
    if (!fbUser) return null;
    return buildUser(fbUser);
  },

  /** Sign out */
  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  },

  /**
   * Listen for auth state changes.
   * Returns the unsubscribe function.
   */
  onAuthStateChange(
    callback: (user: User | null) => void,
  ): () => void {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        callback(null);
        return;
      }
      const user = await buildUser(fbUser);
      callback(user);
    });
  },
};

// ── error mapping ─────────────────────────────────────────────────────────────

function friendlyError(msg: string): string {
  if (msg.includes('email-already-in-use'))    return 'An account with this email already exists.';
  if (msg.includes('user-not-found'))          return 'No account found with this email.';
  if (msg.includes('wrong-password'))          return 'Incorrect password. Please try again.';
  if (msg.includes('invalid-email'))           return 'Please enter a valid email address.';
  if (msg.includes('weak-password'))           return 'Password must be at least 6 characters.';
  if (msg.includes('too-many-requests'))       return 'Too many attempts. Please try again later.';
  if (msg.includes('network-request-failed'))  return 'Network error. Check your connection.';
  if (msg.includes('invalid-credential'))      return 'Incorrect email or password.';
  return msg;
}
