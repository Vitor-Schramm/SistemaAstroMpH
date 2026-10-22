import type { Tom } from "@/lib/compras/tipos";

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

// ============================================================
// Ordem de Reembolso no modelo do AstroTools (migração 0014)
// ============================================================

export type ReembolsoLista = {
  id: number;
  obra_id: number;
  obra_nome: string;
  obra_regime: string;
  cliente_id: number | null;
  cliente_nome: string | null;
  filial_cliente_id: number | null;
  fornecedor_id: number;
  fornecedor_nome: string;
  fornecedor_fantasia: string | null;
  cpf_cnpj: string;
  banco: string;
  agencia: string;
  conta: string;
  observacao: string | null;
  solicitacao_enviada: boolean;
  enviada_em: string | null;
  criado_em: string;
  valor_total: number;
  apropriado: number;
};

export type ItemReembolsoOriginal = { id: number; descricao: string; apropriacao: string | null; tipo: string | null; data: string | null; valor: number };
export type AproReembolso = { id: number; cc_codigo: string; cc_descricao: string; valor: number; saldo_ref: number | null };
export type ArquivoReembolso = { id: number; nome: string; enviado_em: string };
export type FornecedorReembolso = { valor: string; rotulo: string; cpf_cnpj: string; banco: string; agencia: string; conta: string };
