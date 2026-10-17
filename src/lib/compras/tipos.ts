export type Opcao = { valor: string; rotulo: string };

export type ItemCatalogo = { id: number; codigo: string; descricao: string; unidade: string; valor_medio: number | null };

/** Linha editável de itens (solicitação, mapa ou OC). */
export type LinhaItem = {
  chave: string;
  id?: number;
  titulo?: string | null;
  item_id?: number | null;
  codigo?: string | null;
  descricao: string;
  quantidade: number | string;
  unidade: string;
  valor_medio?: number | string | null;
  valor_unitario?: number | string | null;
};

export const STATUS_SOLICITACAO: Record<string, { rotulo: string; tom: Tom }> = {
  pendente: { rotulo: "Em Solicitação", tom: "alerta" },
  em_cotacao: { rotulo: "Em Cotação", tom: "info" },
  atendida: { rotulo: "Concluída", tom: "ok" },
  cancelada: { rotulo: "Cancelada", tom: "neutro" },
};

export const STATUS_MAPA: Record<string, { rotulo: string; tom: Tom }> = {
  digitacao: { rotulo: "Digitação", tom: "alerta" },
  cotacao: { rotulo: "Cotação", tom: "info" },
  aberto: { rotulo: "Aberto", tom: "info" },
  finalizado: { rotulo: "Finalizado", tom: "ok" },
  cancelado: { rotulo: "Cancelado", tom: "neutro" },
};

export const STATUS_OC: Record<string, { rotulo: string; tom: Tom }> = {
  rascunho: { rotulo: "Rascunho", tom: "neutro" },
  aguardando_aprovacao: { rotulo: "Aguardando aprovação", tom: "alerta" },
  aprovada: { rotulo: "Aprovada", tom: "ok" },
  reprovada: { rotulo: "Reprovada", tom: "erro" },
  cancelada: { rotulo: "Cancelada", tom: "neutro" },
};

export const TIPOS_MAPA: Opcao[] = [
  { valor: "compra", rotulo: "Compra" },
  { valor: "locacao", rotulo: "Locação" },
  { valor: "servico", rotulo: "Serviço" },
];

export type Tom = "ok" | "alerta" | "erro" | "info" | "neutro";

export const numeroOC = (id: number) => `OC-${String(id).padStart(6, "0")}`;
export const numeroSolicitacao = (id: number) => `SC-${String(id).padStart(6, "0")}`;
export const numeroMapa = (id: number) => `MC-${String(id).padStart(6, "0")}`;

export const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
