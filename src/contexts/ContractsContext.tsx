import { createContext, useContext, useState, ReactNode } from "react";
import { ContractData } from "@/components/contract/types";

const INITIAL_CONTRACTS: ContractData[] = [
  {
    id: "1", name: "Contrato de Gestão — Hospital Geral", value: 12000000, variable: 0.10, goals: 8, status: "Vigente", period: "2024-2025", unit: "Hospital Geral",
    rubricas: [
      { id: "rh", name: "Recursos Humanos", percent: 55 },
      { id: "insumos", name: "Insumos e Materiais", percent: 18 },
      { id: "equip", name: "Equipamentos", percent: 8 },
      { id: "infra", name: "Infraestrutura", percent: 4 },
      { id: "quali", name: "Metas Qualitativas", percent: 5 },
      { id: "quanti", name: "Metas Quantitativas", percent: 10 },
    ],
  },
  {
    id: "2", name: "Contrato de Gestão — UPA Norte", value: 4500000, variable: 0.08, goals: 6, status: "Vigente", period: "2024-2025", unit: "UPA Norte",
    rubricas: [
      { id: "rh", name: "Recursos Humanos", percent: 60 },
      { id: "insumos", name: "Insumos e Materiais", percent: 15 },
      { id: "equip", name: "Equipamentos", percent: 7 },
      { id: "infra", name: "Infraestrutura", percent: 3 },
      { id: "quali", name: "Metas Qualitativas", percent: 5 },
      { id: "quanti", name: "Metas Quantitativas", percent: 10 },
    ],
  },
  {
    id: "3", name: "Contrato de Gestão — UBS Centro", value: 2800000, variable: 0.10, goals: 5, status: "Em renovação", period: "2023-2024", unit: "UBS Centro",
    rubricas: [
      { id: "rh", name: "Recursos Humanos", percent: 65 },
      { id: "insumos", name: "Insumos e Materiais", percent: 12 },
      { id: "equip", name: "Equipamentos", percent: 5 },
      { id: "infra", name: "Infraestrutura", percent: 3 },
      { id: "quali", name: "Metas Qualitativas", percent: 5 },
      { id: "quanti", name: "Metas Quantitativas", percent: 10 },
    ],
  },
];

interface ContractsContextType {
  contracts: ContractData[];
  setContracts: React.Dispatch<React.SetStateAction<ContractData[]>>;
  updateContract: (contract: ContractData) => void;
  addContract: (contract: ContractData) => void;
  deleteContract: (id: string) => void;
}

const ContractsContext = createContext<ContractsContextType | null>(null);

export const ContractsProvider = ({ children }: { children: ReactNode }) => {
  const [contracts, setContracts] = useState<ContractData[]>(INITIAL_CONTRACTS);

  const updateContract = (contract: ContractData) => {
    setContracts(prev => prev.map(c => c.id === contract.id ? contract : c));
  };

  const addContract = (contract: ContractData) => {
    setContracts(prev => [...prev, contract]);
  };

  const deleteContract = (id: string) => {
    setContracts(prev => prev.filter(c => c.id !== id));
  };

  return (
    <ContractsContext.Provider value={{ contracts, setContracts, updateContract, addContract, deleteContract }}>
      {children}
    </ContractsContext.Provider>
  );
};

export const useContracts = () => {
  const ctx = useContext(ContractsContext);
  if (!ctx) throw new Error("useContracts must be used within ContractsProvider");
  return ctx;
};
