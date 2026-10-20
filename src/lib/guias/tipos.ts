// Guias de Envio e Guias Adm (Fase Azul) — tipos compartilhados entre servidor e telas.

export type Guia = {
  id: number;
  obra_id: number;
  obra_nome: string;
  numero: number;
  tipo: "normal" | "adm";
  valor: number;
  controle_parcela: string | null;
  conta_faturamento: string | null;
  vencimento: string | null;
  tipo_documento: string | null;
  tipo_pagamento: string | null;
  pago: boolean;
  data_pagamento: string | null;
  guia_adm_id: number | null;
  guia_adm_numero: number | null;
};

/** Linha de rateio (nota × CC) de um lançamento da Fase Azul. */
export type LinhaGuia = {
  rateio_id: number;
  item_id: number | null;
  guia_id: number | null;
  nota_id: number;
  numero: string;
  tipo_documento: string | null;
  tipo_pagamento: string | null;
  vencimento: string;
  valor: number;
  cc_codigo: string;
  pedido: number | null;
  pedido_cliente: number | null;
  pedido_nome: string | null;
  fornecedor_nome: string;
  favorecido_cpf_cnpj: string | null;
  favorecido: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  anexos: { id: number; nome: string; criado_em: string }[];
};

export type CalculoAdm = {
  planilha_id: number;
  planilha_nome: string;
  taxa_adm: number;
  taxa_imp: number;
  base: number;
  administracao: number;
  imposto: number;
  cc_adm: string | null;
  cc_imp: string | null;
};

export const n2 = (v: number) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const real = (v: number) => `R$ ${n2(v)}`;
