// js/supabase.js
// Inicialização correta e segura do Supabase

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://ivgpuwwhxnkfamttboop.supabase.co";

// ⚠️ ATENÇÃO: Cole AQUI o ANON KEY COMPLETO da sua Supabase
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Z3B1d3doeG5rZmFtdHRib29wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MjM0NjcsImV4cCI6MjA4MDA5OTQ2N30.G0bcPQ05Uq_TUBueAMYrAzp0CQbgQ7uUfEITNqSMoik";

export const Supabase = {
  client: createClient(SUPABASE_URL, SUPABASE_ANON_KEY),
};
