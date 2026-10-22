import Link from "next/link";
import { Lock, User } from "lucide-react";
import { cn } from "@/lib/utils";

// Abas "Dados da Conta" / "Trocar Senha" da Minha Conta do AstroTools (pílulas acima do cartão).

const ABAS = [
  { href: "/minha-conta", titulo: "Dados da Conta", icone: User },
  { href: "/minha-conta/senha", titulo: "Trocar Senha", icone: Lock },
] as const;

export function AbasConta({ ativa }: { ativa: "/minha-conta" | "/minha-conta/senha" }) {
  return (
    <ul className="mb-[1.5rem] flex flex-wrap gap-[0.5rem]">
      {ABAS.map(({ href, titulo, icone: Icone }) => (
        <li key={href}>
          <Link
            href={href}
            className={cn(
              "flex items-center gap-[0.5rem] rounded-[0.358rem] px-[1.2rem] py-[0.786rem] text-[1rem] font-medium [&_svg]:size-[16px]",
              href === ativa ? "bg-primary text-white shadow-[0_4px_18px_-4px_rgba(1,160,138,0.65)]" : "text-heading hover:text-primary",
            )}
          >
            <Icone /> {titulo}
          </Link>
        </li>
      ))}
    </ul>
  );
}
