import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth";
import { opcoesObras } from "@/lib/compras/dados";
import { opcoesFavorecidos } from "@/lib/reembolsos/dados";
import { ReembolsoForm } from "../reembolso-form";

export const metadata: Metadata = { title: "Novo reembolso" };

export default async function NovoReembolsoPage() {
  const [perfil, obras, favorecidos] = await Promise.all([getPerfil(), opcoesObras(), opcoesFavorecidos()]);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/ordens-reembolso" />} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Nova ordem de reembolso</h1>
      </div>
      <ReembolsoForm
        id={null}
        inicial={{ obra_id: "", filial: "", fornecedor_id: "", cpf_cnpj: "", banco: "", agencia: "", conta: "", observacao: "" }}
        itensIniciais={[{ chave: "n0", descricao: "", apropriacao: "", tipo: "", data: "", valor: "" }]}
        obras={obras}
        favorecidos={favorecidos}
        editavel={perfil.ativo}
      />
    </div>
  );
}
