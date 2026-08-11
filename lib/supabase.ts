import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta?.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] || '';
  }
  return '';
};

let activeUrl = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL') || 'https://ogklfczlceubykreddib.supabase.co';
let activeKey = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9na2xmY3psY2V1YnlrcmVkZGliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDcxOTIyOCwiZXhwIjoyMTAwMjk1MjI4fQ.hZbtmPG_B8AfIeDDNb0dTdWogP5Du6yp7CbcC1pUJmM';

export let supabase: SupabaseClient = createClient(activeUrl, activeKey);

export const isSupabaseConfigured = (): boolean => {
  const url = activeUrl;
  const key = activeKey;
  return Boolean(
    url && 
    key && 
    url !== 'https://placeholder.supabase.co' && 
    key !== 'placeholder_key' &&
    url.startsWith('https://')
  );
};

let initPromise: Promise<boolean> | null = null;

export async function ensureSupabaseInitialized(): Promise<boolean> {
  if (isSupabaseConfigured()) return true;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const res = await fetch("/api/supabase-config");
      if (res.ok) {
        const config = await res.json();
        if (config.isConfigured && config.url && config.key) {
          activeUrl = config.url;
          activeKey = config.key;
          supabase = createClient(activeUrl, activeKey);
          console.log("[Supabase] Successfully initialized client from server API config");
          return true;
        }
      }
    } catch (err) {
      console.warn("[Supabase] Failed to fetch server config:", err);
    }
    return isSupabaseConfigured();
  })();

  return initPromise;
}

if (typeof window !== 'undefined') {
  ensureSupabaseInitialized().catch(() => {});
}


