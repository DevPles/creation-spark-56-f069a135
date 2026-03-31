export interface Rubrica {
  id: string;
  name: string;
  percent: number;
}

export interface ContractData {
  id: string;
  name: string;
  value: number;
  variable: number;
  goals: number;
  status: string;
  period: string;
  unit: string;
  pdfName?: string;
  pdfUrl?: string;
  rubricas?: Rubrica[];
  notificationEmail?: string;
}

export interface ContractFormModalProps {
  contract: ContractData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (contract: ContractData) => void;
  isNew?: boolean;
}

export const STATUSES = ["Vigente", "Em renovação", "Encerrado"];
export const UNITS_LIST = ["Hospital Geral", "UPA Norte", "UBS Centro"];

export const DEFAULT_RUBRICAS: Rubrica[] = [
  { id: "rh", name: "Recursos Humanos", percent: 0 },
  { id: "insumos", name: "Insumos e Materiais", percent: 0 },
  { id: "equip", name: "Equipamentos", percent: 0 },
  { id: "infra", name: "Infraestrutura", percent: 0 },
  { id: "quali", name: "Metas Qualitativas", percent: 0 },
  { id: "quanti", name: "Metas Quantitativas", percent: 0 },
];
