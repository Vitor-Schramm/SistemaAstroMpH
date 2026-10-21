import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { minhasNotificacoes } from "@/lib/notificacoes/dados";
import { ListaNotificacoes } from "./lista";

export const metadata: Metadata = { title: "Minhas Notificações" };

export default async function NotificacoesPage({ searchParams }: PageProps<"/minha-conta/notificacoes">) {
  const lidas = (await searchParams).tipo === "lidas";
  const d = await minhasNotificacoes(lidas);
  return (
    <>
      <CabecalhoPagina titulo="Minhas Notificações" migalhas={[{ titulo: "Notificações" }]} />
      {d ? (
        <ListaNotificacoes key={String(lidas)} lista={d.lista} lidas={lidas} naoLidas={d.naoLidas} qtdLidas={d.lidas} />
      ) : (
        <p className="rounded-[0.428rem] bg-card p-4">As notificações precisam da migração 0016_perfil_suprimentos.sql.</p>
      )}
    </>
  );
}
