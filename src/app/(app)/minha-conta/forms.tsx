"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { aplicarMascara } from "@/lib/format";
import { salvarPerfil, trocarSenha, type ContaState } from "./actions";

function useAviso(state: ContaState, aoOk?: () => void) {
  useEffect(() => {
    if (state.ok) {
      toast.success(state.ok);
      aoOk?.();
    } else if (state.erro) toast.error(state.erro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

export function ContaForms({ nome, email, celular, papel }: { nome: string; email: string; celular: string; papel: string }) {
  const [perfilState, perfilAction, perfilPending] = useActionState<ContaState, FormData>(salvarPerfil, {});
  const [senhaState, senhaAction, senhaPending] = useActionState<ContaState, FormData>(trocarSenha, {});
  const [cel, setCel] = useState(celular);
  const senhaForm = useRef<HTMLFormElement>(null);
  useAviso(perfilState);
  useAviso(senhaState, () => senhaForm.current?.reset());

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Detalhes do perfil</CardTitle>
          <CardDescription>
            Perfil de acesso: <span className="capitalize">{papel}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={perfilAction} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" name="nome" defaultValue={nome} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={email} disabled />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="celular">Celular</Label>
              <Input
                id="celular"
                name="celular"
                inputMode="numeric"
                value={cel}
                onChange={(e) => setCel(aplicarMascara(e.target.value, "telefone"))}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={perfilPending}>
                {perfilPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alteração de senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={senhaForm} action={senhaAction} className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="atual">Senha atual</Label>
              <Input id="atual" name="atual" type="password" autoComplete="current-password" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nova">Nova senha</Label>
              <Input id="nova" name="nova" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirma">Confirme a nova senha</Label>
              <Input id="confirma" name="confirma" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={senhaPending}>
                {senhaPending ? "Alterando…" : "Alterar senha"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
