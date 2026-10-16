import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { catalogoItens, opcoesObras } from "@/lib/compras/dados";
import { getPerfil, podeComprar } from "@/lib/auth";
import { numeroSolicitacao, type LinhaItem } from "@/lib/compras/tipos";
import { MapaForm, type DadosMapa } from "../mapa-form";

export const metadata: Metadata = { title: "Novo mapa de cotação" };

export default async function NovoMapaPage({ searchParams }: PageProps<"/mapas/novo">) {
  const { solicitacao } = await searchParams;
  const solId = Number(solicitacao) || null;

  const supabase = await createClient();
  const [perfil, obras, catalogo, sol] = await Promise.all([
    getPerfil(),
    opcoesObras(),
    catalogoItens(),
    solId
      ? supabase.from("solicitacoes").select("*, itens:solicitacao_itens(*)").eq("id", solId).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);

  if (!perfil.ativo || !podeComprar(perfil.papel)) {
    return <p className="text-sm text-muted-foreground">Seu perfil não pode montar mapas de cotação.</p>;
  }

  const inicial: DadosMapa = {
    obra_id: sol ? String(sol.obra_id) : "",
    solicitacao_id: sol ? String(sol.id) : "",
    servico: sol?.servico ?? "",
    apropriacao: "",
    tipo: "compra",
    data_entrega: "",
    prazo_locacao: "",
    data_devolucao: "",
    observacao: sol?.observacao ?? "",
  };
  const itens: LinhaItem[] = sol
    ? [...(sol.itens ?? [])]
        .sort((a, b) => a.ordem - b.ordem)
        .map((i, n) => ({
          chave: `s${n}`,
          titulo: i.titulo,
          item_id: i.item_id,
          codigo: i.codigo,
          descricao: i.descricao,
          quantidade: i.quantidade,
          unidade: i.unidade,
          valor_medio: i.valor_medio,
        }))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/mapas" />} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Novo mapa de cotação</h1>
          {sol && <p className="text-sm text-muted-foreground">A partir da solicitação {numeroSolicitacao(sol.id)}</p>}
        </div>
      </div>
      <MapaForm id={null} inicial={inicial} itensIniciais={itens} obras={obras} catalogo={catalogo} editavel />
    </div>
  );
}
