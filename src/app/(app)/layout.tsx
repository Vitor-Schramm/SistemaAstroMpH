import { Suspense } from "react";
import { Casca } from "@/components/layout/casca";
import { UserMenu } from "@/components/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { RegistrarPapel } from "@/components/layout/papel";
import { Sino } from "@/components/layout/sino";
import { getPerfil } from "@/lib/auth";
import { resumoNotificacoes } from "@/lib/notificacoes/dados";

// O layout é estático (vai para o shell pré-renderizado); tudo que lê a sessão
// entra por <Suspense>, como pede o Cache Components do Next 16.

async function Usuario() {
  const [perfil, notificacoes] = await Promise.all([getPerfil(), resumoNotificacoes()]);
  // O sino aparece para Suprimentos (que recebe "Nova Solicitação") ou para quem tiver notificações.
  const sino = notificacoes && (perfil.papel === "suprimentos" || notificacoes.naoLidas > 0);
  return (
    <div className="flex items-center">
      <RegistrarPapel papel={perfil.papel} />
      {sino && <Sino naoLidas={notificacoes.naoLidas} recentes={notificacoes.recentes} />}
      <UserMenu nome={perfil.nome || perfil.email} email={perfil.email} papel={perfil.papel} />
    </div>
  );
}

async function AvisoInativo() {
  const perfil = await getPerfil();
  if (perfil.ativo) return null;
  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      Seu usuário está inativo ou sem perfil. Peça a um administrador para liberar o acesso.
    </div>
  );
}

function CarregandoPagina() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Casca
      usuario={
        <Suspense fallback={<Skeleton className="h-9 w-32" />}>
          <Usuario />
        </Suspense>
      }
    >
      <Suspense fallback={<CarregandoPagina />}>
        <AvisoInativo />
        {children}
      </Suspense>
    </Casca>
  );
}
