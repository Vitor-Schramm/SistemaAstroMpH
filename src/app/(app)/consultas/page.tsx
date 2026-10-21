import type { Metadata } from "next";
import { connection } from "next/server";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { executarConsulta, opcoesConsulta, type FiltroConsulta, type TipoConsulta } from "@/lib/consultas/dados";
import { TelaConsultas } from "./tela";

export const metadata: Metadata = { title: "Consultas" };

const TIPOS: TipoConsulta[] = ["P", "N", "F", "MP", "NF", "I"];
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const lista = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default async function ConsultasPage({ searchParams }: PageProps<"/consultas">) {
  const sp = await searchParams;
  const tipo = str(sp.tipo) as TipoConsulta;
  const filtro: FiltroConsulta = {
    tipo: TIPOS.includes(tipo) ? tipo : "P",
    obra: str(sp.obra),
    fornecedor: str(sp.fornecedor),
    cliente: str(sp.cliente),
    usuario: str(sp.usuario),
    classificacao: str(sp.classificacao),
    inicio: str(sp.inicio),
    fim: str(sp.fim),
    modelo: str(sp.modelo) === "P" ? "P" : "S",
    pgtoInicio: str(sp.pgto_inicio),
    pgtoFim: str(sp.pgto_fim),
    situacao: (["T", "A", "F"].includes(str(sp.situacao)) ? str(sp.situacao) : "T") as FiltroConsulta["situacao"],
    itens: lista(sp.itens),
  };
  const consultar = str(sp.consultar) === "1";
  await connection();
  const [opcoes, resultado] = await Promise.all([opcoesConsulta(), consultar ? executarConsulta(filtro, new Date()) : Promise.resolve(null)]);
  return (
    <>
      <CabecalhoPagina titulo="Consultas" migalhas={[{ titulo: "Consultas" }]} />
      <TelaConsultas key={JSON.stringify(filtro) + consultar} filtro={filtro} opcoes={opcoes} resultado={resultado} />
    </>
  );
}
