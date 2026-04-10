import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get all auth users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (authError) throw authError;

    // Get all profiles
    const { data: profiles } = await supabaseAdmin.from("profiles").select("*");

    // Get all roles
    const { data: roles } = await supabaseAdmin.from("user_roles").select("*");

    const ROLE_MAP: Record<string, string> = {
      admin: "Administrador",
      gestor: "Gestor",
      analista: "Analista",
      clinico: "Clínico",
      funcionario: "Funcionário",
    };

    const users = authData.users.map((authUser) => {
      const profile = profiles?.find((p: any) => p.id === authUser.id);
      const userRole = roles?.find((r: any) => r.user_id === authUser.id);
      return {
        id: authUser.id,
        name: profile?.name || authUser.user_metadata?.name || authUser.email,
        email: authUser.email,
        role: userRole ? ROLE_MAP[userRole.role] || userRole.role : "Funcionário",
        unit: profile?.facility_unit || "Hospital Geral",
        status: authUser.banned_until ? "Bloqueado" : "Ativo",
        photo: profile?.avatar_url || undefined,
        visibleCards: profile?.allowed_cards || undefined,
        supervisor_id: profile?.supervisor_id || undefined,
        cargo: profile?.cargo || undefined,
      };
    });

    return new Response(JSON.stringify(users), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("list-users error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
