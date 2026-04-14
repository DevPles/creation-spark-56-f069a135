import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useContracts } from "@/contexts/ContractsContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import RichTextEditor from "@/components/relatorio/RichTextEditor";
import AutoDataPanel from "@/components/relatorio/AutoDataPanel";
import SectionEntryForms from "@/components/relatorio/SectionEntryForms";
import { useAutoData, useComputedSummaries } from "@/components/relatorio/useAutoData";
import {
  DEFAULT_SECTIONS, STATUS_LABELS, STATUS_COLORS,
  type ReportRecord, type SectionDef, type SectionData,
} from "@/components/relatorio/types";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MONTHS_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const STATUS_TRANSITIONS: Record<string, string[]> = {
  rascunho: ["em_revisao"],
  em_revisao: ["rascunho", "fechado"],
  fechado: ["exportado", "em_revisao"],
  exportado: ["em_revisao"],
};

// Sections that support complementary entries
const ENTRY_SECTIONS = ["recursos_humanos", "doc_regulatoria", "doc_operacional", "treinamentos", "seg_trabalho", "servicos_terceirizados"];

const RelatorioAssistencialPage = () => {
  const navigate = useNavigate();
  const { contracts } = useContracts();
  const { user } = useAuth();
  const userId = user?.id || "";

  const [view, setView] = useState<"listing" | "editor">("listing");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [refMonth, setRefMonth] = useState(() => new Date().getMonth() + 1);
  const [refYear, setRefYear] = useState(() => new Date().getFullYear());

  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchText, setSearchText] = useState("");

  const [currentReport, setCurrentReport] = useState<ReportRecord | null>(null);
  const [sections, setSections] = useState<SectionDef[]>(DEFAULT_SECTIONS);
  const [activeSection, setActiveSection] = useState(DEFAULT_SECTIONS[0].key);
  const [sectionsData, setSectionsData] = useState<Record<string, SectionData>>({});
  const [sectionEntries, setSectionEntries] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pdfSections, setPdfSections] = useState<Set<string>>(new Set(DEFAULT_SECTIONS.map(s => s.key)));
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionDesc, setNewSectionDesc] = useState("");
  const [replicateOpen, setReplicateOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareReport, setCompareReport] = useState<ReportRecord | null>(null);
  const [compareSectionsData, setCompareSectionsData] = useState<Record<string, SectionData>>({});
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [coverConfig, setCoverConfig] = useState({
    title: "RELATÓRIO ASSISTENCIAL",
    subtitle: "Gerência, Operacionalização e Execução das Ações e Serviços de Saúde",
    logos: [
      { name: "CEBAS", url: "/images/logo-cebas.png" },
      { name: "Hospital Pimentas", url: "/images/logo-hospital.png" },
      { name: "Guarulhos", url: "/images/logo-guarulhos.png" },
      { name: "Instituto Univida", url: "/images/logo-univida.png" },
    ],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const selectedContract = contracts.find(c => c.id === selectedContractId);
  const unit = selectedContract?.unit || "";
  const period = `${String(refMonth).padStart(2, "0")}/${refYear}`;

  const { autoData, loading: autoDataLoading } = useAutoData(unit, selectedContractId);
  const { goalsBySector, goalSummary, actionPlanSummary, sauSummary, bedSummary, rubricaSummary } = useComputedSummaries(autoData, refMonth, refYear);

  const isLocked = currentReport?.status === "fechado" || currentReport?.status === "exportado";
  const isEditable = currentReport ? (currentReport.status === "rascunho" || currentReport.status === "em_revisao") : false;
  const allowedTransitions = currentReport ? (STATUS_TRANSITIONS[currentReport.status] || []) : [];

  // ═══ REPORTS LISTING ═══

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    const { data } = await supabase.from("reports").select("*").order("reference_year", { ascending: false }).order("reference_month", { ascending: false }).order("version", { ascending: false });
    setReports((data || []) as unknown as ReportRecord[]);
    setLoadingReports(false);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const filteredReports = useMemo(() => {
    let r = reports;
    if (selectedContractId && selectedContractId !== "all") r = r.filter(rep => rep.contract_id === selectedContractId);
    if (filterStatus !== "all") r = r.filter(rep => rep.status === filterStatus);
    if (searchText) {
      const s = searchText.toLowerCase();
      r = r.filter(rep => rep.title.toLowerCase().includes(s) || rep.facility_unit.toLowerCase().includes(s));
    }
    return r;
  }, [reports, selectedContractId, filterStatus, searchText]);

  // ═══ COMPETENCY CALENDAR ═══

  const calendarData = useMemo(() => {
    if (!selectedContractId || selectedContractId === "all") return [];
    const months: { month: number; year: number; reports: ReportRecord[] }[] = [];
    for (let m = 1; m <= 12; m++) {
      const reps = reports.filter(r => r.contract_id === selectedContractId && r.reference_month === m && r.reference_year === refYear);
      months.push({ month: m, year: refYear, reports: reps });
    }
    return months;
  }, [reports, selectedContractId, refYear]);

  // ═══ CREATE / OPEN REPORT ═══

  const createNewReport = async (replicateFrom?: "blank" | "text" | "text_entries" | "all") => {
    if (!selectedContractId || !unit || selectedContractId === "all") { toast.error("Selecione um contrato"); return; }

    const existing = reports.filter(r => r.contract_id === selectedContractId && r.facility_unit === unit && r.reference_month === refMonth && r.reference_year === refYear);
    const nextVersion = existing.length > 0 ? Math.max(...existing.map(r => r.version)) + 1 : 1;

    const { data, error } = await supabase.from("reports").insert({
      contract_id: selectedContractId, facility_unit: unit,
      reference_month: refMonth, reference_year: refYear,
      version: nextVersion, status: "rascunho" as any,
      title: `Relatório ${MONTHS[refMonth - 1]} ${refYear} — ${unit}`,
      created_by: userId, updated_by: userId,
    }).select().single();

    if (error) { toast.error("Erro ao criar relatório: " + error.message); return; }
    const report = data as unknown as ReportRecord;

    if (replicateFrom && replicateFrom !== "blank") {
      const prevMonth = refMonth === 1 ? 12 : refMonth - 1;
      const prevYear = refMonth === 1 ? refYear - 1 : refYear;
      const prevReports = reports.filter(r => r.contract_id === selectedContractId && r.facility_unit === unit && r.reference_month === prevMonth && r.reference_year === prevYear);
      if (prevReports.length > 0) {
        const latestPrev = prevReports.sort((a, b) => b.version - a.version)[0];
        const { data: prevSections } = await supabase.from("report_sections").select("*").eq("report_id", latestPrev.id);
        if (prevSections) {
          for (const sec of prevSections) {
            const insertData: any = {
              report_id: report.id, contract_id: selectedContractId, facility_unit: unit, period,
              section_key: sec.section_key, section_title: sec.section_title,
              content: replicateFrom === "all" || replicateFrom === "text_entries" || replicateFrom === "text" ? sec.content : "",
              manual_content: replicateFrom === "all" || replicateFrom === "text_entries" || replicateFrom === "text" ? (sec.manual_content || "") : "",
              sort_order: sec.sort_order, updated_by: userId, completion_status: "pendente",
            };
            const { data: newSec } = await supabase.from("report_sections").insert(insertData).select("id").single();

            if (newSec && (replicateFrom === "all")) {
              const { data: prevAtts } = await supabase.from("report_attachments").select("*").eq("section_id", sec.id);
              if (prevAtts) {
                for (const att of prevAtts) {
                  await supabase.from("report_attachments").insert({
                    report_id: report.id, section_id: newSec.id, file_name: att.file_name,
                    file_url: att.file_url, file_type: att.file_type, uploaded_by: userId, sort_order: att.sort_order,
                  });
                }
              }
            }

            // Copy complementary entries if requested
            if (newSec && (replicateFrom === "text_entries" || replicateFrom === "all")) {
              const { data: prevEntries } = await supabase.from("report_section_entries" as any).select("*").eq("section_id", sec.id);
              if (prevEntries) {
                for (const entry of prevEntries as any[]) {
                  await supabase.from("report_section_entries" as any).insert({
                    report_id: report.id, section_id: newSec.id,
                    entry_type: entry.entry_type, entry_json: entry.entry_json,
                    created_by: userId, updated_by: userId,
                  });
                }
              }
            }
          }
        }
      }
    }

    setCurrentReport(report);
    setView("editor");
    await loadReportSections(report.id);
    await loadReports();
    toast.success(`Relatório v${nextVersion} criado`);
    setReplicateOpen(false);
  };

  const duplicateReport = async () => {
    if (!currentReport) return;
    const existing = reports.filter(r => r.contract_id === currentReport.contract_id && r.facility_unit === currentReport.facility_unit && r.reference_month === currentReport.reference_month && r.reference_year === currentReport.reference_year);
    const nextVersion = Math.max(...existing.map(r => r.version)) + 1;

    const { data, error } = await supabase.from("reports").insert({
      contract_id: currentReport.contract_id, facility_unit: currentReport.facility_unit,
      reference_month: currentReport.reference_month, reference_year: currentReport.reference_year,
      version: nextVersion, status: "rascunho" as any,
      title: `Relatório ${MONTHS[currentReport.reference_month - 1]} ${currentReport.reference_year} — ${currentReport.facility_unit}`,
      created_by: userId, updated_by: userId,
    }).select().single();

    if (error) { toast.error("Erro: " + error.message); return; }
    const newReport = data as unknown as ReportRecord;

    const { data: srcSections } = await supabase.from("report_sections").select("*").eq("report_id", currentReport.id);
    if (srcSections) {
      for (const sec of srcSections) {
        const { data: newSec } = await supabase.from("report_sections").insert({
          report_id: newReport.id, contract_id: sec.contract_id, facility_unit: sec.facility_unit,
          period: sec.period, section_key: sec.section_key, section_title: sec.section_title,
          content: sec.content, manual_content: sec.manual_content, sort_order: sec.sort_order,
          updated_by: userId, completion_status: "pendente",
        }).select("id").single();
        if (newSec) {
          const { data: atts } = await supabase.from("report_attachments").select("*").eq("section_id", sec.id);
          if (atts) {
            for (const att of atts) {
              await supabase.from("report_attachments").insert({
                report_id: newReport.id, section_id: newSec.id, file_name: att.file_name,
                file_url: att.file_url, file_type: att.file_type, uploaded_by: userId, sort_order: att.sort_order,
              });
            }
          }
          const { data: entries } = await supabase.from("report_section_entries" as any).select("*").eq("section_id", sec.id);
          if (entries) {
            for (const entry of entries as any[]) {
              await supabase.from("report_section_entries" as any).insert({
                report_id: newReport.id, section_id: newSec.id,
                entry_type: entry.entry_type, entry_json: entry.entry_json,
                created_by: userId, updated_by: userId,
              });
            }
          }
        }
      }
    }

    setCurrentReport(newReport);
    await loadReportSections(newReport.id);
    await loadReports();
    setDuplicateOpen(false);
    toast.success(`Nova versão v${nextVersion} criada como rascunho`);
  };

  const deleteReport = async (reportId: string) => {
    await supabase.from("report_attachments").delete().eq("report_id", reportId);
    await supabase.from("report_section_entries").delete().eq("report_id", reportId);
    await supabase.from("report_sections").delete().eq("report_id", reportId);
    await supabase.from("reports").delete().eq("id", reportId);
    await loadReports();
    toast.success("Relatório excluído");
  };

  const openReport = async (report: ReportRecord) => {
    setSelectedContractId(report.contract_id);
    setRefMonth(report.reference_month);
    setRefYear(report.reference_year);
    setCurrentReport(report);
    setView("editor");
    await loadReportSections(report.id);
  };

  // ═══ COMPARE ═══

  const loadCompareReport = async (reportId: string) => {
    const rep = reports.find(r => r.id === reportId);
    if (!rep) return;
    setCompareReport(rep);
    const { data: dbSections } = await supabase.from("report_sections").select("*").eq("report_id", reportId);
    const dataMap: Record<string, SectionData> = {};
    sections.forEach(sec => {
      const dbSec = (dbSections || []).find((s: any) => s.section_key === sec.key);
      dataMap[sec.key] = {
        id: dbSec?.id || null, content: dbSec?.content || "", manual_content: dbSec?.manual_content || "",
        auto_snapshot_json: dbSec?.auto_snapshot_json || null, completion_status: dbSec?.completion_status || "pendente",
        updated_by: dbSec?.updated_by, updated_at: dbSec?.updated_at, attachments: [],
      };
    });
    setCompareSectionsData(dataMap);
    setCompareOpen(true);
  };

  // ═══ SECTIONS DATA ═══

  const loadReportSections = useCallback(async (reportId: string) => {
    const { data: dbSections } = await supabase.from("report_sections").select("*").eq("report_id", reportId);
    const sectionIds = (dbSections || []).map((s: any) => s.id);
    let attachments: any[] = [];
    if (sectionIds.length > 0) {
      const { data } = await supabase.from("report_attachments").select("*").in("section_id", sectionIds);
      attachments = data || [];
    }
    // Load complementary entries
    const { data: entriesData } = await supabase.from("report_section_entries" as any).select("*").eq("report_id", reportId);
    setSectionEntries((entriesData || []) as any[]);

    const dataMap: Record<string, SectionData> = {};
    sections.forEach(sec => {
      const dbSec = (dbSections || []).find((s: any) => s.section_key === sec.key);
      dataMap[sec.key] = {
        id: dbSec?.id || null, content: dbSec?.content || "", manual_content: dbSec?.manual_content || "",
        auto_snapshot_json: dbSec?.auto_snapshot_json || null, completion_status: dbSec?.completion_status || "pendente",
        updated_by: dbSec?.updated_by, updated_at: dbSec?.updated_at,
        attachments: attachments.filter((a: any) => a.section_id === dbSec?.id).map((a: any) => ({
          id: a.id, file_name: a.file_name, file_url: a.file_url, file_type: a.file_type, sort_order: a.sort_order,
        })),
      };
    });
    setSectionsData(dataMap);
  }, [sections]);

  const handleContentChange = (key: string, html: string) => {
    if (isLocked) return;
    setSectionsData(prev => ({ ...prev, [key]: { ...prev[key], manual_content: html } }));
  };

  const ensureSectionExists = async (sectionKey: string): Promise<string | null> => {
    if (!currentReport) return null;
    const existing = sectionsData[sectionKey];
    if (existing?.id) return existing.id;
    const sec = sections.find(s => s.key === sectionKey);
    if (!sec) return null;
    const { data } = await supabase.from("report_sections").insert({
      report_id: currentReport.id, contract_id: selectedContractId, facility_unit: unit, period,
      section_key: sectionKey, section_title: sec.title,
      content: "", manual_content: "", sort_order: sec.order, updated_by: userId,
    }).select("id").single();
    if (data) {
      await loadReportSections(currentReport.id);
      return data.id;
    }
    return null;
  };

  const handleSaveSection = async (sectionKey: string) => {
    if (!currentReport || isLocked) return;
    setSaving(true);
    try {
      const data = sectionsData[sectionKey];
      const sec = sections.find(s => s.key === sectionKey);
      if (!sec) return;
      if (data?.id) {
        await supabase.from("report_sections").update({
          manual_content: data.manual_content, content: data.manual_content,
          updated_by: userId, completion_status: data.manual_content.trim() ? "preenchido" : "pendente",
        }).eq("id", data.id);
      } else {
        await supabase.from("report_sections").insert({
          report_id: currentReport.id, contract_id: selectedContractId, facility_unit: unit, period,
          section_key: sectionKey, section_title: sec.title,
          content: data?.manual_content || "", manual_content: data?.manual_content || "",
          sort_order: sec.order, updated_by: userId,
          completion_status: (data?.manual_content || "").trim() ? "preenchido" : "pendente",
        });
      }
      await loadReportSections(currentReport.id);
      toast.success("Seção salva");
    } catch { toast.error("Erro ao salvar"); }
    finally { setSaving(false); }
  };

  const handleSaveAll = async () => {
    if (!currentReport || isLocked) return;
    setSaving(true);
    for (const sec of sections) { await handleSaveSection(sec.key); }
    setSaving(false);
    toast.success("Todas as seções salvas");
  };

  // ═══ FILE UPLOADS ═══

  const handleFileUpload = async (files: FileList | null, fileType: string) => {
    if (!files || !currentReport || isLocked) return;
    setUploading(true);
    try {
      const sec = sections.find(s => s.key === activeSection);
      let currentSectionId = sectionsData[activeSection]?.id;
      if (!currentSectionId && sec) {
        const { data } = await supabase.from("report_sections").insert({
          report_id: currentReport.id, contract_id: selectedContractId, facility_unit: unit, period,
          section_key: activeSection, section_title: sec.title,
          content: sectionsData[activeSection]?.manual_content || "",
          manual_content: sectionsData[activeSection]?.manual_content || "",
          sort_order: sec.order, updated_by: userId,
        }).select("id").single();
        if (data) currentSectionId = data.id;
      }
      if (!currentSectionId) { toast.error("Erro ao criar seção"); return; }

      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${selectedContractId}/${activeSection}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("report-files").upload(path, file);
        if (error) { toast.error(`Erro: ${file.name}`); continue; }
        const { data: urlData } = supabase.storage.from("report-files").getPublicUrl(path);
        await supabase.from("report_attachments").insert({
          report_id: currentReport.id, section_id: currentSectionId,
          file_name: file.name, file_url: urlData.publicUrl,
          file_type: fileType, uploaded_by: userId, sort_order: 0,
        });
      }
      await loadReportSections(currentReport.id);
      toast.success("Arquivo(s) enviado(s)");
    } catch { toast.error("Erro no upload"); }
    finally { setUploading(false); }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (isLocked) return;
    await supabase.from("report_attachments").delete().eq("id", attachmentId);
    if (currentReport) await loadReportSections(currentReport.id);
    toast.success("Anexo removido");
  };

  // ═══ STATUS MANAGEMENT ═══

  const changeStatus = async (newStatus: string) => {
    if (!currentReport) return;
    if (!allowedTransitions.includes(newStatus)) {
      toast.error(`Não é possível alterar de "${STATUS_LABELS[currentReport.status]}" para "${STATUS_LABELS[newStatus]}"`);
      return;
    }

    if (newStatus === "fechado" || newStatus === "exportado") {
      const snapshot = { goalSummary, actionPlanSummary, sauSummary, bedSummary, rubricaSummary, goalsBySector };
      for (const sec of sections) {
        const data = sectionsData[sec.key];
        if (data?.id) {
          await supabase.from("report_sections").update({
            auto_snapshot_json: sec.autoData ? snapshot : null,
          }).eq("id", data.id);
        }
      }
    }

    await supabase.from("reports").update({ status: newStatus as any, updated_by: userId }).eq("id", currentReport.id);
    setCurrentReport({ ...currentReport, status: newStatus as any });
    await loadReports();
    toast.success(`Status: ${STATUS_LABELS[newStatus]}`);
  };

  // ═══ CUSTOM SECTIONS ═══

  const addCustomSection = () => {
    if (!newSectionTitle.trim() || isLocked) return;
    const order = sections.length + 1;
    const key = `custom_${Date.now()}`;
    setSections(prev => [...prev, { key, title: `${String(order).padStart(2, "0")}. ${newSectionTitle}`, description: newSectionDesc || "Seção personalizada", order, custom: true }]);
    setPdfSections(prev => new Set([...prev, key]));
    setNewSectionTitle(""); setNewSectionDesc(""); setAddSectionOpen(false);
    toast.success("Seção adicionada");
  };

  // ═══ COMPUTED ═══

  const sectionHasAutoData = (sec: SectionDef) => {
    return sec.autoData && (
      (sec.autoData === "goals" && goalSummary.total > 0) ||
      (sec.autoData === "goals_trend" && goalSummary.total > 0) ||
      (sec.autoData === "actionPlans" && actionPlanSummary.total > 0) ||
      (sec.autoData === "sau" && sauSummary.total > 0) ||
      (sec.autoData === "beds" && bedSummary.total > 0) ||
      (sec.autoData === "rubricas" && rubricaSummary.totalExecuted > 0) ||
      (sec.autoData === "contract" && selectedContract)
    );
  };

  const sectionHasEntries = (secKey: string) => {
    const secData = sectionsData[secKey];
    if (!secData?.id) return false;
    return sectionEntries.some(e => e.section_id === secData.id);
  };

  const filledCount = useMemo(() =>
    sections.filter(sec => {
      const data = sectionsData[sec.key];
      const hasManual = data && ((data.manual_content || "").trim().length > 0 || data.attachments.length > 0);
      const hasAuto = sectionHasAutoData(sec);
      const hasEntries = sectionHasEntries(sec.key);
      return hasManual || hasAuto || hasEntries;
    }).length,
    [sectionsData, sections, goalSummary, actionPlanSummary, sauSummary, bedSummary, rubricaSummary, selectedContract, sectionEntries]
  );

  const progressPct = sections.length > 0 ? Math.round((filledCount / sections.length) * 100) : 0;
  const activeSec = sections.find(s => s.key === activeSection);
  const activeData = sectionsData[activeSection] || { id: null, content: "", manual_content: "", auto_snapshot_json: null, completion_status: "pendente", attachments: [] };
  const activeImages = activeData.attachments.filter(a => a.file_type === "image");
  const activeFiles = activeData.attachments.filter(a => a.file_type !== "image");

  const compareableReports = useMemo(() => {
    if (!currentReport) return [];
    return reports.filter(r => r.contract_id === currentReport.contract_id && r.id !== currentReport.id);
  }, [reports, currentReport]);

  // ═══ PDF EXPORT ═══

  const handleExportPdf = async () => {
    if (!selectedContract || !currentReport) return;
    setGenerating(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210; const H = 297; const margin = 15;
      const PRIMARY = [30, 64, 120];

      const drawHeader = () => {
        doc.setDrawColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, 10, W - margin, 10);
        doc.setFontSize(7);
        doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
        doc.text("MOSS — Relatório Assistencial", margin, 8);
        doc.text(`${selectedContract.name} — ${unit} — ${MONTHS[refMonth - 1]}/${refYear} — v${currentReport.version}`, W - margin, 8, { align: "right" });
      };

      // Helper to load image as base64
      const loadImageAsBase64 = (url: string): Promise<string | null> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) { resolve(null); return; }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
          };
          img.onerror = () => resolve(null);
          img.src = url;
        });
      };

      // Cover - load logos
      const logoBarH = 18;
      const coverLogos: { dataUrl: string; ratio: number }[] = [];
      if (coverConfig.logos.length > 0) {
        const loaded = await Promise.all(coverConfig.logos.map(l => loadImageAsBase64(l.url)));
        for (const dataUrl of loaded) {
          if (dataUrl) {
            const img = new Image();
            await new Promise<void>((res) => { img.onload = () => res(); img.src = dataUrl; });
            coverLogos.push({ dataUrl, ratio: img.naturalWidth / img.naturalHeight });
          }
        }
      }

      // Draw cover background
      const coverH = coverLogos.length > 0 ? 120 : 100;
      doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
      doc.rect(0, 0, W, coverH, "F");

      // Draw logos bar spanning full width
      let coverTextStart = 8;
      if (coverLogos.length > 0) {
        const barPadX = margin;
        const barW = W - 2 * barPadX;
        const barY = 6;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(barPadX, barY, barW, logoBarH + 4, 3, 3, "F");

        // Calculate proportional widths for each logo
        const totalRatio = coverLogos.reduce((s, l) => s + l.ratio, 0);
        const logoGap = 4;
        const availableW = barW - 8 - logoGap * (coverLogos.length - 1);
        let lx = barPadX + 4;
        coverLogos.forEach((logo, i) => {
          const lw = (logo.ratio / totalRatio) * availableW;
          const lh = logoBarH;
          doc.addImage(logo.dataUrl, "PNG", lx, barY + 2, lw, lh);
          lx += lw + logoGap;
        });
        coverTextStart = barY + logoBarH + 10;
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22); doc.setFont("helvetica", "bold");
      doc.text(coverConfig.title, W / 2, coverTextStart + 10, { align: "center" });
      doc.setFontSize(11); doc.setFont("helvetica", "normal");
      const subtitleLines = doc.splitTextToSize(coverConfig.subtitle, W - 2 * margin);
      subtitleLines.forEach((line: string, i: number) => {
        doc.text(line, W / 2, coverTextStart + 22 + i * 5, { align: "center" });
      });
      const afterSubtitle = coverTextStart + 22 + subtitleLines.length * 5 + 8;
      doc.setFontSize(13);
      doc.text(`${selectedContract.name}`, W / 2, afterSubtitle, { align: "center" });
      doc.text(`${unit}`, W / 2, afterSubtitle + 8, { align: "center" });
      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text(`${MONTHS[refMonth - 1]} de ${refYear}`, W / 2, afterSubtitle + 20, { align: "center" });
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(`Versão ${currentReport.version}`, W / 2, afterSubtitle + 28, { align: "center" });
      doc.setTextColor(0); doc.setFontSize(9);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, W / 2, coverH + 15, { align: "center" });
      doc.text(`Status: ${STATUS_LABELS[currentReport.status]}`, W / 2, coverH + 22, { align: "center" });

      // TOC
      doc.addPage(); drawHeader();
      doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
      doc.text("SUMÁRIO", margin, 22);
      let ty = 32; doc.setTextColor(0);
      const pdfVisibleSections = sections.filter(s => pdfSections.has(s.key));
      pdfVisibleSections.forEach((sec) => {
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        doc.text(`${sec.title}`, margin, ty); ty += 6;
        if (ty > 280) { doc.addPage(); drawHeader(); ty = 20; }
      });

      // Content pages
      pdfVisibleSections.forEach(sec => {
        doc.addPage(); drawHeader();
        doc.setFillColor(235, 239, 245);
        doc.roundedRect(margin, 16, W - 2 * margin, 10, 2, 2, "F");
        doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
        doc.text(sec.title, margin + 4, 23); doc.setTextColor(0);
        let y = 32;

        // Auto data tables in PDF
        if (sec.autoData === "contract" && selectedContract) {
          autoTable(doc, {
            startY: y,
            head: [["Campo", "Valor"]],
            body: [
              ["Contrato", selectedContract.name], ["Unidade", unit],
              ["Valor mensal", `R$ ${Number(selectedContract.value).toLocaleString("pt-BR")}`],
              ["Status", selectedContract.status], ["Vigência", selectedContract.period],
            ],
            margin: { left: margin, right: margin },
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255] },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        if (sec.autoData === "goals" && goalSummary.total > 0) {
          doc.setFontSize(8);
          doc.text(`Atingimento médio: ${goalSummary.avg}% | Metas atingidas: ${goalSummary.atingidas}/${goalSummary.total}`, margin, y); y += 8;
          autoTable(doc, {
            startY: y,
            head: [["Meta", "Setor", "Alvo", "Realizado", "Ating."]],
            body: goalSummary.all.sort((a: any, b: any) => b.pct - a.pct).map((g: any) => {
              const sector = Object.entries(goalsBySector).find(([, goals]) => goals.some(gg => gg.name === g.name))?.[0] || "";
              return [g.name, sector, `${g.target}`, `${g.current}`, `${g.pct}%`];
            }),
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255] },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        if (sec.autoData === "actionPlans" && actionPlanSummary.total > 0) {
          doc.setFontSize(8);
          doc.text(`Total: ${actionPlanSummary.total} | Concluídas: ${actionPlanSummary.concluidas} | Em andamento: ${actionPlanSummary.emAndamento}`, margin, y); y += 8;
          autoTable(doc, {
            startY: y,
            head: [["Referência", "Status", "Responsável", "Prazo"]],
            body: (autoData.actionPlans || []).map((p: any) => [p.reference_name, p.status_acao === "concluida" ? "Concluída" : p.status_acao === "em_andamento" ? "Em andamento" : "Não iniciada", p.responsavel || "—", p.prazo || "—"]),
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255] },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        if (sec.autoData === "beds" && bedSummary.total > 0) {
          doc.setFontSize(8);
          doc.text(`Leitos: ${bedSummary.total} | Internações: ${bedSummary.movements.totalAdmissions} | Altas: ${bedSummary.movements.totalDischarges}`, margin, y); y += 8;
          autoTable(doc, {
            startY: y, head: [["Especialidade", "Categoria", "Qtd"]],
            body: bedSummary.breakdown.map((b: any) => [b.specialty, b.category, b.quantity]),
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255] },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        if (sec.autoData === "rubricas" && rubricaSummary.totalExecuted > 0) {
          doc.setFontSize(8);
          doc.text(`Total executado: R$ ${rubricaSummary.totalExecuted.toLocaleString("pt-BR")}`, margin, y); y += 8;
          autoTable(doc, {
            startY: y, head: [["Rubrica", "Valor Executado"]],
            body: Object.entries(rubricaSummary.byRubrica).map(([name, value]) => [name, `R$ ${(value as number).toLocaleString("pt-BR")}`]),
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255] },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        if (sec.autoData === "sau" && sauSummary.total > 0) {
          doc.setFontSize(8);
          doc.text(`SAU — Total: ${sauSummary.total} | Elogios: ${sauSummary.elogios} | Resolvidos: ${sauSummary.resolvidos}`, margin, y); y += 6;
        }

        if (sec.autoData === "goals_trend" && goalSummary.total > 0) {
          doc.setFontSize(8);
          doc.text(`Indicadores: ${goalSummary.total} metas | Atingimento médio: ${goalSummary.avg}% | Desempenho: ${goalSummary.avg >= 90 ? "Satisfatório" : goalSummary.avg >= 60 ? "Parcial" : "Em evolução"}`, margin, y); y += 6;
        }

        // Complementary entries in PDF
        const secData = sectionsData[sec.key];
        if (secData?.id && ENTRY_SECTIONS.includes(sec.key)) {
          const secEntries = sectionEntries.filter(e => e.section_id === secData.id);
          if (secEntries.length > 0) {
            if (y > 250) { doc.addPage(); drawHeader(); y = 20; }
            doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
            doc.text("Dados Complementares", margin, y); y += 5; doc.setTextColor(0);
            const keys = Object.keys(secEntries[0].entry_json || {});
            if (keys.length > 0) {
              autoTable(doc, {
                startY: y, head: [keys],
                body: secEntries.map(e => keys.map(k => e.entry_json[k] || "—")),
                margin: { left: margin, right: margin },
                styles: { fontSize: 7, cellPadding: 2 },
                headStyles: { fillColor: [200, 210, 225], textColor: [30, 30, 30] },
              });
              y = (doc as any).lastAutoTable.finalY + 6;
            }
          }
        }

        // Manual content
        const rawText = (secData?.manual_content || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (rawText) {
          if (y > 260) { doc.addPage(); drawHeader(); y = 20; }
          doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
          doc.text("Análise Complementar", margin, y); y += 5;
          doc.setFont("helvetica", "normal"); doc.setTextColor(0);
          const lines = doc.splitTextToSize(rawText, W - 2 * margin);
          for (const line of lines) {
            if (y > 275) { doc.addPage(); drawHeader(); y = 20; }
            doc.text(line, margin, y); y += 4.5;
          }
        }

        if (secData?.attachments?.length) {
          y += 4;
          if (y > 270) { doc.addPage(); drawHeader(); y = 20; }
          doc.setFont("helvetica", "bold"); doc.setFontSize(9);
          doc.text("Anexos:", margin, y); doc.setFont("helvetica", "normal"); y += 5;
          secData.attachments.forEach(att => {
            if (y > 280) { doc.addPage(); drawHeader(); y = 20; }
            doc.setFontSize(8); doc.text(`  ${att.file_name}`, margin + 4, y); y += 4;
          });
        }
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150);
        doc.text(`MOSS — ${selectedContract.name} — ${MONTHS[refMonth - 1]}/${refYear} v${currentReport.version} — Página ${i}/${pageCount}`, margin, H - 6);
      }

      if (currentReport.status !== "exportado" && currentReport.status === "fechado") {
        await changeStatus("exportado");
      }

      doc.save(`relatorio_${unit.replace(/\s/g, "_")}_${MONTHS[refMonth - 1]}_${refYear}_v${currentReport.version}.pdf`);
      toast.success("PDF exportado");
    } catch (err) {
      console.error(err); toast.error("Erro ao gerar PDF");
    } finally { setGenerating(false); }
  };

  // ═══ RENDER — LISTING ═══

  if (view === "listing") {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full">Voltar</Button>
            <h1 className="font-display text-xl font-bold text-foreground flex-1">Relatório Assistencial</h1>
            <Dialog open={replicateOpen} onOpenChange={setReplicateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!selectedContractId || selectedContractId === "all"}>Novo Relatório</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Novo Relatório — {MONTHS[refMonth - 1]} {refYear}</DialogTitle></DialogHeader>
                <p className="text-sm text-muted-foreground mb-4">
                  Contrato: {selectedContract?.name || "—"} | Unidade: {unit || "—"}
                </p>
                <p className="text-xs text-muted-foreground mb-3">Deseja usar o relatório anterior como base?</p>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start text-left text-sm h-auto py-3" onClick={() => createNewReport("blank")}>
                    <div><p className="font-semibold">Criar em branco</p><p className="text-[10px] text-muted-foreground">Seções vazias, dados automáticos recalculados</p></div>
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-left text-sm h-auto py-3" onClick={() => createNewReport("text")}>
                    <div><p className="font-semibold">Copiar apenas textos</p><p className="text-[10px] text-muted-foreground">Textos manuais do mês anterior</p></div>
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-left text-sm h-auto py-3" onClick={() => createNewReport("text_entries")}>
                    <div><p className="font-semibold">Copiar textos e lançamentos complementares</p><p className="text-[10px] text-muted-foreground">Textos + registros de RH, documentos, treinamentos</p></div>
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-left text-sm h-auto py-3" onClick={() => createNewReport("all")}>
                    <div><p className="font-semibold">Copiar tudo</p><p className="text-[10px] text-muted-foreground">Textos, lançamentos, imagens e anexos</p></div>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <div className="bg-card rounded-xl border border-border p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground">Contrato</Label>
                <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Ano</Label>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => setRefYear(y => y - 1)}>{"<"}</Button>
                  <Input type="number" value={refYear} onChange={e => setRefYear(Number(e.target.value))} className="h-9 text-center" />
                  <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => setRefYear(y => y + 1)}>{">"}</Button>
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Mês</Label>
                <Select value={String(refMonth)} onValueChange={v => setRefMonth(Number(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Busca</Label>
                <Input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Buscar..." className="h-9" />
              </div>
            </div>
          </div>

          {/* Competency Calendar */}
          {selectedContractId && selectedContractId !== "all" && (
            <div className="bg-card rounded-xl border border-border p-4 mb-4">
              <p className="text-xs font-semibold text-foreground mb-3">Calendário de Competências — {refYear}</p>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
                {calendarData.map(({ month, reports: reps }) => {
                  const hasReport = reps.length > 0;
                  const latestStatus = hasReport ? reps[0].status : null;
                  const isCurrentMonth = month === refMonth;
                  return (
                    <button key={month}
                      onClick={() => setRefMonth(month)}
                      className={`rounded-lg p-2 text-center border transition-all ${
                        isCurrentMonth ? "border-primary bg-primary/10 ring-1 ring-primary/30" :
                        hasReport ? "border-border bg-card hover:border-primary/40" :
                        "border-border/50 bg-muted/20 hover:bg-muted/40"
                      }`}>
                      <p className={`text-xs font-semibold ${isCurrentMonth ? "text-primary" : "text-foreground"}`}>{MONTHS_SHORT[month - 1]}</p>
                      {hasReport ? (
                        <span className={`text-[8px] px-1 py-0.5 rounded border mt-1 inline-block ${STATUS_COLORS[latestStatus!]}`}>
                          {STATUS_LABELS[latestStatus!]}
                        </span>
                      ) : (
                        <span className="text-[8px] text-muted-foreground mt-1 block">—</span>
                      )}
                      {reps.length > 1 && <span className="text-[8px] text-muted-foreground block">{reps.length} versões</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}


          {/* Reports List */}
          {loadingReports ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Carregando relatórios...</div>
          ) : filteredReports.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <p className="text-muted-foreground text-sm">Nenhum relatório encontrado. Selecione um contrato e crie o primeiro relatório.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredReports.map(rep => {
                const c = contracts.find(cc => cc.id === rep.contract_id);
                return (
                  <button key={rep.id} onClick={() => openReport(rep)}
                    className="w-full text-left bg-card rounded-xl border border-border p-4 hover:border-primary/40 hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-foreground">{rep.title || `Relatório ${MONTHS[rep.reference_month - 1]} ${rep.reference_year}`}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c?.name} — {rep.facility_unit} — v{rep.version}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[rep.status]}`}>
                          {STATUS_LABELS[rep.status]}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(rep.updated_at).toLocaleDateString("pt-BR")}
                        </span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => e.stopPropagation()}>
                              Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir relatório</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir "{rep.title || `Relatório ${MONTHS[rep.reference_month - 1]} ${rep.reference_year}`}"? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteReport(rep.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ═══ RENDER — EDITOR ═══

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="outline" size="sm" onClick={() => { setView("listing"); setCurrentReport(null); setCompareOpen(false); }} className="rounded-full">
            Voltar
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-bold text-foreground">{currentReport?.title}</h1>
            <p className="text-[10px] text-muted-foreground">
              {selectedContract?.name} — {unit} — {MONTHS[refMonth - 1]} {refYear} — Versão {currentReport?.version}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {currentReport && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[currentReport.status]}`}>
                {STATUS_LABELS[currentReport.status]}
              </span>
            )}
            {isLocked && (
              <span className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground font-medium">
                Documento congelado
              </span>
            )}
          </div>
        </div>

        {/* Locked banner */}
        {isLocked && (
          <div className="bg-muted/50 border border-border rounded-lg p-3 mb-4">
            <p className="text-xs text-foreground">
              Este relatório está <strong>{STATUS_LABELS[currentReport!.status]}</strong>.
            </p>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => changeStatus("em_revisao")}>
                Reabrir para edição
              </Button>
              <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-[10px]">Criar nova versão (rascunho)</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>Criar nova versão</DialogTitle></DialogHeader>
                  <p className="text-sm text-muted-foreground mb-4">
                    Uma cópia deste relatório será criada como rascunho. Todos os textos, lançamentos complementares, imagens e anexos serão copiados.
                  </p>
                  <div className="flex justify-end gap-2">
                    <DialogClose asChild><Button variant="outline" size="sm">Cancelar</Button></DialogClose>
                    <Button size="sm" onClick={duplicateReport}>Confirmar</Button>
                  </div>
                </DialogContent>
              </Dialog>
              {currentReport?.status === "fechado" && (
                <Button size="sm" className="h-7 text-[10px]" onClick={handleExportPdf} disabled={generating}>
                  {generating ? "Gerando..." : "Exportar PDF"}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="bg-card rounded-lg border border-border p-3 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground">Progresso</span>
            <div className="flex-1 min-w-[120px]"><Progress value={progressPct} className="h-2" /></div>
            <span className="text-xs font-semibold text-foreground">{filledCount}/{sections.length} ({progressPct}%)</span>
            {!isLocked && (
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleSaveAll} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar Tudo"}
                </Button>
                {currentReport?.status === "rascunho" && (
                  <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => changeStatus("em_revisao")}>
                    Enviar para Revisão
                  </Button>
                )}
                {currentReport?.status === "em_revisao" && (
                  <>
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => changeStatus("rascunho")}>
                      Voltar para Rascunho
                    </Button>
                    <Button size="sm" className="h-7 text-[10px]" onClick={() => changeStatus("fechado")}>
                      Fechar Relatório
                    </Button>
                  </>
                )}
              </div>
            )}
            {currentReport?.status === "exportado" && (
              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleExportPdf} disabled={generating}>
                {generating ? "Gerando..." : "Baixar PDF novamente"}
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-5">
          {/* Sidebar */}
          <div className="w-72 shrink-0">
            <div className="bg-card rounded-xl border border-border p-3 sticky top-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground">Sumário</h3>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">{filledCount}/{sections.length}</Badge>
                  {isEditable && (
                    <Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">+</Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader><DialogTitle>Adicionar Seção ao Sumário</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Título</Label>
                            <Input value={newSectionTitle} onChange={e => setNewSectionTitle(e.target.value)} placeholder="Ex: Gestão de Resíduos" className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">Descrição</Label>
                            <Input value={newSectionDesc} onChange={e => setNewSectionDesc(e.target.value)} placeholder="Breve descrição" className="mt-1" />
                          </div>
                          <DialogClose asChild>
                            <Button onClick={addCustomSection} className="w-full">Adicionar</Button>
                          </DialogClose>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>

              <ScrollArea className="h-[calc(100vh-420px)]">
                <div className="space-y-0.5 pr-2">
                  <button onClick={() => setActiveSection("capa")}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] transition-all flex items-center gap-2 ${
                      activeSection === "capa" ? "bg-primary text-primary-foreground font-medium shadow-sm" : "hover:bg-muted text-foreground"
                    }`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${activeSection === "capa" ? "bg-primary-foreground/40" : "bg-emerald-500"}`} />
                    <span className="truncate flex-1">Capa do Relatório</span>
                  </button>
                  {sections.map(sec => {
                    const data = sectionsData[sec.key];
                    const hasManual = data && ((data.manual_content || "").trim().length > 0 || data.attachments.length > 0);
                    const hasAuto = sectionHasAutoData(sec);
                    const hasEntries = sectionHasEntries(sec.key);
                    const filled = hasManual || hasAuto || hasEntries;
                    const isActive = activeSection === sec.key;
                    return (
                      <button key={sec.key} onClick={() => setActiveSection(sec.key)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] transition-all flex items-center gap-2 ${
                          isActive ? "bg-primary text-primary-foreground font-medium shadow-sm" : "hover:bg-muted text-foreground"
                        }`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          (hasManual && hasAuto) || (hasManual && hasEntries) ? "bg-emerald-500 ring-1 ring-emerald-500/30" :
                          filled ? "bg-emerald-500" :
                          isActive ? "bg-primary-foreground/40" : "bg-muted-foreground/20"
                        }`} />
                        <span className="truncate flex-1">{sec.title}</span>
                        {hasAuto && <span className="text-[8px] opacity-60">auto</span>}
                        {hasEntries && !hasAuto && <span className="text-[8px] opacity-60">compl</span>}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Sidebar Actions */}
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                {compareableReports.length > 0 && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full text-xs">Comparar com outro</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto">
                      <DialogHeader><DialogTitle>Selecionar relatório para comparação</DialogTitle></DialogHeader>
                      <div className="space-y-2">
                        {compareableReports.map(rep => (
                          <button key={rep.id} onClick={() => loadCompareReport(rep.id)}
                            className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/40 transition-all">
                            <p className="text-sm font-semibold">{rep.title || `${MONTHS[rep.reference_month - 1]} ${rep.reference_year}`}</p>
                            <p className="text-[10px] text-muted-foreground">v{rep.version} — {STATUS_LABELS[rep.status]} — {new Date(rep.updated_at).toLocaleDateString("pt-BR")}</p>
                          </button>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                {isEditable && (
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleExportPdf} disabled={generating}>
                    {generating ? "Gerando..." : "Pré-visualizar PDF"}
                  </Button>
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full text-xs">Configurar PDF</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto">
                    <DialogHeader><DialogTitle>Seções do PDF</DialogTitle></DialogHeader>
                    <div className="space-y-2">
                      {sections.map(sec => (
                        <div key={sec.key} className="flex items-center gap-2 py-1">
                          <Checkbox checked={pdfSections.has(sec.key)}
                            onCheckedChange={checked => { setPdfSections(prev => { const n = new Set(prev); checked ? n.add(sec.key) : n.delete(sec.key); return n; }); }} />
                          <span className="text-xs">{sec.title}</span>
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 min-w-0">
            {/* Compare view */}
            {compareOpen && compareReport && (
              <div className="mb-4 bg-secondary/30 border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-bold text-foreground">Comparação: {compareReport.title} (v{compareReport.version})</p>
                    <p className="text-[10px] text-muted-foreground">{STATUS_LABELS[compareReport.status]} — {new Date(compareReport.updated_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { setCompareOpen(false); setCompareReport(null); }}>
                    Fechar comparação
                  </Button>
                </div>
                {(() => {
                  const cData = compareSectionsData[activeSection];
                  const currentText = (activeData.manual_content || "").replace(/<[^>]*>/g, "").trim();
                  const compareText = (cData?.manual_content || "").replace(/<[^>]*>/g, "").trim();
                  const changed = currentText !== compareText;
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-card rounded-lg p-3 border border-border">
                        <p className="text-[10px] font-semibold text-foreground mb-1">Versão atual (v{currentReport?.version})</p>
                        <p className="text-xs text-foreground">{currentText || <em className="text-muted-foreground">Sem conteúdo</em>}</p>
                      </div>
                      <div className={`bg-card rounded-lg p-3 border ${changed ? "border-amber-300" : "border-border"}`}>
                        <p className="text-[10px] font-semibold text-foreground mb-1">{compareReport.title} (v{compareReport.version})</p>
                        {changed && <span className="text-[9px] text-amber-600 font-medium">Diferenças detectadas</span>}
                        <p className="text-xs text-foreground">{compareText || <em className="text-muted-foreground">Sem conteúdo</em>}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div key={activeSection}
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="bg-card rounded-xl border border-border shadow-sm">
                {/* Section header */}
                <div className="p-5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-foreground">{activeSec?.title}</h2>
                      <p className="text-xs text-muted-foreground">{activeSec?.description}</p>
                      {activeData.updated_at && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Última atualização: {new Date(activeData.updated_at).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {activeSec?.autoData && <Badge variant="outline" className="text-[10px]">Dados automáticos</Badge>}
                      {ENTRY_SECTIONS.includes(activeSection) && <Badge variant="outline" className="text-[10px]">Lançamento complementar</Badge>}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        activeData.completion_status === "preenchido" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"
                      }`}>
                        {activeData.completion_status === "preenchido" ? "Preenchido" : "Pendente"}
                      </span>
                      {isEditable && (
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleSaveSection(activeSection)} disabled={saving}>
                          {saving ? "Salvando..." : "Salvar"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Auto-data panel */}
                  {activeSec?.autoData && (
                    <div className="rounded-xl bg-secondary/20 border border-primary/10 p-4">
                      <p className="text-[10px] text-primary font-semibold mb-2">DADOS AUTOMÁTICOS — compilados do sistema</p>
                      {isLocked && activeData.auto_snapshot_json && (
                        <p className="text-[9px] text-muted-foreground mb-2">Dados preservados no momento do fechamento (snapshot histórico)</p>
                      )}
                      {autoDataLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Carregando dados do sistema...
                        </div>
                      ) : (
                        <AutoDataPanel
                          autoDataKey={activeSec.autoData}
                          selectedContract={selectedContract}
                          unit={unit} period={period}
                          goalsBySector={goalsBySector} goalSummary={goalSummary}
                          actionPlanSummary={actionPlanSummary} sauSummary={sauSummary}
                          bedSummary={bedSummary} rubricaSummary={rubricaSummary}
                        />
                      )}
                    </div>
                  )}

                  {/* Complementary entry forms */}
                  {ENTRY_SECTIONS.includes(activeSection) && currentReport && (
                    <SectionEntryForms
                      sectionKey={activeSection}
                      reportId={currentReport.id}
                      sectionId={activeData.id}
                      entries={sectionEntries.filter(e => e.section_id === activeData.id)}
                      editable={isEditable}
                      userId={userId}
                      onRefresh={() => loadReportSections(currentReport.id)}
                      onEnsureSection={() => ensureSectionExists(activeSection)}
                    />
                  )}

                  {/* Manual content */}
                  <div>
                    <p className="text-[10px] text-muted-foreground font-semibold mb-2">ANÁLISE E COMPLEMENTO MANUAL</p>
                    {isEditable ? (
                      <RichTextEditor
                        content={activeData.manual_content || ""}
                        onChange={(html) => handleContentChange(activeSection, html)}
                        placeholder={`Adicione análise institucional para "${activeSec?.title}"...`}
                      />
                    ) : (
                      <div className="border border-input rounded-lg p-3 bg-muted/30 prose prose-sm max-w-none text-sm"
                        dangerouslySetInnerHTML={{ __html: activeData.manual_content || "<em>Sem conteúdo manual.</em>" }} />
                    )}
                  </div>

                  {/* Media */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold mb-2">IMAGENS</p>
                      {activeImages.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          {activeImages.map(img => (
                            <div key={img.id} className="relative group rounded-lg overflow-hidden border border-border">
                              <img src={img.file_url} alt={img.file_name} className="w-full h-24 object-cover" />
                              {isEditable && (
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Button variant="destructive" size="sm" className="text-[10px] h-6" onClick={() => handleDeleteAttachment(img.id)}>Remover</Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {isEditable && (
                        <>
                          <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFileUpload(e.target.files, "image")} />
                          <Button variant="outline" size="sm" className="text-xs w-full" onClick={() => imageInputRef.current?.click()} disabled={uploading}>
                            {uploading ? "Enviando..." : "Inserir imagens"}
                          </Button>
                        </>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold mb-2">ANEXOS (PDF, Excel, etc.)</p>
                      {activeFiles.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {activeFiles.map(file => (
                            <div key={file.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20 text-xs">
                              <a href={file.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex-1">
                                {file.file_name}
                              </a>
                              {isEditable && (
                                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-destructive" onClick={() => handleDeleteAttachment(file.id)}>
                                  Remover
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {isEditable && (
                        <>
                          <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.doc,.docx,.csv" multiple className="hidden" onChange={e => handleFileUpload(e.target.files, "document")} />
                          <Button variant="outline" size="sm" className="text-xs w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                            {uploading ? "Enviando..." : "Inserir anexo"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RelatorioAssistencialPage;
