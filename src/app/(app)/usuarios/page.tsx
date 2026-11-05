import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { getPerfil, type Perfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TelaUsuarios } from "./tela";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsuariosPage() {
  const supabase = await createClient();
  const [perfil, { data }] = await Promise.all([getPerfil(), supabase.from("perfis").select("id, nome, email, celular, papel, ativo").order("nome")]);
  return (
    <>
      <CabecalhoPagina titulo="Usuários" migalhas={[{ titulo: "Usuários" }]} />
      {perfil.ativo && perfil.papel === "admin" ? (
        <TelaUsuarios usuarios={(data ?? []) as Perfil[]} meuId={perfil.id} />
      ) : (
        <p className="rounded-[0.428rem] bg-card p-4">Só o administrador acessa a tela de usuários.</p>
      )}
    </>
  );
}
