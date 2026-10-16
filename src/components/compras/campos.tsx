"use client";

import type React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { selectClass } from "@/components/cadastros/registro-form";
import { cn } from "@/lib/utils";
import type { Opcao } from "@/lib/compras/tipos";

type Base = { id: string; rotulo: string; obrigatorio?: boolean; className?: string; desabilitado?: boolean };

function Rotulo({ id, rotulo, obrigatorio }: Base) {
  return (
    <Label htmlFor={id}>
      {rotulo}
      {obrigatorio && <span className="text-destructive">*</span>}
    </Label>
  );
}

export function CampoTexto({
  valor,
  onChange,
  tipo = "text",
  ...b
}: Base & { valor: string; onChange: (v: string) => void; tipo?: React.HTMLInputTypeAttribute }) {
  return (
    <div className={cn("grid gap-1.5", b.className)}>
      <Rotulo {...b} />
      <Input
        id={b.id}
        type={tipo}
        step={tipo === "number" ? "0.01" : undefined}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        required={b.obrigatorio}
        disabled={b.desabilitado}
      />
    </div>
  );
}

export function CampoArea({ valor, onChange, ...b }: Base & { valor: string; onChange: (v: string) => void }) {
  return (
    <div className={cn("grid gap-1.5", b.className)}>
      <Rotulo {...b} />
      <Textarea id={b.id} rows={2} value={valor} onChange={(e) => onChange(e.target.value)} disabled={b.desabilitado} />
    </div>
  );
}

export function CampoSelect({
  valor,
  onChange,
  opcoes,
  ...b
}: Base & { valor: string; onChange: (v: string) => void; opcoes: (Opcao & { bloqueado?: boolean })[] }) {
  return (
    <div className={cn("grid gap-1.5", b.className)}>
      <Rotulo {...b} />
      <select
        id={b.id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        required={b.obrigatorio}
        disabled={b.desabilitado}
        className={selectClass}
      >
        <option value="">Selecione…</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
            {o.bloqueado ? " (BLOQUEADO)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
