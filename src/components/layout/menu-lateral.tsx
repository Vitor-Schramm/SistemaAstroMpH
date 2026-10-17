"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AlignJustify, ChevronRight, Circle, CircleDot, Database, FileText, Home, LayoutGrid, MoreHorizontal, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MENU, type IconeMenu, type ItemMenu } from "@/lib/menu";
import { usePreferencias } from "./preferencias";

const ICONES: Record<IconeMenu, LucideIcon> = {
  home: Home,
  grid: LayoutGrid,
  circle: Circle,
  "align-justify": AlignJustify,
  "file-text": FileText,
  database: Database,
};

/** Logo da MPH usado no original. */
export function LogoMph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 81 90" className={className} aria-hidden>
      <g transform="translate(0,90) scale(0.1,-0.1)" fill="#01a08a">
        <path d="M390 820 c0 -35 18 -60 106 -151 117 -121 133 -167 94 -271 -14 -38 -31 -61 -59 -80 -45 -32 -63 -34 -85 -12 -24 24 -20 40 23 79 22 20 42 48 46 62 7 28 -11 93 -26 93 -5 0 -9 5 -9 11 0 6 -36 47 -80 90 -64 63 -83 88 -92 125 -7 26 -18 48 -24 51 -22 8 -119 -50 -166 -99 -180 -191 -120 -510 116 -618 66 -31 186 -50 186 -31 0 31 -35 83 -100 146 -95 93 -121 138 -121 210 0 81 52 161 122 187 21 8 59 -18 59 -39 0 -9 -21 -36 -46 -60 -46 -42 -46 -44 -42 -94 5 -47 10 -55 84 -129 84 -84 108 -118 127 -179 l12 -39 55 26 c72 35 149 112 186 187 26 55 29 69 29 165 0 96 -3 110 -29 165 -61 124 -172 203 -309 220 -54 7 -57 6 -57 -15z" />
      </g>
    </svg>
  );
}

type Rota = { pathname: string | null; busca: string };

function hrefAtivo(href: string, ativoEm: string[] | undefined, { pathname, busca }: Rota) {
  if (pathname === null) return false;
  const [caminho, query] = href.split("?");
  if (query) return pathname === caminho && busca.includes(query);
  if (caminho === "/") return pathname === "/";
  const bate = (c: string) => pathname === c || pathname.startsWith(`${c}/`);
  // Item sem query não fica ativo se um irmão com query for o atual (ex.: Pendentes × Pagas).
  return (bate(caminho) && !busca.includes("situacao=")) || (ativoEm ?? []).some(bate);
}

const itemAtivo = (item: ItemMenu, rota: Rota) =>
  item.href ? hrefAtivo(item.href, item.ativoEm, rota) : (item.sub ?? []).some((s) => hrefAtivo(s.href, s.ativoEm, rota));

function Lista({ rota, expandido }: { rota: Rota; expandido: boolean }) {
  const { setMenuAbertoMobile } = usePreferencias();
  const grupoAtivo = MENU.find((e) => "titulo" in e && e.sub && itemAtivo(e, rota));
  const [aberto, setAberto] = useState<string | null>(grupoAtivo && "titulo" in grupoAtivo ? grupoAtivo.titulo : null);
  const fecharMobile = () => setMenuAbertoMobile(false);

  return (
    <ul className="pb-6">
      {MENU.map((e) => {
        if ("cabecalho" in e)
          return (
            <li key={e.cabecalho} className="mt-[2.286rem] mb-[0.8rem] ml-[2.2rem] text-[0.9rem] font-medium tracking-[0.01rem] text-[var(--menu-header)] uppercase">
              {expandido ? e.cabecalho : <MoreHorizontal className="-ml-[0.2rem] size-[1.1rem]" />}
            </li>
          );
        const Icone = ICONES[e.icone];
        const ativo = itemAtivo(e, rota);
        const linha = cn(
          "group/item mx-[15px] flex items-center gap-[1.1rem] rounded-[4px] px-[15px] py-[10px] text-[1.1rem] whitespace-nowrap transition-colors",
          "text-[var(--menu-fg)]",
        );
        const conteudo = (
          <>
            <Icone className="size-[20px] shrink-0 transition-transform duration-300 group-hover/item:translate-x-[5px]" strokeWidth={2} />
            {expandido && (
              <>
                <span className="truncate transition-transform duration-300 group-hover/item:translate-x-[5px]">{e.titulo}</span>
                {e.badge && <span className="ml-auto rounded-full bg-[rgba(255,159,67,0.12)] px-[7px] py-[3px] text-[0.85rem] leading-none font-semibold text-[#ff9f43]">{e.badge}</span>}
                {e.sub && <ChevronRight className={cn("size-[15px] shrink-0 transition-transform duration-200", !e.badge && "ml-auto", aberto === e.titulo && "rotate-90")} />}
              </>
            )}
          </>
        );

        if (!e.sub)
          return (
            <li key={e.titulo} className="mb-[1px]">
              <Link
                href={e.href!}
                onClick={fecharMobile}
                className={cn(
                  linha,
                  ativo && expandido && "bg-[linear-gradient(118deg,#01a08a,rgba(1,160,138,0.7))] text-white shadow-[0_0_10px_1px_rgba(1,160,138,0.7)]",
                  ativo && !expandido && "bg-[var(--menu-ativo-recolhido)] text-white",
                )}
              >
                {conteudo}
              </Link>
            </li>
          );

        const estaAberto = expandido && aberto === e.titulo;
        return (
          <li key={e.titulo} className="mb-[1px]">
            <button
              type="button"
              onClick={() => setAberto(aberto === e.titulo ? null : e.titulo)}
              className={cn(linha, "w-[calc(100%-30px)] text-left", (estaAberto || (ativo && !expandido)) && "bg-[var(--menu-ativo-recolhido)]", ativo && !expandido && "text-white")}
              aria-expanded={estaAberto}
            >
              {conteudo}
            </button>
            {estaAberto && (
              <ul className="mt-[1px]">
                {e.sub.map((s) => {
                  const subAtivo = hrefAtivo(s.href, s.ativoEm, rota);
                  return (
                    <li key={s.href} className="mb-[1px]">
                      <Link
                        href={s.href}
                        onClick={fecharMobile}
                        className={cn(
                          "group/item mx-[15px] flex items-center gap-[1.1rem] rounded-[4px] py-[10px] pr-[15px] pl-[20px] text-[1.1rem] whitespace-nowrap text-[var(--menu-fg)]",
                          subAtivo && "bg-[linear-gradient(118deg,#01a08a,rgba(1,160,138,0.7))] text-white shadow-[0_0_10px_1px_rgba(1,160,138,0.7)]",
                        )}
                      >
                        <Circle className="size-[11px] shrink-0 transition-transform duration-300 group-hover/item:translate-x-[5px]" />
                        <span className="truncate transition-transform duration-300 group-hover/item:translate-x-[5px]">{s.titulo}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ListaComRota({ expandido }: { expandido: boolean }) {
  const pathname = usePathname();
  const busca = useSearchParams().toString();
  // A chave reabre o grupo da rota atual quando a página muda.
  return <Lista key={pathname} rota={{ pathname, busca }} expandido={expandido} />;
}

export function MenuLateral() {
  const { menuColapsado, alterar, menuAbertoMobile, setMenuAbertoMobile } = usePreferencias();
  const [hover, setHover] = useState(false);
  const expandido = !menuColapsado || hover || menuAbertoMobile;

  return (
    <>
      {menuAbertoMobile && <div className="fixed inset-0 z-40 bg-black/50 xl:hidden" onClick={() => setMenuAbertoMobile(false)} />}
      <aside
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden bg-[var(--menu-bg)] shadow-[0_0_15px_0_rgba(34,41,47,0.05)] transition-[width,transform] duration-300",
          expandido ? "w-[260px]" : "w-[80px]",
          menuAbertoMobile ? "translate-x-0" : "-translate-x-full xl:translate-x-0",
        )}
      >
        <div className="flex h-[4.45rem] shrink-0 items-center justify-between py-[0.35rem] pr-[1rem] pl-[1.64rem]">
          <Link href="/" className="flex items-center gap-[0.8rem]">
            <LogoMph className="h-[28px] w-[25px] shrink-0" />
            {expandido && <h2 className="text-[1.45rem] leading-none font-semibold tracking-[0.01rem] text-primary">Astro</h2>}
          </Link>
          {expandido && (
            <>
              <button type="button" className="hidden text-primary xl:block" onClick={() => alterar({ menuColapsado: !menuColapsado })} aria-label={menuColapsado ? "Fixar menu" : "Recolher menu"}>
                {menuColapsado ? <Circle className="size-[20px]" /> : <CircleDot className="size-[20px]" />}
              </button>
              <button type="button" className="text-primary xl:hidden" onClick={() => setMenuAbertoMobile(false)} aria-label="Fechar menu">
                <X className="size-[20px]" />
              </button>
            </>
          )}
        </div>
        <div className={cn("h-[30px] shrink-0 bg-[linear-gradient(var(--menu-bg)_41%,transparent_95%)]", "-mb-[20px] relative z-10")} />
        <nav className="flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Suspense fallback={<Lista rota={{ pathname: null, busca: "" }} expandido={expandido} />}>
            <ListaComRota expandido={expandido} />
          </Suspense>
        </nav>
      </aside>
    </>
  );
}
