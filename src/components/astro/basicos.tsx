import { cn } from "@/lib/utils";

// Peças visuais recorrentes do AstroTools (Vuexy).

export type Tom = "primary" | "success" | "danger" | "warning" | "info" | "secondary";

const CORES: Record<Tom, string> = {
  primary: "#01a08a",
  success: "#28c76f",
  danger: "#ea5455",
  warning: "#ff9f43",
  info: "#00cfe8",
  secondary: "#82868b",
};

/** Selo "badge-light-*" arredondado. */
export function Selo({ tom, children, className }: { tom: Tom; children: React.ReactNode; className?: string }) {
  const c = CORES[tom];
  return (
    <span
      className={cn("inline-block rounded-full px-[7px] py-[3px] text-[0.85rem] leading-none font-semibold whitespace-nowrap", className)}
      style={{ color: c, backgroundColor: `${c}1f` }}
    >
      {children}
    </span>
  );
}

/** Cartão branco padrão (".card"). */
export function Cartao({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mb-[2rem] rounded-[0.428rem] bg-card text-card-foreground shadow-[var(--card-shadow)] [border:var(--card-border)]", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/** Cartão de estatística: número, rótulo e ícone num círculo colorido. */
export function CartaoEstatistica({ valor, rotulo, tom, icone }: { valor: React.ReactNode; rotulo: string; tom: Tom; icone: React.ReactNode }) {
  const c = CORES[tom];
  return (
    <Cartao className="mb-0">
      <div className="flex items-start justify-between p-[1.5rem]">
        <div>
          <h2 className="mb-[0.25rem] text-[1.714rem] font-bold">{valor}</h2>
          <p className="mb-0 text-[1rem]">{rotulo}</p>
        </div>
        <span className="flex size-[48px] items-center justify-center rounded-full [&_svg]:size-[24px]" style={{ color: c, backgroundColor: `${c}1f` }}>
          {icone}
        </span>
      </div>
    </Cartao>
  );
}

export function Campo({ rotulo, htmlFor, children, className }: { rotulo: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-[1rem]", className)}>
      <label htmlFor={htmlFor} className="mb-[0.2857rem] block text-[0.857rem] text-heading">
        {rotulo}
      </label>
      {children}
    </div>
  );
}
