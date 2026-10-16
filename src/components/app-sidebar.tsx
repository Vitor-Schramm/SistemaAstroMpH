"use client";

import { Suspense } from "react";
import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { MENU } from "@/lib/menu";

// O item ativo depende da URL; fica em <Suspense> para não bloquear o shell estático das rotas dinâmicas.
function MenuAtivo() {
  return <Menu pathname={usePathname()} />;
}

function Menu({ pathname }: { pathname: string | null }) {
  const ativo = (href: string) => pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <>
      {MENU.map((grupo) => (
        <SidebarGroup key={grupo.titulo}>
          <SidebarGroupLabel>{grupo.titulo}</SidebarGroupLabel>
          <SidebarMenu>
            {grupo.itens.map((item) => (
              <SidebarMenuItem key={item.href}>
                {item.emBreve ? (
                  <SidebarMenuButton disabled tooltip={`${item.titulo} (em breve)`} className="opacity-50">
                    <item.icone />
                    <span>{item.titulo}</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton isActive={ativo(item.href)} tooltip={item.titulo} render={<Link href={item.href} />}>
                    <item.icone />
                    <span>{item.titulo}</span>
                  </SidebarMenuButton>
                )}
                {item.emBreve && <SidebarMenuBadge className="text-[10px]">breve</SidebarMenuBadge>}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}

export function AppSidebar({ rodape }: { rodape: React.ReactNode }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">MPH Sistema</span>
                <span className="truncate text-xs text-muted-foreground">Engenharia</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <Suspense fallback={<Menu pathname={null} />}>
          <MenuAtivo />
        </Suspense>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>{rodape}</SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
