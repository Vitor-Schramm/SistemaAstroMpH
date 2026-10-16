import { CircleCheck, CircleDashed, CircleX } from "lucide-react";

/** Ícone da decisão de um aprovador: aprovado, reprovado ou pendente. */
export function Aprovacao({ valor }: { valor: boolean | null }) {
  if (valor === true) return <CircleCheck className="mx-auto size-4 text-emerald-600" aria-label="Aprovado" />;
  if (valor === false) return <CircleX className="mx-auto size-4 text-destructive" aria-label="Reprovado" />;
  return <CircleDashed className="mx-auto size-4 text-muted-foreground" aria-label="Pendente" />;
}
