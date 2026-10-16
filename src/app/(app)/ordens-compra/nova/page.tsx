import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { catalogoItens, opcoesFornecedores, opcoesObras } from "@/lib/compras/dados";
import { getPerfil, podeComprar } from "@/lib/auth";
import { OcForm } from "../oc-form";

export const metadata: Metadata = { title: "Nova ordem de compra" };

export default async function NovaOcPage() {
  const [perfil, obras, fornecedores, catalogo] = await Promise.all([getPerfil(), opcoesObras(), opcoesFornecedores(), catalogoItens()]);
  if (!perfil.ativo || !podeComprar(perfil.papel)) {
    return <p className="text-sm text-muted-foreground">Seu perfil não pode criar ordens de compra.</p>;
  }
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/ordens-compra" />} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Nova ordem de compra</h1>
      </div>
      <OcForm
        id={null}
        inicial={{
          obra_id: "",
          fornecedor_id: "",
          engenheiro_responsavel: "",
          data_emissao: hoje,
          data_entrega: "",
          condicao_pagamento: "",
          prazo_entrega: "",
          frete: "",
          observacao: "",
        }}
        itensIniciais={[]}
        obras={obras}
        fornecedores={fornecedores}
        catalogo={catalogo}
        editavel
      />
    </div>
  );
}
