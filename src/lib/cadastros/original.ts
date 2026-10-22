"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeEditarCadastros } from "@/lib/auth";
import { traduzirErro } from "@/lib/erros";

// Cadastros no modelo do AstroTools: salvar e ativar/inativar Clientes e Fornecedores; bloquear fornecedor (só admin).

type Resultado = { ok: true } | { ok: false; erro: string };

async function permitido() {
  const perfil = await getPerfil();
  return perfil.ativo && podeEditarCadastros(perfil.papel);
}

/** "1.234,5" ou "1234.5" → 1234.5 */
const decimal = (v: string) => {
  const t = String(v ?? "").trim();
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) && t !== "" ? n : null;
};

const limpar = (dados: Record<string, string>) => Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v]));

export async function salvarCliente(id: number | null, dados: Record<string, string>): Promise<Resultado> {
  if (!(await permitido())) return { ok: false, erro: "Seu perfil não pode alterar clientes." };
  const faltando = (["cnpj", "razao_social", "nome", "tipo", "metragem", "arquitetura", "gerenciadora", "inicio", "fim"] as const).filter((k) => !dados[k]?.trim());
  if (faltando.length) return { ok: false, erro: "Preencha os campos obrigatórios: CNPJ, Razão Social, Nome Fantasia, Tipo Obra, Metragem, Arquitetura, Gerenciadora, Data Inicio e Data Fim." };
  const registro = {
    ...limpar(dados),
    metragem: decimal(dados.metragem),
    valida_engenharia_nota: dados.valida_engenharia_nota === "1",
    obriga_anexo_oc_nf: dados.obriga_anexo_oc_nf === "1",
  };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("clientes").update(registro).eq("id", id) : await supabase.from("clientes").insert(registro);
  if (error) return { ok: false, erro: error.code === "23505" ? "Já existe um cliente com esse CNPJ." : traduzirErro(error.message) };
  revalidatePath("/clientes");
  return { ok: true };
}

export async function ativarCliente(id: number, ativo: boolean): Promise<Resultado> {
  if (!(await permitido())) return { ok: false, erro: "Seu perfil não pode alterar clientes." };
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update({ ativo }).eq("id", id);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/clientes");
  return { ok: true };
}

export async function salvarFornecedor(id: number | null, dados: Record<string, string>): Promise<Resultado> {
  if (!(await permitido())) return { ok: false, erro: "Seu perfil não pode alterar fornecedores." };
  if (!dados.cpf_cnpj?.trim() || !dados.nome?.trim() || !dados.uf?.trim()) return { ok: false, erro: "Preencha CPF/CNPJ, Nome e UF." };
  const registro = { ...limpar(dados), avaliacao: Number(dados.avaliacao) || 0 };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("fornecedores").update(registro).eq("id", id) : await supabase.from("fornecedores").insert(registro);
  if (error) return { ok: false, erro: error.code === "23505" ? "Já existe um fornecedor com esse CPF/CNPJ." : traduzirErro(error.message) };
  revalidatePath("/fornecedores");
  return { ok: true };
}

export async function ativarFornecedor(id: number, ativo: boolean): Promise<Resultado> {
  if (!(await permitido())) return { ok: false, erro: "Seu perfil não pode alterar fornecedores." };
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").update({ ativo }).eq("id", id);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/fornecedores");
  return { ok: true };
}

/** No original só o Administrador vê o botão de bloquear (Suprimentos apenas consulta). */
export async function bloquearFornecedor(fornecedorId: number, justificativa: string): Promise<Resultado> {
  const perfil = await getPerfil();
  if (!perfil.ativo || perfil.papel !== "admin") return { ok: false, erro: "Só o administrador bloqueia fornecedores." };
  if (!fornecedorId) return { ok: false, erro: "Selecione o fornecedor." };
  if (justificativa.trim().length < 5) return { ok: false, erro: "Descreva a justificativa do bloqueio." };
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedor_bloqueios").insert({ fornecedor_id: fornecedorId, justificativa: justificativa.trim() });
  if (error) return { ok: false, erro: error.code === "23505" ? "Esse fornecedor já está bloqueado." : traduzirErro(error.message) };
  revalidatePath("/fornecedores-bloqueados");
  return { ok: true };
}

export async function desbloquearFornecedor(bloqueioId: number): Promise<Resultado> {
  const perfil = await getPerfil();
  if (!perfil.ativo || perfil.papel !== "admin") return { ok: false, erro: "Só o administrador desbloqueia fornecedores." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("fornecedor_bloqueios")
    .update({ desbloqueado_em: new Date().toISOString(), desbloqueado_por: perfil.id })
    .eq("id", bloqueioId)
    .is("desbloqueado_em", null);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/fornecedores-bloqueados");
  return { ok: true };
}
