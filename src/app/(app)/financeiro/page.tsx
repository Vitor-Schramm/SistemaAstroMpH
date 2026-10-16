import type { Metadata } from "next";
import { carregarPainel } from "@/lib/painel";
import { FinanceiroView } from "./view";

export const metadata: Metadata = { title: "Dashboard Financeiro" };

export default async function FinanceiroPage() {
  const obras = await carregarPainel(false);
  if (obras === null) {
    return <p className="text-sm text-muted-foreground">Rode o SQL 0004_reembolsos_painel.sql no Supabase para habilitar este painel.</p>;
  }
  return <FinanceiroView obras={obras} />;
}
