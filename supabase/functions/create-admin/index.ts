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

    const body = await req.json();
    const { action } = body;

    // ── Update email ──
    if (action === "update-email") {
      const { userId, newEmail } = body;
      if (!userId || !newEmail) {
        return new Response(JSON.stringify({ error: "userId e newEmail obrigatorios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: newEmail, email_confirm: true });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Reset password ──
    if (action === "reset-password") {
      const { userId, newPassword } = body;
      if (!userId || !newPassword || newPassword.length < 6) {
        return new Response(JSON.stringify({ error: "userId e senha (min 6 chars) obrigatorios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Update user profile (admin operation) ──
    if (action === "update-profile") {
      const { userId, updates } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId obrigatorio" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabaseAdmin.from("profiles").update(updates).eq("id", userId);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Update user role ──
    if (action === "update-role") {
      const { userId, role } = body;
      if (!userId || !role) {
        return new Response(JSON.stringify({ error: "userId e role obrigatorios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ROLE_MAP: Record<string, string> = {
        "Administrador": "admin", "Gestor": "gestor", "Analista": "analista",
        "Clinico": "clinico", "Clínico": "clinico", "Funcionário": "funcionario", "Funcionario": "funcionario",
      };
      const dbRole = ROLE_MAP[role] || role;
      // Delete existing roles then insert new one
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: dbRole });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create user (default) ──
    const { email, password, name, facility_unit, role } = body;

    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: "email, password e name obrigatorios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, facility_unit: facility_unit || "Hospital Geral" },
    });

    if (userError) {
      return new Response(JSON.stringify({ error: userError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign role (default to 'funcionario' if not specified)
    const ROLE_MAP: Record<string, string> = {
      "Administrador": "admin",
      "Gestor": "gestor",
      "Analista": "analista",
      "Clinico": "clinico",
      "Clínico": "clinico",
      "Funcionário": "funcionario",
    };
    const dbRole = ROLE_MAP[role] || "funcionario";

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userData.user.id,
      role: dbRole,
    });

    if (roleError) {
      console.error("Role insert error:", roleError);
    }

    return new Response(JSON.stringify({ success: true, user_id: userData.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-admin error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
