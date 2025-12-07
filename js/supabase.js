// js/supabase.js
// =====================================================
// Inicialização oficial, robusta e segura do Supabase
// Usado em: auth.js, cloud-lists.js, cloud-realtime.js,
// main.js, storage.js e todo o núcleo do TodoHub.
// =====================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* =====================================================
   🔐 CONFIGURAÇÃO DA INSTÂNCIA
   Importante: ANON KEY é pública mesmo em produção.
   Não coloque SERVICE ROLE aqui!
===================================================== */

const SUPABASE_URL = "https://ivgpuwwhxnkfamttboop.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Z3B1d3doeG5rZmFtdHRib29wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MjM0NjcsImV4cCI6MjA4MDA5OTQ2N30.G0bcPQ05Uq_TUBueAMYrAzp0CQbgQ7uUfEITNqSMoik";

/* =====================================================
   🧠 INSTÂNCIA PRINCIPAL
===================================================== */

export const Supabase = {
  client: createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,       // mantém login após fechar navegador
      autoRefreshToken: true,     // renova session automaticamente
      detectSessionInUrl: true    // preciso para login mágico no futuro
    }
  }),

  // -----------------------------------------------------
  // Verifica conexão com o backend
  // -----------------------------------------------------
  async checkConnection() {
    try {
      const { data, error } = await this.client.from("users_profiles").select("id").limit(1);

      if (error) return false;
      return true;
    } catch (err) {
      return false;
    }
  },

  // -----------------------------------------------------
  // Retorna user autenticado (sempre seguro)
  // -----------------------------------------------------
  async getUser() {
    try {
      const { data } = await this.client.auth.getUser();
      return data?.user || null;
    } catch {
      return null;
    }
  },

  // -----------------------------------------------------
  // Retorna token atual (útil futuramente)
  // -----------------------------------------------------
  async getToken() {
    const session = await this.client.auth.getSession();
    return session?.data?.session?.access_token || null;
  }
};
