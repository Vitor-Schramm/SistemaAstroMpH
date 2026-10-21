"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { entrarComoTeste, type LoginState } from "./actions";

// Botões de login de teste, um por setor (só aparecem com LOGIN_TESTE_SENHA configurada no servidor).
const SETORES = [
  { valor: "admin", rotulo: "Admin" },
  { valor: "financeiro", rotulo: "Financeiro" },
  { valor: "engenharia", rotulo: "Engenharia" },
  { valor: "suprimentos", rotulo: "Suprimentos" },
  { valor: "usuario", rotulo: "Usuário" },
];

export function AcessoRapido({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(entrarComoTeste, {});
  return (
    <div className="mt-6 border-t pt-4">
      <p className="mb-3 text-center text-sm text-muted-foreground">Acesso rápido de teste</p>
      <form action={formAction} className="grid grid-cols-2 gap-2">
        <input type="hidden" name="next" value={next ?? ""} />
        {SETORES.map((s) => (
          <Button key={s.valor} type="submit" name="setor" value={s.valor} variant="outline" disabled={pending} className={s.valor === "usuario" ? "col-span-2" : undefined}>
            {s.rotulo}
          </Button>
        ))}
      </form>
      {state.erro && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.erro}
        </p>
      )}
    </div>
  );
}
