"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { aplicarMascara } from "@/lib/format";
import type { Campo, Entidade } from "@/lib/cadastros/config";
import { salvarRegistro, type SalvarState } from "@/lib/cadastros/actions";

export type Opcoes = Record<string, { valor: string; rotulo: string }[]>;
export type Registro = Record<string, unknown> & { id?: number };

export const selectClass =
  "h-[38px] w-full rounded-[0.357rem] border border-input bg-card px-[1rem] text-[1rem] text-foreground outline-none focus-visible:border-primary focus-visible:shadow-[0_3px_10px_0_rgba(34,41,47,0.1)] disabled:bg-[#efefef] aria-invalid:border-destructive";

const largura = { 1: "", 2: "sm:col-span-2", 3: "sm:col-span-3" } as const;

function CampoInput({ campo, valor, erro, opcoes }: { campo: Campo; valor: unknown; erro?: string; opcoes: Opcoes }) {
  const [texto, setTexto] = useState(valor == null ? "" : String(valor));
  const id = `f-${campo.nome}`;
  const comum = { id, name: campo.nome, required: campo.obrigatorio, "aria-invalid": Boolean(erro) || undefined };

  if (campo.tipo === "boolean") {
    return (
      <label className="flex h-9 items-center gap-2 text-sm sm:mt-6">
        <input type="checkbox" name={campo.nome} defaultChecked={Boolean(valor)} className="size-4 accent-primary" />
        {campo.rotulo}
      </label>
    );
  }

  const lista = campo.relacao ? opcoes[campo.relacao] ?? [] : campo.opcoes ?? [];

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {campo.rotulo}
        {campo.obrigatorio && <span className="text-destructive">*</span>}
      </Label>
      {campo.tipo === "select" ? (
        <select {...comum} defaultValue={valor == null ? "" : String(valor)} className={selectClass}>
          <option value="">Selecione…</option>
          {lista.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      ) : campo.tipo === "textarea" ? (
        <Textarea {...comum} defaultValue={texto} rows={3} />
      ) : (
        <Input
          {...comum}
          type={campo.tipo === "number" ? "number" : campo.tipo}
          step={campo.tipo === "number" ? "any" : undefined}
          inputMode={campo.mascara && campo.mascara !== "moeda" ? "numeric" : undefined}
          value={texto}
          onChange={(e) => setTexto(aplicarMascara(e.target.value, campo.mascara))}
        />
      )}
      {erro && <span className="text-xs text-destructive">{erro}</span>}
    </div>
  );
}

export function RegistroForm({
  entidade,
  registro,
  opcoes,
  onSalvo,
}: {
  entidade: Entidade;
  registro: Registro | null;
  opcoes: Opcoes;
  onSalvo: () => void;
}) {
  const [state, action, pending] = useActionState<SalvarState, FormData>(
    salvarRegistro.bind(null, entidade.chave),
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(`${entidade.singular} ${entidade.feminino ? "salva" : "salvo"} com sucesso.`);
      onSalvo();
    } else if (state.erro) {
      toast.error(state.erro);
    }
  }, [state, entidade.singular, entidade.feminino, onSalvo]);

  return (
    <form action={action} className="grid gap-4">
      {registro?.id && <input type="hidden" name="id" value={registro.id} />}
      <div className="grid max-h-[65vh] gap-x-4 gap-y-3 overflow-y-auto px-1 sm:grid-cols-3">
        {entidade.campos.map((campo) => (
          <div key={campo.nome} className={cn(largura[campo.largura ?? 1], campo.secao && "contents")}>
            {campo.secao && (
              <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-3">
                {campo.secao}
              </h3>
            )}
            <div className={cn(campo.secao && largura[campo.largura ?? 1])}>
              <CampoInput campo={campo} valor={registro?.[campo.nome]} erro={state.erros?.[campo.nome]} opcoes={opcoes} />
            </div>
          </div>
        ))}
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
