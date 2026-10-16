import type { Tom } from "@/lib/compras/tipos";

export const STATUS_REEMBOLSO: Record<string, { rotulo: string; tom: Tom }> = {
  rascunho: { rotulo: "Rascunho", tom: "neutro" },
  aguardando_aprovacao: { rotulo: "Aguardando engenharia", tom: "alerta" },
  aprovada: { rotulo: "Aprovado · a pagar", tom: "info" },
  reprovada: { rotulo: "Reprovado", tom: "erro" },
  paga: { rotulo: "Pago", tom: "ok" },
  cancelada: { rotulo: "Cancelado", tom: "neutro" },
};

export const numeroReembolso = (id: number) => `OR-${String(id).padStart(6, "0")}`;

export type ReembolsoResumo = {
  id: number;
  obra_id: number;
  obra_codigo: string;
  obra_nome: string;
  cliente_nome: string | null;
  filial: string | null;
  fornecedor_id: number;
  fornecedor_nome: string;
  cpf_cnpj: string;
  banco: string;
  agencia: string;
  conta: string;
  observacao: string | null;
  status: string;
  aprovado_por_nome: string | null;
  aprovado_em: string | null;
  justificativa: string | null;
  pago_em: string | null;
  pago_por_nome: string | null;
  pagamento_forcado: boolean;
  criado_por: string | null;
  criado_por_nome: string | null;
  criado_em: string;
  atualizado_em: string;
  valor_total: number;
  qtd_itens: number;
};

/** Favorecido com dados bancários para preencher o reembolso. */
export type Favorecido = {
  valor: string;
  rotulo: string;
  bloqueado: boolean;
  cpf_cnpj: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
};
