import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getPerfil } from "@/lib/auth";

// O layout é estático (vai para o shell pré-renderizado); tudo que lê a sessão
// entra por <Suspense>, como pede o Cache Components do Next 16.

async function UsuarioRodape() {
  const perfil = await getPerfil();
  return <UserMenu nome={perfil.nome || perfil.email} email={perfil.email} papel={perfil.papel} />;
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
      <Skeleton className="h-4 w-80" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <AppSidebar
        rodape={
          <Suspense fallback={<Skeleton className="h-12 w-full" />}>
            <UsuarioRodape />
          </Suspense>
        }
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm text-muted-foreground">MPH Engenharia</span>
        </header>
        <div className="flex-1 p-4 md:p-6">
          <Suspense fallback={<CarregandoPagina />}>
            <AvisoInativo />
            {children}
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
