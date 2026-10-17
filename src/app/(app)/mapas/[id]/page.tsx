import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeComprar } from "@/lib/auth";
import { catalogoItens, opcoesFornecedores } from "@/lib/compras/dados";
import { apropriacoesPorItem, ccsComSaldo, type MapaResumo } from "@/lib/mapas/dados";
import { REGIME_ROTULO } from "@/lib/solicitacoes/dados";
import { AvisoMapas } from "../aviso";
import { TelaMapa, type ItemMapa } from "../tela-mapa";
import type { FornecedorMapa } from "../grade-cotacao";

export const metadata: Metadata = { title: "Vizualizar Mapa" };

export default async function MapaPage({ params }: PageProps<"/mapas/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const [perfil, { data: m, error }, { data: itens }, { data: forn }, { data: arquivos }] = await Promise.all([
    getPerfil(),
    supabase.from("mapas_resumo").select("*").eq("id", id).maybeSingle(),
    supabase.from("mapa_itens").select("*").eq("mapa_id", id).order("ordem"),
    supabase.from("mapa_fornecedores").select("*, fornecedor:fornecedores(nome)").eq("mapa_id", id).order("id"),
    supabase.from("mapa_arquivos").select("id, nome, enviado_em").eq("mapa_id", id).order("enviado_em"),
  ]);
  const topo = <CabecalhoPagina titulo="Vizualizar Mapa" migalhas={[{ titulo: "Pedidos", href: "/mapas" }, { titulo: "Mapas" }]} />;
  if (error) {
    return (
      <>
        {topo}
        <AvisoMapas />
      </>
    );
  }
  if (!m) notFound();
  const mapa = m as MapaResumo;

  const ids = (itens ?? []).map((i) => i.id as number);
  const [aprops, ccs, catalogo, opcoesForn, { data: precos }, { data: ocItens }, { data: solicitacoes }] = await Promise.all([
    apropriacoesPorItem("mapa_item", ids),
    ccsComSaldo(mapa.obra_id),
    catalogoItens(),
    opcoesFornecedores(),
    ids.length ? supabase.from("mapa_precos").select("mapa_item_id, fornecedor_id, valor_unitario").in("mapa_item_id", ids) : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("oc_itens").select("mapa_item_id, oc:ordens_compra!inner(status)").in("mapa_item_id", ids).neq("oc.status", "cancelada")
      : Promise.resolve({ data: [] }),
    supabase.from("solicitacoes").select("id, servico, criado_em").eq("obra_id", mapa.obra_id).order("id", { ascending: false }),
  ]);

  const comPedido = new Set(((ocItens ?? []) as { mapa_item_id: number }[]).map((o) => o.mapa_item_id));
  const lista: ItemMapa[] = (itens ?? []).map((i) => ({
    id: i.id,
    e_titulo: Boolean(i.e_titulo),
    item_id: i.item_id,
    codigo: i.codigo,
    descricao: i.descricao,
    quantidade: Number(i.quantidade),
    unidade: i.unidade,
    valor_medio: i.valor_medio == null ? null : Number(i.valor_medio),
    apropriacoes: aprops.get(i.id) ?? [],
    comPedido: comPedido.has(i.id),
  }));
  const fornecedores: FornecedorMapa[] = ((forn ?? []) as unknown as {
    fornecedor_id: number;
    frete: number;
    impostos: number;
    desconto: number;
    condicao_pagamento: string | null;
    prazo_entrega: string | null;
    observacao: string | null;
    fornecedor: { nome: string } | null;
  }[]).map((f) => ({
    fornecedor_id: f.fornecedor_id,
    nome: f.fornecedor?.nome ?? String(f.fornecedor_id),
    frete: Number(f.frete),
    impostos: Number(f.impostos ?? 0),
    desconto: Number(f.desconto ?? 0),
    condicao_pagamento: f.condicao_pagamento ?? "",
    prazo_entrega: f.prazo_entrega ?? "",
    observacao: f.observacao ?? "",
  }));
  const mapaPrecos = Object.fromEntries(((precos ?? []) as { mapa_item_id: number; fornecedor_id: number; valor_unitario: number }[]).map((p) => [`${p.mapa_item_id}-${p.fornecedor_id}`, Number(p.valor_unitario)]));
  const chave = `${mapa.status}-${mapa.regularizacao_engenharia}-${lista.map((i) => `${i.id}:${i.apropriacoes.map((a) => a.id).join(".")}:${i.quantidade}`).join(",")}`;

  return (
    <>
      {topo}
      <TelaMapa
        key={chave}
        cabecalho={{
          id: mapa.id,
          status: mapa.status,
          solicitante: mapa.solicitante_nome ?? "",
          obra_id: mapa.obra_id,
          obra_rotulo: `${mapa.obra_nome} - ${REGIME_ROTULO[mapa.obra_regime] ?? mapa.obra_regime}`,
          numero_cliente: mapa.numero_cliente,
          regularizacao_engenharia: mapa.regularizacao_engenharia,
          dados: {
            obra_id: String(mapa.obra_id),
            servico: mapa.servico,
            apropriacao: mapa.apropriacao ?? "",
            observacao: mapa.observacao ?? "",
            tipo: mapa.tipo ?? "",
            data_entrega: mapa.data_entrega ?? "",
            prazo_locacao: mapa.prazo_locacao ?? "",
            data_devolucao: mapa.data_devolucao ?? "",
          },
        }}
        itens={lista}
        obras={[]}
        catalogo={catalogo}
        ccs={ccs}
        fornecedores={fornecedores}
        opcoesFornecedores={opcoesForn}
        precos={mapaPrecos}
        arquivos={(arquivos ?? []) as { id: number; nome: string; enviado_em: string }[]}
        solicitacoesObra={(solicitacoes ?? []) as { id: number; servico: string; criado_em: string }[]}
        podeMontar={perfil.ativo && ["admin", "engenharia", "suprimentos"].includes(perfil.papel)}
        podeCotar={perfil.ativo && podeComprar(perfil.papel)}
      />
    </>
  );
}
