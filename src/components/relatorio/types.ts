export interface ReportRecord {
  id: string;
  contract_id: string;
  facility_unit: string;
  reference_month: number;
  reference_year: number;
  version: number;
  status: "rascunho" | "em_revisao" | "fechado" | "exportado";
  title: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface SectionDef {
  key: string;
  title: string;
  description: string;
  order: number;
  autoData?: string;
  custom?: boolean;
}

export interface SectionData {
  id: string | null;
  content: string;
  manual_content: string;
  auto_snapshot_json: any;
  completion_status: string;
  attachments: AttachmentData[];
  updated_by?: string;
  updated_at?: string;
}

export interface AttachmentData {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  sort_order?: number;
}

export interface AutoDataPayload {
  goals?: any[];
  entries?: any[];
  actionPlans?: any[];
  sauRecords?: any[];
  bedMovements?: any[];
  beds?: any[];
  rubricaEntries?: any[];
  contracts?: any[];
  sectors?: any[];
}

export const DEFAULT_SECTIONS: SectionDef[] = [
  { key: "info_contrato", title: "01. Informações do Contrato", description: "Contratante, contratado, CNPJ, unidade gestora, CNES.", order: 1, autoData: "contract" },
  { key: "caract_unidade", title: "02. Caracterização da Unidade", description: "Infraestrutura, serviços terceirizados, especialidades.", order: 2, autoData: "beds" },
  { key: "implantacao_processos", title: "03. Implantação dos Processos", description: "Evolução e melhoria nos processos.", order: 3 },
  { key: "doc_regulatoria", title: "04. Documentação Regulatória", description: "Alvarás, licenças e registros profissionais.", order: 4 },
  { key: "doc_operacional", title: "05. Documentação Operacional", description: "POPs e instruções operacionais.", order: 5 },
  { key: "recursos_humanos", title: "06. Recursos Humanos", description: "Contratações, desligamentos, turnover.", order: 6 },
  { key: "seg_trabalho", title: "07. Segurança do Trabalho", description: "Acidentes e segurança ocupacional.", order: 7 },
  { key: "treinamentos", title: "08. Treinamentos", description: "Horas de treinamento e participantes.", order: 8 },
  { key: "humanizacao", title: "09. Humanização", description: "Ações de humanização e acolhimento.", order: 9 },
  { key: "producao_assistencial", title: "10. Produção Assistencial", description: "Metas por setor, atingimento e produção mensal.", order: 10, autoData: "goals" },
  { key: "indicadores_qualidade", title: "11. Indicadores de Qualidade", description: "SAU, comissões, equipe multidisciplinar.", order: 11, autoData: "sau" },
  { key: "plano_acao", title: "12. Plano de Ação", description: "Tratativas, prazos e status de ação corretiva.", order: 12, autoData: "actionPlans" },
  { key: "indicadores_acompanhamento", title: "13. Indicadores de Acompanhamento", description: "Indicadores de acompanhamento dos serviços.", order: 13, autoData: "goals_trend" },
  { key: "tecnologia_info", title: "14. Tecnologia de Informação", description: "Sistemas, prontuário eletrônico e TI.", order: 14 },
  { key: "servicos_terceirizados", title: "15. Serviços Terceirizados", description: "Serviços terceirizados contratados.", order: 15 },
  { key: "execucao_financeira", title: "16. Execução Financeira", description: "Rubricas, faturamento e execução orçamentária.", order: 16, autoData: "rubricas" },
  { key: "eventos_campanhas", title: "17. Eventos e Campanhas", description: "Eventos e atividades realizadas.", order: 17 },
  { key: "consideracoes_finais", title: "18. Considerações Finais", description: "Conclusões e recomendações.", order: 18 },
];

export const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em Revisão",
  fechado: "Fechado",
  exportado: "Exportado",
};

export const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-amber-100 text-amber-800 border-amber-300",
  em_revisao: "bg-blue-100 text-blue-800 border-blue-300",
  fechado: "bg-emerald-100 text-emerald-800 border-emerald-300",
  exportado: "bg-purple-100 text-purple-800 border-purple-300",
};
