import type { Tom } from "@/lib/compras/tipos";

export const STATUS_NF: Record<string, { rotulo: string; tom: Tom }> = {
  aguardando_engenharia: { rotulo: "Aguardando engenharia", tom: "alerta" },
  reprovada: { rotulo: "Reprovada", tom: "erro" },
  pendente_pagamento: { rotulo: "Pendente de pagamento", tom: "info" },
  aguardando_guia: { rotulo: "Aguardando guia", tom: "info" },
  em_guia: { rotulo: "Em guia", tom: "alerta" },
  paga: { rotulo: "Paga", tom: "ok" },
  cancelada: { rotulo: "Cancelada", tom: "neutro" },
};

export const STATUS_GUIA: Record<string, { rotulo: string; tom: Tom }> = {
  aberta: { rotulo: "Aberta", tom: "info" },
  enviada: { rotulo: "Enviada ao cliente", tom: "alerta" },
  paga: { rotulo: "Paga pelo cliente", tom: "ok" },
  cancelada: { rotulo: "Cancelada", tom: "neutro" },
};

export const FASES = [
  { valor: "cinza", rotulo: "Fase Cinza — MPH paga o fornecedor" },
  { valor: "azul", rotulo: "Fase Azul — cliente paga direto" },
];

export const numeroGuia = (id: number) => `GA-${String(id).padStart(6, "0")}`;

export type NotaResumo = {
  id: number;
  fase: "cinza" | "azul";
  ordem_compra_id: number;
  obra_id: number;
  fornecedor_id: number;
  numero: string;
  serie: string;
  emissao: string | null;
  vencimento: string;
  valor: number;
  observacao: string | null;
  status: string;
  aprovado_em: string | null;
  aprovado_por_nome: string | null;
  justificativa: string | null;
  pago_em: string | null;
  pago_por_nome: string | null;
  pagamento_forcado: boolean;
  guia_id: number | null;
  criado_em: string;
  obra_codigo: string;
  obra_nome: string;
  cliente_nome: string | null;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  anexos: number;
};

/** Colunas pedidas à visão notas_resumo nas listagens. */
export const SELECT_NOTAS =
  "id, fase, ordem_compra_id, obra_id, fornecedor_id, numero, serie, emissao, vencimento, valor, observacao, status, aprovado_em, aprovado_por_nome, justificativa, pago_em, pago_por_nome, pagamento_forcado, guia_id, criado_em, obra_codigo, obra_nome, cliente_nome, fornecedor_nome, fornecedor_cnpj, anexos";
