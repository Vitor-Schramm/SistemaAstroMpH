import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { getPerfil } from "@/lib/auth";
import { opcoesFornecedores } from "@/lib/compras/dados";
import { carregarOcs } from "@/lib/ocs/dados";
import { obrasSelect } from "@/lib/solicitacoes/dados";
import { AvisoOcs } from "../ordens-compra/aviso";
import { AprovacaoOc } from "./lista";

export const metadata: Metadata = { title: "Aprovação" };

export default async function AprovacaoOcPage() {
  const [perfil, ocs, obras, fornecedores] = await Promise.all([getPerfil(), carregarOcs({ status: "aguardando_aprovacao" }), obrasSelect(), opcoesFornecedores()]);
  return (
    <>
      <CabecalhoPagina titulo="Aprovação" migalhas={[{ titulo: "Aprovação de OC com Pendência" }]} />
      {ocs ? (
        <AprovacaoOc ocs={ocs} obras={obras} fornecedores={fornecedores} podeDecidir={perfil.ativo && ["admin", "engenharia"].includes(perfil.papel)} />
      ) : (
        <AvisoOcs />
      )}
    </>
  );
}
