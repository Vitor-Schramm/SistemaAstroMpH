"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { dataHora } from "@/lib/format";
import { marcarLidas } from "@/lib/notificacoes/actions";
import type { Notificacao } from "@/lib/notificacoes/dados";

// Sino de notificações da barra superior do AstroTools ("Nova Solicitação … 👋").

export function Sino({ naoLidas, recentes }: { naoLidas: number; recentes: Notificacao[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const abrir = async (n: Notificacao) => {
    setAberto(false);
    await marcarLidas([n.id]);
    if (n.link) router.push(n.link);
    else router.refresh();
  };
  return (
    <DropdownMenu open={aberto} onOpenChange={setAberto}>
      <DropdownMenuTrigger className="relative mr-[0.5rem] p-[0.5rem] outline-none" aria-label="Notificações">
        <Bell className="size-[1.5rem]" strokeWidth={1.75} />
        {naoLidas > 0 && (
          <span className="absolute -top-[0.2rem] right-[-0.6rem] min-w-[1.3rem] rounded-full bg-[#ea5455] px-[0.35rem] py-[0.1rem] text-center text-[0.786rem] leading-tight font-semibold text-white">
            {naoLidas}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[26rem] max-w-[90vw] p-0">
        <div className="flex items-center justify-between border-b border-border px-[1.28rem] py-[1.22rem]">
          <h4 className="mb-0 text-[1.285rem] font-medium text-heading">Notificações</h4>
          {naoLidas > 0 && <span className="rounded-full bg-primary/12 px-[0.6rem] py-[0.2rem] text-[0.857rem] font-semibold text-primary">{naoLidas} Novas</span>}
        </div>
        <div className="max-h-[25rem] overflow-y-auto">
          {recentes.length === 0 && <p className="px-[1.28rem] py-[1rem] text-[1rem] text-muted-foreground">Nenhuma notificação nova.</p>}
          {recentes.map((n) => (
            <button key={n.id} type="button" onClick={() => abrir(n)} className="block w-full border-b border-border px-[1.28rem] py-[0.9rem] text-left hover:bg-muted">
              <p className="mb-[0.15rem] text-[1rem] font-semibold">{n.titulo}</p>
              {n.texto && <p className="mb-[0.15rem] text-[0.9rem] text-muted-foreground">{n.texto}</p>}
              <p className="mb-0 flex justify-between text-[0.857rem]">
                <span className="text-primary">Clique aqui para visualizar</span>
                <span className="text-muted-foreground">{dataHora(n.criado_em)}</span>
              </p>
            </button>
          ))}
        </div>
        <div className="p-[1.28rem]">
          <Link href="/minha-conta/notificacoes" onClick={() => setAberto(false)} className="block w-full rounded-[0.358rem] bg-primary py-[0.6rem] text-center text-[1rem] text-white">
            Ver todas notificações
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
