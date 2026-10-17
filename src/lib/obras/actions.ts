"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";
import type { LinhaImportada, ModoPlanilha, Nivel } from "./tipos";

export type Resultado = { ok: true; id?: number } | { ok: false; erro: string };

const falha = (e: { message: string } | null): Resultado | null => (e ? { ok: false, erro: traduzirErro(e.message) } : null);

function revalidar(obraId: number) {
  revalidatePath(`/obras/${obraId}`);
}

export async function importarPlanilha(obraId: number, nome: string, modo: ModoPlanilha, linhas: LinhaImportada[]): Promise<Resultado> {
  if (!linhas.length) return { ok: false, erro: "A planilha não tem linhas válidas." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("importar_planilha", { p_obra_id: obraId, p_nome: nome, p_modo: modo, p_linhas: linhas });
  if (error) return falha(error)!;
  revalidar(obraId);
  return { ok: true, id: Number(data) };
}

export async function editarPlanilha(obraId: number, id: number, dados: { nome: string; modo: ModoPlanilha; ativo: boolean }): Promise<Resultado> {
  if (!dados.nome.trim()) return { ok: false, erro: "Informe o nome da planilha." };
  const supabase = await createClient();
  const { error } = await supabase.from("planilhas").update({ ...dados, nome: dados.nome.trim() }).eq("id", id);
  if (error) return falha(error)!;
  revalidar(obraId);
  return { ok: true };
}

export async function excluirPlanilha(obraId: number, id: number): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.from("planilhas").delete().eq("id", id);
  if (error) return falha(error.message.includes("foreign key") ? { message: "A planilha já tem apropriações ou pagamentos e não pode ser excluída. Desative-a." } : error)!;
  revalidar(obraId);
  return { ok: true };
}

export type DadosCc = { codigo: string; descricao: string; nivel: Nivel; an_financeira: number; orcamento: number };

export async function salvarCc(obraId: number, planilhaId: number, id: number | null, d: DadosCc): Promise<Resultado> {
  if (!d.codigo.trim()) return { ok: false, erro: "Informe o código." };
  const supabase = await createClient();
  const linha = { ...d, codigo: d.codigo.trim(), descricao: d.descricao.trim() };
  const { error } = id
    ? await supabase.from("centros_custo").update(linha).eq("id", id)
    : await supabase.from("centros_custo").insert({ ...linha, planilha_id: planilhaId, obra_id: obraId });
  if (error) return falha(error.code === "23505" ? { message: `Já existe o código ${linha.codigo} nesta planilha.` } : error)!;
  revalidar(obraId);
  return { ok: true };
}

export async function excluirCc(obraId: number, id: number): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.from("centros_custo").delete().eq("id", id);
  if (error) return falha(error.message.includes("foreign key") ? { message: "Este CC já tem apropriações ou pagamentos e não pode ser excluído." } : error)!;
  revalidar(obraId);
  return { ok: true };
}

export async function salvarAlocacao(obraId: number, planilhaId: number, alocacoes: { cc_id: number; valor: number }[]): Promise<Resultado> {
  if (alocacoes.some((a) => !Number.isFinite(a.valor) || a.valor < 0)) return { ok: false, erro: "Os valores alocados não podem ser negativos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("salvar_alocacao", { p_planilha_id: planilhaId, p_alocacoes: alocacoes });
  if (error) return falha(error)!;
  revalidar(obraId);
  return { ok: true };
}

export type DadosPagamentoCliente = {
  planilha_id: number;
  data: string;
  valor: number;
  data_previsao: string | null;
  data_efetivacao: string | null;
  realizado: boolean | null;
  descricao: string;
};

export async function salvarPagamentoCliente(obraId: number, id: number | null, d: DadosPagamentoCliente): Promise<Resultado> {
  if (!d.descricao.trim()) return { ok: false, erro: "Informe a descrição." };
  if (!d.data) return { ok: false, erro: "Informe a data." };
  if (!Number.isFinite(d.valor) || d.valor === 0) return { ok: false, erro: "Informe o valor." };
  const supabase = await createClient();
  const linha = { ...d, descricao: d.descricao.trim() };
  const { error } = id
    ? await supabase.from("pagamentos_cliente").update(linha).eq("id", id)
    : await supabase.from("pagamentos_cliente").insert({ ...linha, obra_id: obraId });
  if (error) return falha(error)!;
  revalidar(obraId);
  return { ok: true };
}

export async function excluirPagamentoCliente(obraId: number, id: number): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.from("pagamentos_cliente").delete().eq("id", id);
  if (error) return falha(error)!;
  revalidar(obraId);
  return { ok: true };
}

export async function adicionarPercentual(obraId: number, planilhaId: number, tipo: "adm" | "imp" | "tot", descricao: string, valor: number): Promise<Resultado> {
  if (!descricao.trim()) return { ok: false, erro: "Informe a descrição." };
  if (!Number.isFinite(valor) || (tipo !== "tot" && valor < 0)) return { ok: false, erro: "Valor inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("planilha_percentuais").insert({ planilha_id: planilhaId, tipo, descricao: descricao.trim(), valor });
  if (error) return falha(error)!;
  revalidar(obraId);
  return { ok: true };
}

export async function excluirPercentual(obraId: number, id: number): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.from("planilha_percentuais").delete().eq("id", id);
  if (error) return falha(error)!;
  revalidar(obraId);
  return { ok: true };
}

export async function adicionarResponsavel(
  obraId: number,
  d: { perfil_id: string; tipo: string; limite_aprovacao_oc: number | null; qtd_aprovacao_oc: number | null },
): Promise<Resultado> {
  if (!d.perfil_id) return { ok: false, erro: "Selecione o usuário." };
  const supabase = await createClient();
  const { error } = await supabase.from("obra_responsaveis").insert({ ...d, obra_id: obraId });
  if (error) return falha(error.code === "23505" ? { message: "Este usuário já é responsável com esse tipo." } : error)!;
  revalidar(obraId);
  return { ok: true };
}

export async function removerResponsavel(obraId: number, id: number): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.from("obra_responsaveis").delete().eq("id", id);
  if (error) return falha(error)!;
  revalidar(obraId);
  return { ok: true };
}

export async function adicionarFilial(obraId: number, clienteId: number): Promise<Resultado> {
  if (!clienteId) return { ok: false, erro: "Selecione o cliente." };
  const supabase = await createClient();
  const { error } = await supabase.from("obra_filiais").insert({ obra_id: obraId, cliente_id: clienteId });
  if (error) return falha(error.code === "23505" ? { message: "Este cliente já está ligado à obra." } : error)!;
  revalidar(obraId);
  return { ok: true };
}

export async function removerFilial(obraId: number, clienteId: number): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.from("obra_filiais").delete().eq("obra_id", obraId).eq("cliente_id", clienteId);
  if (error) return falha(error)!;
  revalidar(obraId);
  return { ok: true };
}

/** Campos da obra editáveis no modal "Editar Planilha" do original. */
export type CamposObra = {
  inicio: string | null;
  termino: string | null;
  entrega_prevista: string | null;
  ano: number | null;
  tipo_obra: string | null;
  metragem: number | null;
  status_complementar: string | null;
  as_built_em: string | null;
  diretor: string | null;
  coordenador: string | null;
  engenheiro: string | null;
  arquitetura: string | null;
  gerenciadora: string | null;
  orcamentista: string | null;
  suprimento: string | null;
};

export async function editarPlanilhaObra(obraId: number, planilhaId: number, nomeNovo: string, obra: CamposObra): Promise<Resultado> {
  const supabase = await createClient();
  if (nomeNovo.trim()) {
    const { error } = await supabase.from("planilhas").update({ nome: nomeNovo.trim() }).eq("id", planilhaId);
    if (error) return falha(error)!;
  }
  const { error } = await supabase.from("obras").update(obra).eq("id", obraId);
  if (error) return falha(error)!;
  revalidar(obraId);
  revalidatePath("/obras");
  return { ok: true };
}
