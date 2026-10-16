import { createClient } from "@/lib/supabase/server";
import type { Favorecido } from "./tipos";

export async function opcoesFavorecidos(): Promise<Favorecido[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fornecedores_status")
    .select("id, nome, cpf_cnpj, banco, agencia, conta, banco_cnpj_favorecido, bloqueio_id")
    .eq("ativo", true)
    .order("nome");
  return (data ?? []).map((f) => ({
    valor: String(f.id),
    rotulo: `${f.nome} — ${f.cpf_cnpj}`,
    bloqueado: Boolean(f.bloqueio_id),
    cpf_cnpj: f.banco_cnpj_favorecido || f.cpf_cnpj,
    banco: f.banco,
    agencia: f.agencia,
    conta: f.conta,
  }));
}
