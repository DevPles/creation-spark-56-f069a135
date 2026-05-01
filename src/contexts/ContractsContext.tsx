import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { ContractData, Rubrica } from "@/components/contract/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContractsContextType {
  contracts: ContractData[];
  loading: boolean;
  setContracts: React.Dispatch<React.SetStateAction<ContractData[]>>;
  updateContract: (contract: ContractData) => void;
  addContract: (contract: ContractData) => void;
  deleteContract: (id: string) => void;
  refresh: () => void;
}

const ContractsContext = createContext<ContractsContextType | null>(null);

const mapRowToContract = (row: any): ContractData => ({
  id: row.id,
  name: row.name,
  value: Number(row.value),
  variable: Number(row.variable),
  goals: row.goals,
  status: row.status,
  period: row.period,
  unit: row.unit,
  pdfName: row.pdf_name || undefined,
  pdfUrl: row.pdf_url || undefined,
  notificationEmail: row.notification_email || undefined,
  cnes: row.cnes || undefined,
  rubricas: (row.rubricas as Rubrica[]) || [],
});

export const ContractsProvider = ({ children }: { children: ReactNode }) => {
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching contracts:", error);
      toast.error("Erro ao carregar contratos");
    } else {
      setContracts((data || []).map(mapRowToContract));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const updateContract = async (contract: ContractData) => {
    const { error } = await supabase.from("contracts").update({
      name: contract.name,
      value: contract.value,
      variable: contract.variable,
      goals: contract.goals,
      status: contract.status,
      period: contract.period,
      unit: contract.unit,
      pdf_name: contract.pdfName || null,
      pdf_url: contract.pdfUrl || null,
      notification_email: contract.notificationEmail || null,
      cnes: contract.cnes || null,
      rubricas: contract.rubricas as any || [],
    }).eq("id", contract.id);

    if (error) {
      console.error(error);
      toast.error("Erro ao atualizar contrato");
    } else {
      setContracts(prev => prev.map(c => c.id === contract.id ? contract : c));
      toast.success("Contrato atualizado");
    }
  };

  const addContract = async (contract: ContractData) => {
    const { data, error } = await supabase.from("contracts").insert({
      name: contract.name,
      value: contract.value,
      variable: contract.variable,
      goals: contract.goals,
      status: contract.status,
      period: contract.period,
      unit: contract.unit,
      pdf_name: contract.pdfName || null,
      pdf_url: contract.pdfUrl || null,
      notification_email: contract.notificationEmail || null,
      cnes: contract.cnes || null,
      rubricas: contract.rubricas as any || [],
    }).select().single();

    if (error) {
      console.error(error);
      toast.error("Erro ao criar contrato");
    } else if (data) {
      setContracts(prev => [...prev, mapRowToContract(data)]);
      toast.success("Contrato criado");
    }
  };

  const deleteContract = async (id: string) => {
    const { error } = await supabase.from("contracts").delete().eq("id", id);
    if (error) {
      console.error(error);
      toast.error("Erro ao excluir contrato");
    } else {
      setContracts(prev => prev.filter(c => c.id !== id));
      toast.success("Contrato excluído");
    }
  };

  return (
    <ContractsContext.Provider value={{ contracts, loading, setContracts, updateContract, addContract, deleteContract, refresh: fetchContracts }}>
      {children}
    </ContractsContext.Provider>
  );
};

export const useContracts = () => {
  const ctx = useContext(ContractsContext);
  if (!ctx) throw new Error("useContracts must be used within ContractsProvider");
  return ctx;
};
