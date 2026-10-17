import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Cabeçalho de página do AstroTools: título com divisória e breadcrumb "Home > …".

export type Migalha = { titulo: string; href?: string };

export function CabecalhoPagina({ titulo, migalhas = [], acoes }: { titulo: string; migalhas?: Migalha[]; acoes?: React.ReactNode }) {
  return (
    <div className="mb-[2rem] flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center">
        <h2 className="mr-[1rem] mb-0 border-r border-[#d6dce1] pr-[1rem] text-[1.714rem] leading-tight font-medium text-[#636363] dark:border-[#4d5469] dark:text-[#d0d2d6]">
          {titulo}
        </h2>
        <ol className="flex flex-wrap items-center text-[1rem]">
          <li>
            <Link href="/" className="text-primary hover:text-[#019883]">
              Home
            </Link>
          </li>
          {migalhas.map((m) => (
            <li key={m.titulo} className="flex items-center">
              <ChevronRight className="mx-[0.6rem] size-[14px] text-foreground" />
              {m.href ? (
                <Link href={m.href} className="text-primary hover:text-[#019883]">
                  {m.titulo}
                </Link>
              ) : (
                <span>{m.titulo}</span>
              )}
            </li>
          ))}
        </ol>
      </div>
      {acoes}
    </div>
  );
}
