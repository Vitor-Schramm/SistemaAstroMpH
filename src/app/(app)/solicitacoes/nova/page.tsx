import type { Metadata } from "next";
import { catalogoItens, opcoesObras } from "@/lib/compras/dados";
import { getPerfil } from "@/lib/auth";
import { SolicitacaoForm } from "../solicitacao-form";

export const metadata: Metadata = { title: "Nova solicitação" };

export default async function NovaSolicitacaoPage() {
  const [perfil, obras, catalogo] = await Promise.all([getPerfil(), opcoesObras(), catalogoItens()]);
  return (
    <SolicitacaoForm
      id={null}
      inicial={{ obra_id: "", servico: "", observacao: "" }}
      itensIniciais={[]}
      obras={obras}
      catalogo={catalogo}
      editavel={perfil.ativo}
      podeGerarMapa={false}
    />
  );
}
