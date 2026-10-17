import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { catalogoItens } from "@/lib/compras/dados";
import { REGIME_ROTULO, type SolicitacaoResumo } from "@/lib/solicitacoes/dados";
import { compararCodigo } from "@/lib/obras/tipos";
import { AvisoMigracao } from "../aviso";
import { TelaSolicitacao, type Apropriacao, type CcSaldo, type ItemSolicitacao } from "../tela-solicitacao";

export const metadata: Metadata = { title: "Vizualizar Solicitação" };

const NIVEIS_LANCAVEIS = ["CC", "ADM", "I"];

export default async function SolicitacaoPage({ params }: PageProps<"/solicitacoes/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const [perfil, catalogo, { data: s, error }, { data: itens }] = await Promise.all([
    getPerfil(),
    catalogoItens(),
    supabase.from("solicitacoes_resumo").select("*").eq("id", id).maybeSingle(),
    supabase.from("solicitacao_itens").select("*").eq("solicitacao_id", id).order("ordem"),
  ]);
  const cabecalhoPagina = <CabecalhoPagina titulo="Vizualizar Solicitação" migalhas={[{ titulo: "Pedidos", href: "/solicitacoes" }, { titulo: "Pedidos" }]} />;
  if (error) {
    return (
      <>
        {cabecalhoPagina}
        <AvisoMigracao />
      </>
    );
  }
  if (!s) notFound();
  const sol = s as SolicitacaoResumo;

  const idsItens = (itens ?? []).map((i) => i.id as number);
  const [{ data: aprops }, { data: ccs }, { data: outras }, { data: planilhas }] = await Promise.all([
    idsItens.length
      ? supabase.from("apropriacoes_detalhe").select("id, origem_id, cc_codigo, cc_descricao").eq("origem", "solicitacao_item").in("origem_id", idsItens)
      : Promise.resolve({ data: [] as { id: number; origem_id: number; cc_codigo: string; cc_descricao: string }[] }),
    supabase.from("centros_custo_saldos").select("id, planilha_id, codigo, descricao, nivel, orcamento, fechamento").eq("obra_id", sol.obra_id),
    supabase.from("solicitacoes").select("id, servico, criado_em").eq("obra_id", sol.obra_id).neq("id", id).order("id", { ascending: false }),
    supabase.from("planilhas").select("id").eq("obra_id", sol.obra_id).eq("ativo", true),
  ]);
  const ativas = new Set((planilhas ?? []).map((p) => p.id as number));

  const porItem = new Map<number, Apropriacao[]>();
  for (const a of aprops ?? []) porItem.set(a.origem_id, [...(porItem.get(a.origem_id) ?? []), { id: a.id, cc_codigo: a.cc_codigo, cc_descricao: a.cc_descricao }]);

  const lista: ItemSolicitacao[] = (itens ?? []).map((i) => ({
    id: i.id,
    e_titulo: Boolean(i.e_titulo),
    item_id: i.item_id,
    codigo: i.codigo,
    descricao: i.descricao,
    quantidade: Number(i.quantidade),
    unidade: i.unidade,
    valor_medio: i.valor_medio == null ? null : Number(i.valor_medio),
    mapa_item_id: i.mapa_item_id ?? null,
    apropriacoes: porItem.get(i.id) ?? [],
  }));

  // Saldo do CC = Orçamento − Fechamento (a "Meta" do Controle Financeiro), como no original.
  const saldos: CcSaldo[] = ((ccs ?? []) as { id: number; planilha_id: number; codigo: string; descricao: string; nivel: string; orcamento: number; fechamento: number }[])
    .filter((c) => NIVEIS_LANCAVEIS.includes(c.nivel) && ativas.has(c.planilha_id))
    .sort((a, b) => compararCodigo(a.codigo, b.codigo))
    .map((c) => ({ id: c.id, codigo: c.codigo, descricao: c.descricao, saldo: Number(c.orcamento) - Number(c.fechamento) }));

  const podeEditar = perfil.ativo && (sol.solicitante_id === perfil.id || ["admin", "engenharia", "suprimentos"].includes(perfil.papel));
  const chave = `${sol.status}-${lista.map((i) => `${i.id}:${i.apropriacoes.map((a) => a.id).join(".")}:${i.mapa_item_id ?? ""}:${i.quantidade}`).join(",")}`;

  return (
    <>
      {cabecalhoPagina}
      <TelaSolicitacao
        key={chave}
        cabecalho={{
          id: sol.id,
          status: sol.status,
          solicitante: sol.solicitante_nome ?? "",
          obra_id: sol.obra_id,
          obra_rotulo: `${sol.obra_nome} - ${REGIME_ROTULO[sol.obra_regime] ?? sol.obra_regime}`,
          servico: sol.servico,
          observacao: sol.observacao ?? "",
        }}
        itens={lista}
        obras={[]}
        catalogo={catalogo}
        ccs={saldos}
        outras={(outras ?? []) as { id: number; servico: string; criado_em: string }[]}
        podeEditar={podeEditar}
      />
    </>
  );
}
