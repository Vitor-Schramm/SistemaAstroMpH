import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { catalogoItens, opcoesObras } from "@/lib/compras/dados";
import { getPerfil, podeComprar } from "@/lib/auth";
import type { LinhaItem } from "@/lib/compras/tipos";
import { SolicitacaoForm } from "../solicitacao-form";

export default async function SolicitacaoPage({ params }: PageProps<"/solicitacoes/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const [perfil, obras, catalogo, { data: s }] = await Promise.all([
    getPerfil(),
    opcoesObras(),
    catalogoItens(),
    supabase.from("solicitacoes").select("*, itens:solicitacao_itens(*)").eq("id", id).maybeSingle(),
  ]);
  if (!s) notFound();

  const itens: LinhaItem[] = [...(s.itens ?? [])]
    .sort((a, b) => a.ordem - b.ordem)
    .map((i) => ({ ...i, chave: `i${i.id}` }));

  const compras = perfil.ativo && podeComprar(perfil.papel);
  const editavel = s.status === "pendente" && (compras || s.solicitante_id === perfil.id);

  // A obra pode estar inativa: garante que apareça no select.
  const obraAtual = String(s.obra_id);
  const opcoes = obras.some((o) => o.valor === obraAtual) ? obras : [...obras, { valor: obraAtual, rotulo: `Obra #${obraAtual}` }];

  return (
    <SolicitacaoForm
      id={id}
      status={s.status}
      inicial={{ obra_id: obraAtual, servico: s.servico, observacao: s.observacao ?? "" }}
      itensIniciais={itens}
      obras={opcoes}
      catalogo={catalogo}
      editavel={editavel}
      podeGerarMapa={compras && s.status === "pendente"}
    />
  );
}
