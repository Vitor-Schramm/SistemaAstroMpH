"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeEditarCadastros } from "@/lib/auth";
import { validarCpfCnpj } from "@/lib/format";
import { ENTIDADES, type Campo } from "./config";

export type SalvarState = { ok?: boolean; erro?: string; erros?: Record<string, string>; nonce?: number };

function converter(campo: Campo, bruto: FormDataEntryValue | null): { valor: unknown; erro?: string } {
  if (campo.tipo === "boolean") return { valor: bruto === "on" || bruto === "true" };

  const texto = typeof bruto === "string" ? bruto.trim() : "";
  if (!texto) return campo.obrigatorio ? { valor: null, erro: "Obrigatório" } : { valor: null };

  switch (campo.tipo) {
    case "number": {
      // <input type="number"> já envia o decimal com ponto.
      const n = Number(texto.replace(",", "."));
      return Number.isFinite(n) ? { valor: n } : { valor: null, erro: "Número inválido" };
    }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto) ? { valor: texto } : { valor: null, erro: "E-mail inválido" };
    case "select":
      if (campo.relacao) return { valor: Number(texto) };
      if (campo.opcoes && !campo.opcoes.some((o) => o.valor === texto)) return { valor: null, erro: "Opção inválida" };
      return { valor: texto };
    default:
      if ((campo.mascara === "cpf_cnpj" || campo.mascara === "cnpj") && !validarCpfCnpj(texto)) {
        return { valor: null, erro: campo.mascara === "cnpj" ? "CNPJ inválido" : "CPF/CNPJ inválido" };
      }
      return { valor: texto };
  }
}

function mensagemErroBanco(code?: string, message?: string) {
  if (code === "23505") return "Já existe um registro com esse valor (campo único).";
  if (code === "23503") return "Registro está em uso por outro cadastro.";
  if (code === "42501") return "Seu perfil não tem permissão para esta ação.";
  return message ?? "Erro ao salvar.";
}

async function garantirPermissao() {
  const perfil = await getPerfil();
  if (!perfil.ativo || !podeEditarCadastros(perfil.papel)) throw new Error("Seu perfil não tem permissão para editar cadastros.");
  return perfil;
}

export async function salvarRegistro(chave: string, _prev: SalvarState, formData: FormData): Promise<SalvarState> {
  const ent = ENTIDADES[chave];
  if (!ent) return { erro: "Cadastro desconhecido." };
  try {
    await garantirPermissao();
  } catch (e) {
    return { erro: (e as Error).message };
  }

  const registro: Record<string, unknown> = {};
  const erros: Record<string, string> = {};
  for (const campo of ent.campos) {
    const { valor, erro } = converter(campo, formData.get(campo.nome));
    if (erro) erros[campo.nome] = erro;
    registro[campo.nome] = valor;
  }
  if (Object.keys(erros).length) return { erro: "Corrija os campos destacados.", erros };

  const supabase = await createClient();
  const id = Number(formData.get("id")) || null;
  const { error } = id
    ? await supabase.from(ent.tabela).update(registro).eq("id", id)
    : await supabase.from(ent.tabela).insert(registro);
  if (error) return { erro: mensagemErroBanco(error.code, error.message) };

  revalidatePath(`/${chave}`);
  return { ok: true, nonce: Date.now() };
}

export async function alternarAtivo(chave: string, id: number, ativo: boolean) {
  const ent = ENTIDADES[chave];
  await garantirPermissao();
  const supabase = await createClient();
  const { error } = await supabase.from(ent.tabela).update({ ativo }).eq("id", id);
  if (error) throw new Error(mensagemErroBanco(error.code, error.message));
  revalidatePath(`/${chave}`);
}

export async function excluirRegistro(chave: string, id: number) {
  const ent = ENTIDADES[chave];
  const perfil = await getPerfil();
  if (perfil.papel !== "admin") throw new Error("Só administradores podem excluir.");
  const supabase = await createClient();
  const { error, count } = await supabase.from(ent.tabela).delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(mensagemErroBanco(error.code, error.message));
  if (!count) throw new Error("Registro não encontrado ou sem permissão.");
  revalidatePath(`/${chave}`);
}
