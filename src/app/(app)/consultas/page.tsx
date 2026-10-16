import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { opcoesFornecedores, opcoesObras } from "@/lib/compras/dados";
import { numeroOC, STATUS_OC } from "@/lib/compras/tipos";
import { STATUS_NF } from "@/lib/notas/tipos";
import { numeroReembolso, STATUS_REEMBOLSO } from "@/lib/reembolsos/tipos";
import { ConsultaView, type Coluna, type Linha } from "./view";

export const metadata: Metadata = { title: "Consultas" };

const TIPOS = {
  ocs: "Ordens de compra",
  notas: "Notas fiscais",
  reembolsos: "Ordens de reembolso",
  pagamentos: "Pagamentos realizados",
} as const;
type Tipo = keyof typeof TIPOS;

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function ConsultasPage({ searchParams }: PageProps<"/consultas">) {
  const sp = await searchParams;
  const filtros = {
    tipo: (str(sp.tipo) in TIPOS ? str(sp.tipo) : "") as Tipo | "",
    obra: str(sp.obra),
    fornecedor: str(sp.fornecedor),
    de: str(sp.de),
    ate: str(sp.ate),
    status: str(sp.status),
  };

  const [obras, fornecedores] = await Promise.all([opcoesObras(), opcoesFornecedores()]);
  let colunas: Coluna[] = [];
  let linhas: Linha[] = [];
  let limite = false;

  if (filtros.tipo) {
    const supabase = await createClient();
    const LIM = 5000;

    if (filtros.tipo === "ocs") {
      let q = supabase.from("ordens_compra_resumo").select("id, data_emissao, obra_codigo, obra_nome, fornecedor_nome, engenheiro_responsavel, valor_total, status");
      if (filtros.obra) q = q.eq("obra_id", filtros.obra);
      if (filtros.fornecedor) q = q.eq("fornecedor_id", filtros.fornecedor);
      if (filtros.de) q = q.gte("data_emissao", filtros.de);
      if (filtros.ate) q = q.lte("data_emissao", filtros.ate);
      if (filtros.status) q = q.eq("status", filtros.status);
      const { data } = await q.order("data_emissao", { ascending: false }).limit(LIM);
      colunas = [
        { chave: "numero", rotulo: "OC" },
        { chave: "data", rotulo: "Emissão", tipo: "data" },
        { chave: "obra", rotulo: "Obra" },
        { chave: "fornecedor", rotulo: "Fornecedor" },
        { chave: "engenheiro", rotulo: "Engenheiro" },
        { chave: "valor", rotulo: "Valor", tipo: "moeda" },
        { chave: "status", rotulo: "Status" },
      ];
      linhas = (data ?? []).map((r) => ({
        href: `/ordens-compra/${r.id}`,
        numero: numeroOC(r.id),
        data: r.data_emissao,
        obra: `${r.obra_codigo} — ${r.obra_nome}`,
        fornecedor: r.fornecedor_nome,
        engenheiro: r.engenheiro_responsavel ?? "",
        valor: Number(r.valor_total),
        status: STATUS_OC[r.status]?.rotulo ?? r.status,
      }));
      limite = (data?.length ?? 0) >= LIM;
    }

    if (filtros.tipo === "notas") {
      let q = supabase
        .from("notas_resumo")
        .select("id, numero, serie, fase, emissao, vencimento, obra_codigo, obra_nome, fornecedor_nome, ordem_compra_id, valor, status, pago_em");
      if (filtros.obra) q = q.eq("obra_id", filtros.obra);
      if (filtros.fornecedor) q = q.eq("fornecedor_id", filtros.fornecedor);
      if (filtros.de) q = q.gte("vencimento", filtros.de);
      if (filtros.ate) q = q.lte("vencimento", filtros.ate);
      if (filtros.status) q = q.eq("status", filtros.status);
      const { data } = await q.order("vencimento", { ascending: false }).limit(LIM);
      colunas = [
        { chave: "numero", rotulo: "Nota" },
        { chave: "fase", rotulo: "Fase" },
        { chave: "data", rotulo: "Vencimento", tipo: "data" },
        { chave: "obra", rotulo: "Obra" },
        { chave: "fornecedor", rotulo: "Fornecedor" },
        { chave: "oc", rotulo: "OC" },
        { chave: "valor", rotulo: "Valor", tipo: "moeda" },
        { chave: "status", rotulo: "Status" },
        { chave: "pago_em", rotulo: "Pago em", tipo: "data" },
      ];
      linhas = (data ?? []).map((r) => ({
        href: `/notas/${r.id}`,
        numero: `${r.numero}/${r.serie}`,
        fase: r.fase === "azul" ? "Azul" : "Cinza",
        data: r.vencimento,
        obra: `${r.obra_codigo} — ${r.obra_nome}`,
        fornecedor: r.fornecedor_nome,
        oc: numeroOC(r.ordem_compra_id),
        valor: Number(r.valor),
        status: STATUS_NF[r.status]?.rotulo ?? r.status,
        pago_em: r.pago_em ?? "",
      }));
      limite = (data?.length ?? 0) >= LIM;
    }

    if (filtros.tipo === "reembolsos") {
      let q = supabase.from("reembolsos_resumo").select("id, criado_em, obra_codigo, obra_nome, fornecedor_nome, criado_por_nome, valor_total, status, pago_em");
      if (filtros.obra) q = q.eq("obra_id", filtros.obra);
      if (filtros.fornecedor) q = q.eq("fornecedor_id", filtros.fornecedor);
      if (filtros.de) q = q.gte("criado_em", filtros.de);
      if (filtros.ate) q = q.lte("criado_em", `${filtros.ate}T23:59:59`);
      if (filtros.status) q = q.eq("status", filtros.status);
      const { data } = await q.order("criado_em", { ascending: false }).limit(LIM);
      colunas = [
        { chave: "numero", rotulo: "Nº" },
        { chave: "data", rotulo: "Criado em", tipo: "data" },
        { chave: "obra", rotulo: "Obra" },
        { chave: "fornecedor", rotulo: "Favorecido" },
        { chave: "solicitante", rotulo: "Solicitante" },
        { chave: "valor", rotulo: "Valor", tipo: "moeda" },
        { chave: "status", rotulo: "Status" },
        { chave: "pago_em", rotulo: "Pago em", tipo: "data" },
      ];
      linhas = (data ?? []).map((r) => ({
        href: `/ordens-reembolso/${r.id}`,
        numero: numeroReembolso(r.id),
        data: String(r.criado_em).slice(0, 10),
        obra: `${r.obra_codigo} — ${r.obra_nome}`,
        fornecedor: r.fornecedor_nome,
        solicitante: r.criado_por_nome ?? "",
        valor: Number(r.valor_total),
        status: STATUS_REEMBOLSO[r.status]?.rotulo ?? r.status,
        pago_em: r.pago_em ?? "",
      }));
      limite = (data?.length ?? 0) >= LIM;
    }

    if (filtros.tipo === "pagamentos") {
      let qn = supabase
        .from("notas_resumo")
        .select("id, numero, serie, fase, obra_codigo, obra_nome, fornecedor_nome, valor, pago_em, pago_por_nome, pagamento_forcado")
        .eq("status", "paga");
      let qr = supabase
        .from("reembolsos_resumo")
        .select("id, obra_codigo, obra_nome, fornecedor_nome, valor_total, pago_em, pago_por_nome, pagamento_forcado")
        .eq("status", "paga");
      if (filtros.obra) {
        qn = qn.eq("obra_id", filtros.obra);
        qr = qr.eq("obra_id", filtros.obra);
      }
      if (filtros.fornecedor) {
        qn = qn.eq("fornecedor_id", filtros.fornecedor);
        qr = qr.eq("fornecedor_id", filtros.fornecedor);
      }
      if (filtros.de) {
        qn = qn.gte("pago_em", filtros.de);
        qr = qr.gte("pago_em", filtros.de);
      }
      if (filtros.ate) {
        qn = qn.lte("pago_em", filtros.ate);
        qr = qr.lte("pago_em", filtros.ate);
      }
      const [{ data: ns }, { data: rs }] = await Promise.all([qn.limit(LIM), qr.limit(LIM)]);
      colunas = [
        { chave: "data", rotulo: "Pago em", tipo: "data" },
        { chave: "origem", rotulo: "Origem" },
        { chave: "numero", rotulo: "Documento" },
        { chave: "obra", rotulo: "Obra" },
        { chave: "fornecedor", rotulo: "Fornecedor" },
        { chave: "valor", rotulo: "Valor", tipo: "moeda" },
        { chave: "por", rotulo: "Baixado por" },
        { chave: "forcado", rotulo: "Forçado" },
      ];
      linhas = [
        ...(ns ?? []).map((r) => ({
          href: `/notas/${r.id}`,
          data: r.pago_em ?? "",
          origem: r.fase === "azul" ? "NF Fase Azul (cliente)" : "NF Fase Cinza",
          numero: `NF ${r.numero}/${r.serie}`,
          obra: `${r.obra_codigo} — ${r.obra_nome}`,
          fornecedor: r.fornecedor_nome,
          valor: Number(r.valor),
          por: r.pago_por_nome ?? "",
          forcado: r.pagamento_forcado ? "Sim" : "",
        })),
        ...(rs ?? []).map((r) => ({
          href: `/ordens-reembolso/${r.id}`,
          data: r.pago_em ?? "",
          origem: "Reembolso",
          numero: numeroReembolso(r.id),
          obra: `${r.obra_codigo} — ${r.obra_nome}`,
          fornecedor: r.fornecedor_nome,
          valor: Number(r.valor_total),
          por: r.pago_por_nome ?? "",
          forcado: r.pagamento_forcado ? "Sim" : "",
        })),
      ].sort((a, b) => String(b.data).localeCompare(String(a.data)));
      limite = (ns?.length ?? 0) >= LIM || (rs?.length ?? 0) >= LIM;
    }
  }

  const statusPorTipo = { ocs: STATUS_OC, notas: STATUS_NF, reembolsos: STATUS_REEMBOLSO, pagamentos: {} };

  return (
    <ConsultaView
      filtros={filtros}
      tipos={TIPOS}
      obras={obras}
      fornecedores={fornecedores}
      statusOpcoes={filtros.tipo ? Object.entries(statusPorTipo[filtros.tipo]).map(([valor, s]) => ({ valor, rotulo: s.rotulo })) : []}
      colunas={colunas}
      linhas={linhas}
      limite={limite}
    />
  );
}
