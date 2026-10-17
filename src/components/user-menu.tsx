"use client";

import Link from "next/link";
import { Power, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sair } from "@/app/login/actions";

// Rótulos de perfil como aparecem no AstroTools ("Engenheiro", etc.).
const PERFIS: Record<string, string> = {
  admin: "Administrador",
  financeiro: "Financeiro",
  engenharia: "Engenheiro",
  suprimentos: "Suprimentos",
  usuario: "Usuário",
};

export function UserMenu({ nome, papel }: { nome: string; email: string; papel: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 px-[0.5rem] py-[0.5rem] text-right outline-none">
        <div className="hidden flex-col sm:flex">
          <span className="text-[1rem] leading-tight font-semibold">{nome}</span>
          <span className="text-[0.8333rem] leading-tight">{PERFIS[papel] ?? papel}</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[0.857rem] font-medium text-heading">Configurações do Usuário</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/minha-conta" />}>
          <User /> Minha Conta
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => sair()}>
          <Power /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
