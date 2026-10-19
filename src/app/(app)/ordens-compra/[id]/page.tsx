import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { catalogoItens } from "@/lib/compras/dados";
import { ccsComSaldo } from "@/lib/mapas/dados";
import { REGIME_ROTULO } from "@/lib/solicitacoes/dados";
import type { OcResumo } from "@/lib/ocs/dados";
import { AvisoOcs } from "../aviso";
import { TelaOc, type AproOc, type ItemOc, type NotaOc } from "../tela-oc";

export const metadata: Metadata = { title: "Vizualizar Ordem" };

export default async function OcPage({ params }: PageProps<"/ordens-compra/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const [perfil, catalogo, { data: r, error }, { data: oc }, { data: itens }, { data: aprops }, { data: notas }, { data: arquivos }, { data: just }] = await Promise.all([
    getPerfil(),
    catalogoItens(),
    supabase.from("ocs_resumo").select("*").eq("id", id).maybeSingle(),
    supabase.from("ordens_compra").select("*, filial:clientes!filial_cliente_id(nome)").eq("id", id).maybeSingle(),
    supabase.from("oc_itens").select("*, item:itens(valor_medio)").eq("ordem_compra_id", id).order("ordem"),
    supabase.from("apropriacoes_detalhe").select("id, cc_codigo, cc_descricao, valor, saldo_ref").eq("origem", "oc").eq("origem_id", id).order("id"),
    supabase.from("notas_resumo").select("id, numero, serie, valor, pago_em, status, fase, fornecedor_nome, pago_por_nome, vencimento, guia_id").eq("ordem_compra_id", id).neq("status", "cancelada"),
    supabase.from("oc_arquivos").select("id, nome, enviado_em").eq("ordem_compra_id", id).order("enviado_em"),
    supabase.from("oc_justificativas").select("id, status, justificativa, criado_em, usuario:perfis(nome)").eq("ordem_compra_id", id).order("criado_em"),
  ]);
  const topo = <CabecalhoPagina titulo="Vizualizar Ordem" migalhas={[{ titulo: "Ordens Compra", href: "/ordens-compra" }]} />;
  if (error) {
    return (
      <>
        {topo}
        <AvisoOcs />
      </>
    );
  }
  if (!r || !oc) notFound();
  const res = r as OcResumo;
  const ccs = await ccsComSaldo(res.obra_id);

  const lista: ItemOc[] = ((itens ?? []) as unknown as (ItemOc & { item: { valor_medio: number | null } | null })[]).map((i) => ({
    id: i.id,
    e_titulo: Boolean(i.e_titulo),
    item_id: i.item_id,
    codigo: i.codigo,
    descricao: i.descricao,
    quantidade: Number(i.quantidade),
    unidade: i.unidade,
    valor_unitario: Number(i.valor_unitario),
    valor_impostos: Number(i.valor_impostos ?? 0),
    valor_medio: i.item?.valor_medio == null ? null : Number(i.item.valor_medio),
  }));
  const s = (v: unknown) => (v == null ? "" : String(v));
  const complemento = Object.fromEntries(
    [
      "contrato_tipo",
      "contrato_inicio",
      "contrato_termino",
      "contrato_datas_pagamento",
      "contrato_info",
      "entrega_cep",
      "entrega_endereco",
      "entrega_numero",
      "entrega_complemento",
      "entrega_responsavel",
      "entrega_telefone",
      "entrega_contato_mestre",
      "entrega_telefone_mestre",
      "entrega_bairro",
      "entrega_cidade",
      "entrega_uf",
    ].map((k) => [k, s((oc as Record<string, unknown>)[k])]),
  );
  const chave = `${res.status}-${res.total_apropriado}-${lista.map((i) => `${i.id}:${i.quantidade}:${i.valor_unitario}:${i.valor_impostos}`).join(",")}`;

  return (
    <>
      {topo}
      <TelaOc
        key={chave}
        cabecalho={{
          id,
          numero_cliente: res.numero_cliente,
          mapa_id: res.mapa_id,
          status: res.status,
          pendencia: res.pendencia,
          regularizacao_engenharia: res.regularizacao_engenharia,
          obra_rotulo: `${res.obra_nome} - ${REGIME_ROTULO[res.obra_regime] ?? res.obra_regime}`,
          filial: (oc.filial as { nome: string } | null)?.nome ?? "",
          fornecedor_rotulo: res.fornecedor_fantasia ? `${res.fornecedor_fantasia} | ${res.fornecedor_nome}` : res.fornecedor_nome,
          percentual_especial: oc.percentual_especial == null ? null : Number(oc.percentual_especial),
          frete: Number(oc.frete ?? 0),
          desconto: Number(oc.desconto ?? 0),
          total_apropriado: Number(res.total_apropriado),
          total_pago: Number(res.total_pago),
          dados: {
            nome: s(oc.nome),
            numero_cliente: s(oc.numero_cliente),
            observacao: s(oc.observacao),
            tipo: s(oc.tipo),
            data_entrega: s(oc.data_entrega),
            prazo_locacao: s(oc.prazo_locacao),
            data_devolucao: s(oc.data_devolucao),
            forma_pagamento: s(oc.condicao_pagamento),
            prazo: s(oc.prazo_entrega),
          },
          complemento,
        }}
        itens={lista}
        aprops={(aprops ?? []) as AproOc[]}
        ccs={ccs}
        notas={((notas ?? []) as { id: number; numero: string; serie: string; valor: number; pago_em: string | null; status: string; fase: string; fornecedor_nome: string; pago_por_nome: string | null; vencimento: string; guia_id: number | null }[]).map(
          (n): NotaOc => ({
            id: n.id,
            numero: n.numero,
            serie: n.serie,
            valor: Number(n.valor),
            pago_em: n.pago_em,
            status: n.status,
            fase: n.fase,
            fornecedor: n.fornecedor_nome,
            usuario: n.pago_por_nome ?? "",
            vencimento: n.vencimento,
            guia: n.guia_id,
          }),
        )}
        arquivos={(arquivos ?? []) as { id: number; nome: string; enviado_em: string }[]}
        justificativas={((just ?? []) as unknown as { id: number; status: string; justificativa: string; criado_em: string; usuario: { nome: string } | null }[]).map((j) => ({
          id: j.id,
          status: j.status,
          justificativa: j.justificativa,
          responsavel: j.usuario?.nome ?? "",
          criado_em: j.criado_em,
        }))}
        catalogo={catalogo}
        podeEditar={perfil.ativo && ["admin", "engenharia", "suprimentos"].includes(perfil.papel)}
      />
    </>
  );
}
