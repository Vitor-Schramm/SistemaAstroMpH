import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { getPerfil } from "@/lib/auth";
import { catalogoItens } from "@/lib/compras/dados";
import { obrasSelect } from "@/lib/solicitacoes/dados";
import { TelaMapa } from "../tela-mapa";

export const metadata: Metadata = { title: "Adicionar Mapa" };

export default async function NovoMapaPage() {
  const [perfil, obras, catalogo] = await Promise.all([getPerfil(), obrasSelect(), catalogoItens()]);
  return (
    <>
      <CabecalhoPagina titulo="Adicionar Mapa" migalhas={[{ titulo: "Pedidos", href: "/mapas" }, { titulo: "Mapas" }]} />
      <TelaMapa
        cabecalho={null}
        itens={[]}
        obras={obras}
        catalogo={catalogo}
        ccs={[]}
        fornecedores={[]}
        opcoesFornecedores={[]}
        precos={{}}
        arquivos={[]}
        solicitacoesObra={[]}
        podeMontar={perfil.ativo && ["admin", "engenharia", "suprimentos"].includes(perfil.papel)}
        podeCotar={false}
      />
    </>
  );
}
