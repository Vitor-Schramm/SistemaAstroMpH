import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeLancarNf } from "@/lib/auth";
import { NotaForm, type OcSaldo } from "../nota-form";

export const metadata: Metadata = { title: "Anexar OC x NF" };

export default async function NovaNotaPage({ searchParams }: PageProps<"/notas/nova">) {
  const { fase, oc } = await searchParams;
  const [perfil, supabase] = await Promise.all([getPerfil(), createClient()]);
  if (!perfil.ativo || !podeLancarNf(perfil.papel)) {
    return <p className="text-sm text-muted-foreground">Seu perfil não pode lançar notas fiscais.</p>;
  }
  const { data } = await supabase
    .from("ocs_saldo")
    .select("id, obra_codigo, obra_nome, fornecedor_nome, valor_total, saldo")
    .gt("saldo", 0)
    .order("id", { ascending: false })
    .limit(2000);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/notas-cinza" />} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Anexar OC x NF</h1>
          <p className="text-sm text-muted-foreground">Registre a nota fiscal do fornecedor vinculada a uma OC aprovada.</p>
        </div>
      </div>
      <NotaForm
        id={null}
        inicial={{
          fase: fase === "azul" ? "azul" : "cinza",
          ordem_compra_id: typeof oc === "string" ? oc : "",
          numero: "",
          serie: "1",
          emissao: "",
          vencimento: "",
          valor: "",
          observacao: "",
        }}
        ocs={(data ?? []) as OcSaldo[]}
        editavel
      />
    </div>
  );
}
