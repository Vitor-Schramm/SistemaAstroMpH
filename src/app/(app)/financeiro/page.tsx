import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { obrasFinanceiro } from "@/lib/dashboards";
import { FinanceiroView } from "./view";

export const metadata: Metadata = { title: "Dashboard Financeiro" };

export default async function FinanceiroPage() {
  const obras = await obrasFinanceiro();
  return (
    <>
      <CabecalhoPagina titulo="Dashboard Financeiro" />
      <FinanceiroView obras={obras} />
    </>
  );
}
