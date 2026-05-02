import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Campos do paciente / cadastro que o médico precisa VER (read-only)
const READ_FIELDS = [
  "id", "facility_unit", "status",
  "patient_name", "patient_record", "patient_birthdate", "patient_mother_name", "patient_sus",
  "billing_aih_number", "billing_aih_file_url",
  "procedure_date", "procedure_time", "procedure_type", "procedure_name", "procedure_sigtap_code", "procedure_room",
  "procedure_segment_cadastro", "procedure_region_cadastro", "procedure_side_cadastro", "procedure_position_cadastro",
  "preop_image_types", "preop_image_other", "preop_exam_date", "preop_exam_number",
  "preop_finding_description", "preop_image_attached", "preop_image_count",
  "preop_validation_responsible", "preop_exams_details",
  "clinical_indication",
  "requester_name", "requester_register",
] as const;

// Campos da REQUISIÇÃO que o médico pode preencher
const WRITABLE_FIELDS = new Set<string>([
  "responsible_name", "responsible_register",
  "procedure_segment_requisicao", "procedure_region_requisicao",
  "procedure_side_requisicao", "procedure_position_requisicao",
  "clinical_indication", "committee_opinion",
  "instruments_specific", "instruments_loan", "instruments_na", "instruments_specify",
  "opme_requested",
  "request_date", "request_time", "procedure_time",
  "billing_cid_main", "billing_cid_secondary",
  "auditor_pre_analysis",
  "preop_finding_description", "preop_validation_responsible",
  "preop_exams_details",
]);

const norm = (s: string) => String(s || "").replace(/\s+/g, "").toLowerCase();
const maskCrm = (s: string) => {
  const v = String(s || "").trim();
  if (!v) return "";
  if (v.length <= 3) return "•".repeat(v.length);
  return v.slice(0, 2) + "•".repeat(Math.max(1, v.length - 4)) + v.slice(-2);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return json({ error: "token required" }, 400);

    // Carrega convite
    const { data: invite, error: invErr } = await admin
      .from("opme_requisition_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!invite) return json({ error: "Convite não encontrado" }, 404);
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return json({ error: "Link expirado" }, 410);
    }

    // Carrega o pedido OPME relacionado
    const { data: request, error: reqErr } = await admin
      .from("opme_requests")
      .select("*")
      .eq("id", invite.opme_request_id)
      .maybeSingle();
    if (reqErr) throw reqErr;
    if (!request) return json({ error: "Paciente não encontrado" }, 404);

    // Anexos do Cadastro (fotos/exames pré-op)
    const { data: attachments } = await admin
      .from("opme_attachments")
      .select("id, file_name, file_url, file_type, stage, category, description, created_at")
      .eq("opme_request_id", invite.opme_request_id)
      .order("created_at", { ascending: false });

    // GET: apenas dados mínimos para a tela de verificação (sem PII sensível)
    if (req.method === "GET") {
      return json({
        invite: {
          id: invite.id,
          expires_at: invite.expires_at,
        },
        preview: {
          patient_name: request.patient_name,
          facility_unit: request.facility_unit,
          procedure_name: request.procedure_name,
          procedure_date: request.procedure_date,
        },
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const action = String(body?.action || "submit");
      const expectedCrm = String(request.requester_register || "").trim();

      // ---------- VERIFY: valida CRM e devolve o payload completo ----------
      if (action === "verify") {
        const doctor_crm = String(body?.doctor_crm || "").trim();
        if (!doctor_crm) return json({ error: "Informe o CRM" }, 400);
        if (!expectedCrm) {
          return json({ error: "Cadastro sem CRM do solicitante. Contate o hospital." }, 400);
        }
        if (norm(expectedCrm) !== norm(doctor_crm)) {
          return json({ error: "CRM não confere com o registrado no Cadastro." }, 403);
        }
        const cadastro: Record<string, unknown> = {};
        for (const k of READ_FIELDS) cadastro[k] = (request as any)[k];
        const requisicao: Record<string, unknown> = {};
        for (const k of WRITABLE_FIELDS) requisicao[k] = (request as any)[k];
        return json({
          invite: {
            id: invite.id,
            expires_at: invite.expires_at,
            last_filled_at: invite.last_filled_at,
          },
          cadastro,
          requisicao,
          attachments: attachments || [],
          preop_exams_details: (request as any).preop_exams_details || [],
        });
      }

      // ---------- SEARCH OPME (catálogo + banco de preços) ----------
      if (action === "search_opme") {
        const term = String(body?.term || "").trim();
        if (term.length < 2) return json({ items: [] });
        const like = `%${term}%`;
        const [{ data: cat }, { data: ph }] = await Promise.all([
          admin.from("product_catalog")
            .select("id, codigo, descricao, descricao_resumida, sigtap_code, preco_referencia, image_url, fabricante, fornecedor_padrao")
            .eq("ativo", true)
            .or(`descricao.ilike.${like},descricao_resumida.ilike.${like},codigo.ilike.${like}`)
            .limit(30),
          admin.from("price_history")
            .select("descricao_produto, valor_unitario, unidade_medida, fornecedor_nome, data_referencia, fonte")
            .ilike("descricao_produto", like)
            .order("data_referencia", { ascending: false })
            .limit(30),
        ]);
        const items: any[] = [];
        for (const p of (cat || [])) {
          let sigtap = p.sigtap_code || "";
          if (!sigtap && p.descricao) {
            const { data: sp } = await admin
              .from("sigtap_procedures")
              .select("code")
              .ilike("name", `%${String(p.descricao).slice(0, 24)}%`)
              .limit(1);
            if (sp?.[0]) sigtap = sp[0].code;
          }
          items.push({
            kind: "catalog",
            description: p.descricao,
            short: p.descricao_resumida,
            sigtap,
            unit_price: Number(p.preco_referencia || 0),
            supplier: p.fornecedor_padrao || "",
            image_url: p.image_url || null,
            code: p.codigo || "",
          });
        }
        const seen = new Set(items.map(i => norm(i.description)));
        for (const r of (ph || [])) {
          const key = norm(r.descricao_produto);
          if (seen.has(key)) continue;
          seen.add(key);
          let sigtap = "";
          if (r.descricao_produto) {
            const { data: sp } = await admin
              .from("sigtap_procedures")
              .select("code")
              .ilike("name", `%${String(r.descricao_produto).slice(0, 24)}%`)
              .limit(1);
            if (sp?.[0]) sigtap = sp[0].code;
          }
          items.push({
            kind: "price",
            description: r.descricao_produto,
            sigtap,
            unit_price: Number(r.valor_unitario || 0),
            supplier: r.fornecedor_nome || "",
            unidade_medida: r.unidade_medida || "UN",
          });
        }
        return json({ items: items.slice(0, 30) });
      }

      // ---------- SEARCH CID-10 ----------
      if (action === "search_cid") {
        const term = String(body?.term || "").trim();
        if (term.length < 2) return json({ items: [] });
        const { data } = await admin.from("cid10")
          .select("codigo, descricao")
          .or(`codigo.ilike.${term}%,descricao.ilike.%${term}%`)
          .order("codigo")
          .limit(20);
        return json({ items: data || [] });
      }

      // ---------- SUBMIT (preenchimento final) ----------
      const doctor_name = String(body?.doctor_name || "").trim();
      const doctor_crm = String(body?.doctor_crm || "").trim();
      const payload = body?.payload && typeof body.payload === "object" ? body.payload : null;

      if (!doctor_name || !doctor_crm) {
        return json({ error: "Nome e CRM do médico são obrigatórios" }, 400);
      }
      if (!payload) return json({ error: "Dados da requisição ausentes" }, 400);

      if (expectedCrm && norm(expectedCrm) !== norm(doctor_crm)) {
        return json({
          error: `CRM informado (${doctor_crm}) não confere com o CRM registrado no Cadastro.`,
        }, 403);
      }

      // Filtra somente campos permitidos
      const safeUpdate: Record<string, unknown> = {};
      for (const k of Object.keys(payload)) {
        if (WRITABLE_FIELDS.has(k)) safeUpdate[k] = (payload as any)[k];
      }
      // Médico responsável = quem preencheu via link (NÃO sobrescreve quem cadastrou no sistema)
      safeUpdate["responsible_name"] = doctor_name;
      safeUpdate["responsible_register"] = doctor_crm;
      // Avança status quando ainda aguardando preenchimento da requisição
      if (request.status === "rascunho" || request.status === "pendente_requisicao") {
        safeUpdate["status"] = "pendente_auditoria";
      }

      const { error: upErr } = await admin
        .from("opme_requests")
        .update(safeUpdate)
        .eq("id", invite.opme_request_id);
      if (upErr) throw upErr;

      // Atualiza convite (auditoria leve)
      await admin
        .from("opme_requisition_invites")
        .update({
          last_filled_at: new Date().toISOString(),
          last_doctor_name: doctor_name,
          last_doctor_crm: doctor_crm,
          fill_count: (invite.fill_count || 0) + 1,
        })
        .eq("id", invite.id);

      // Histórico no opme_history (sem changed_by autenticado — usamos o created_by do request)
      await admin.from("opme_history").insert({
        opme_request_id: invite.opme_request_id,
        action: "requisicao_preenchida_por_link",
        field_changed: "requisicao",
        old_value: null,
        new_value: `Médico ${doctor_name} (CRM ${doctor_crm}) preencheu via link público`,
        changed_by: request.created_by,
        changed_by_name: doctor_name,
        signature_name: doctor_name,
        signature_register: doctor_crm,
        reason: "Preenchimento remoto via convite",
      });

      return json({ ok: true });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (err) {
    console.error("requisition-invite error", err);
    return json({ error: (err as Error)?.message || "erro interno" }, 500);
  }
});