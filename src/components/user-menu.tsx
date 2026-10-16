"use client";

import Link from "next/link";
import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { sair } from "@/app/login/actions";

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function UserMenu({ nome, email, papel }: { nome: string; email: string; papel: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
        <Avatar className="size-8 rounded-lg">
          <AvatarFallback className="rounded-lg">{iniciais(nome) || "?"}</AvatarFallback>
        </Avatar>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{nome}</span>
          <span className="truncate text-xs text-muted-foreground">{email}</span>
        </div>
        <ChevronsUpDown className="ml-auto size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">{nome}</div>
          <div className="text-xs capitalize text-muted-foreground">Perfil: {papel}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/minha-conta" />}>
          <UserRound /> Minha conta
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => sair()}>
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
