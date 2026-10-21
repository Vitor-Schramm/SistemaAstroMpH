"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Mail, MailOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Cartao } from "@/components/astro/basicos";
import { cn } from "@/lib/utils";
import { dataHora } from "@/lib/format";
import { excluirNotificacoes, marcarLidas } from "@/lib/notificacoes/actions";
import type { Notificacao } from "@/lib/notificacoes/dados";

// "Minhas Notificações" do AstroTools: tipos (Não visualizada / Lidas), Selecionar Tudo, marcar como lida e excluir.

export function ListaNotificacoes({ lista, lidas, naoLidas, qtdLidas }: { lista: Notificacao[]; lidas: boolean; naoLidas: number; qtdLidas: number }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const todos = lista.length > 0 && sel.size === lista.length;
  const alternar = (id: number) => setSel((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  const executar = (fn: () => Promise<{ ok: boolean; erro?: string }>, ok: string) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.erro);
      toast.success(ok);
      setSel(new Set());
      router.refresh();
    });
  const abrir = (n: Notificacao) =>
    startTransition(async () => {
      if (!n.lida) await marcarLidas([n.id]);
      if (n.link) router.push(n.link);
    });

  const tipo = (href: string, ativo: boolean, Icone: typeof Mail, rotulo: string, qtd?: number) => (
    <Link href={href} className={cn("flex items-center gap-[0.8rem] border-l-2 px-[1.5rem] py-[0.6rem] text-[1rem]", ativo ? "border-primary text-primary" : "border-transparent")}>
      <Icone className="size-[1.1rem]" />
      <span>{rotulo}</span>
      {qtd != null && <span className="ml-auto rounded-full bg-primary/12 px-[0.5rem] text-[0.857rem] font-semibold text-primary">{qtd}</span>}
    </Link>
  );

  return (
    <Cartao className="flex flex-col overflow-hidden md:flex-row">
      <aside className="w-full shrink-0 border-b border-border py-[1.5rem] md:w-[16rem] md:border-r md:border-b-0">
        <h6 className="mb-[0.8rem] px-[1.5rem] text-[0.857rem] font-medium tracking-[0.5px] text-muted-foreground uppercase">Tipos de Notificações</h6>
        {tipo("/minha-conta/notificacoes", !lidas, Mail, "Não visualizada", naoLidas)}
        {tipo("/minha-conta/notificacoes?tipo=lidas", lidas, MailOpen, "Lidas", qtdLidas)}
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between border-b border-border px-[1.5rem] py-[1.2rem]">
          <label className="flex items-center gap-[0.8rem] text-[1rem] font-medium">
            <input type="checkbox" checked={todos} onChange={() => setSel(todos ? new Set() : new Set(lista.map((n) => n.id)))} className="size-[16px] accent-primary" />
            Selecionar Tudo
          </label>
          <div className="flex gap-[1rem]">
            {!lidas && (
              <button type="button" title="Marcar como lida" disabled={!sel.size || pending} className="text-primary disabled:opacity-40" onClick={() => executar(() => marcarLidas([...sel]), "Notificações marcadas como lidas.")}>
                <Eye className="size-[18px]" />
              </button>
            )}
            <button
              type="button"
              title="Excluir"
              disabled={!sel.size || pending}
              className="text-[#ea5455] disabled:opacity-40"
              onClick={() => confirm("Excluir as notificações selecionadas?") && executar(() => excluirNotificacoes([...sel]), "Notificações excluídas.")}
            >
              <Trash2 className="size-[18px]" />
            </button>
          </div>
        </div>
        {lista.length === 0 && <p className="px-[1.5rem] py-[2rem] text-center text-[1rem] text-muted-foreground">Nenhuma notificação.</p>}
        <ul>
          {lista.map((n) => (
            <li key={n.id} className={cn("flex gap-[1rem] border-b border-border px-[1.5rem] py-[1rem]", !n.lida && "bg-primary/5")}>
              <input type="checkbox" checked={sel.has(n.id)} onChange={() => alternar(n.id)} className="mt-[0.25rem] size-[16px] shrink-0 accent-primary" aria-label="Selecionar" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="mb-[0.3rem] text-[1rem] font-medium">{n.titulo}</p>
                  <span className="flex items-center gap-[0.5rem] text-[0.857rem] text-muted-foreground">
                    {!n.lida && <span className="size-[8px] rounded-full bg-[#28c76f]" />}
                    {dataHora(n.criado_em)}
                  </span>
                </div>
                {n.texto && <p className="mb-[0.2rem] text-[1rem] text-muted-foreground">{n.texto}</p>}
                {n.link && (
                  <button type="button" onClick={() => abrir(n)} className="text-[1rem] text-primary hover:underline">
                    Clique aqui para visualizar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Cartao>
  );
}
