// ─────────────────────────────────────────────────────────────────────────────
// Auth service — Supabase Email/Password
// Connects to the same Supabase project as the web app
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';
import type { User } from '../types';

// ── helpers ───────────────────────────────────────────────────────────────────

function friendlyError(msg: string): string {
  if (msg.includes('Invalid login credentials'))  return 'Incorrect email or password.';
  if (msg.includes('Email not confirmed'))         return 'Please confirm your email first.';
  if (msg.includes('User already registered'))     return 'An account with this email already exists.';
  if (msg.includes('Password should be'))          return 'Password must be at least 6 characters.';
  if (msg.includes('Unable to validate'))          return 'Network error. Check your connection.';
  if (msg.includes('rate limit'))                  return 'Too many attempts. Please try again later.';
  return msg;
}

function buildUser(supabaseUser: any): User {
  return {
    id:                supabaseUser.id,
    email:             supabaseUser.email ?? '',
    company_name:      supabaseUser.user_metadata?.company_name ?? '',
    subscription_tier: 'free',
    created_at:        supabaseUser.created_at ?? new Date().toISOString(),
  };
}

// ── authService ───────────────────────────────────────────────────────────────

export const authService = {
  /** Sign in with email + password */
  async signIn(
    email: string,
    password: string,
  ): Promise<{ user: User | null; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { user: null, error: friendlyError(error.message) };
      if (!data.user) return { user: null, error: 'Sign-in failed' };
      return { user: buildUser(data.user), error: null };
    } catch (err: any) {
      return { user: null, error: friendlyError(err?.message ?? 'Sign-in failed') };
    }
  },

  /** Create a new account */
  async signUp(
    email: string,
    password: string,
    companyName: string,
  ): Promise<{ user: User | null; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { company_name: companyName } },
      });
      if (error) return { user: null, error: friendlyError(error.message) };
      if (!data.user) return { user: null, error: 'Sign-up failed' };
      return { user: buildUser(data.user), error: null };
    } catch (err: any) {
      return { user: null, error: friendlyError(err?.message ?? 'Sign-up failed') };
    }
  },

  /** Send password-reset email */
  async resetPassword(email: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) return { error: friendlyError(error.message) };
      return { error: null };
    } catch (err: any) {
      return { error: friendlyError(err?.message ?? 'Reset failed') };
    }
  },

  /** Get the currently logged-in user */
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      return buildUser(user);
    } catch {
      return null;
    }
  },

  /** Sign out */
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  /** Listen for auth state changes — returns unsubscribe function */
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        callback(buildUser(session.user));
      } else {
        callback(null);
      }
    });
    return () => subscription.unsubscribe();
  },
};
