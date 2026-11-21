import { createClient } from '@supabase/supabase-js';

// Clés publiques (publishable) de secours : elles sont destinées à être
// embarquées côté client. Elles permettent au build déployé (Vercel) de
// fonctionner même sans variables d'environnement configurées.
const FALLBACK_URL = 'https://dbpywqoecppkpsezflcf.supabase.co';
const FALLBACK_KEY = 'sb_publishable_MRZX8Ivz_V3nHz2nDI1VNQ_PqBqu7QP';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

export const ADMIN_MASTER_EMAIL = 'admin@ceb-bagre.bf';

export const isDemoMode = !supabaseUrl || !supabaseAnonKey ||
  supabaseUrl.includes('votre-projet') ||
  supabaseAnonKey.includes('votre-cle');

export let supabase;

if (isDemoMode) {
  console.warn('🔧 Mode démonstration activé : clés Supabase manquantes. Fonctionnement local sans base de données.');

  const mockAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
      error: null
    }),
    signInWithPassword: async () => ({
      data: null,
      error: { message: 'Mode démonstration : connexion réseau indisponible' }
    }),
    signUp: async () => ({
      data: null,
      error: { message: 'Mode démonstration : inscription réseau indisponible' }
    }),
    signOut: async () => ({ error: null })
  };

  // Chaîne de requête factice : n'importe quelle méthode (select, eq, order,
  // insert, update, delete, upsert, limit, in, single, ...) reste chaînable et
  // le résultat est un thenable qui renvoie des données vides, sans planter.
  const createMockQuery = (single) => {
    const result = single ? { data: null, error: null } : { data: [], error: null };
    const chain = new Proxy(function () {}, {
      get(_target, prop) {
        if (prop === 'then') {
          return (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
        }
        if (prop === 'catch') {
          return (onRejected) => Promise.resolve(result).catch(onRejected);
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return () => createMockQuery(true);
        }
        return () => createMockQuery(single);
      }
    });
    return chain;
  };

  const mockFrom = () => createMockQuery(false);

  supabase = {
    auth: mockAuth,
    from: mockFrom
  };
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  });
}

export function toInternalEmail(identifiant) {
  const clean = identifiant.trim().toLowerCase().replace(/\s+/g, '.');
  if (clean.includes('@')) return clean;
  return `${clean}@ceb.local`;
}

export function fromInternalEmail(email) {
  if (!email) return '';
  return email.split('@')[0];
}