import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { contratosObra } from "@/lib/obras/pagamentos-contratos";
import { TabelaContratos, type ModoContratos } from "./tabela";

export const metadata: Metadata = { title: "Contratos" };

// Opções da obra → "Controle Contratos" (/obras/controle_contratos/{id},P|F|U no AstroTools):
// OCs da obra Pendentes (falta pagar), Finalizadas (pagas por completo) ou Todas.
const TITULOS: Record<ModoContratos, string> = { P: "Contratos Pendentes", F: "Contratos Finalizados", U: "Todos os Contratos" };
const MIGALHAS: Record<ModoContratos, string> = { P: "Controle de Contratos - Pendentes", F: "Controle de Contratos- Finalizados", U: "Controle de Contratos- Todos os Contratos" };

export default async function ControleContratosPage({ params, searchParams }: PageProps<"/obras/[id]/controle-contratos">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const { modo: m } = await searchParams;
  const modo: ModoContratos = m === "F" || m === "U" ? m : "P";
  const todos = await contratosObra(id);
  const linhas = modo === "U" ? todos : todos.filter((c) => (modo === "P" ? c.pendente > 0.004 : c.pendente <= 0.004));
  return (
    <>
      <CabecalhoPagina titulo="Contratos" migalhas={[{ titulo: "Obras", href: "/obras" }, { titulo: MIGALHAS[modo] }]} />
      <TabelaContratos obraId={id} modo={modo} titulo={TITULOS[modo]} linhas={linhas} />
    </>
  );
}
