import { supabase } from './supabase';
import { User } from '../types';

export const authService = {

  async signUp(email: string, password: string, companyName: string): Promise<{ user?: User; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      if (!data.user) return { error: 'Sign up failed — no user returned' };

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email,
          company_name: companyName,
          subscription_tier: 'free',
        });

      if (profileError) return { error: profileError.message };

      const user: User = {
        id: data.user.id,
        email,
        company_name: companyName,
        subscription_tier: 'free',
        created_at: new Date().toISOString(),
      };
      return { user };
    } catch (err: any) {
      return { error: err.message ?? 'Sign up failed' };
    }
  },

  async signIn(email: string, password: string): Promise<{ user?: User; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      if (!data.user) return { error: 'Login failed' };

      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) return { error: profileError.message };
      return { user: profile as User };
    } catch (err: any) {
      return { error: err.message ?? 'Login failed' };
    }
  },

  async sendPasswordReset(email: string): Promise<{ error?: string }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error?.message };
  },

  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async getCurrentUser(): Promise<User | null> {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return profile as User ?? null;
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
