"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { selectClass } from "@/components/cadastros/registro-form";
import type { Tom } from "@/lib/compras/tipos";

export const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Barra de busca + filtro de status usada nas listagens de compras. */
export function FiltroLista({
  busca,
  onBusca,
  status,
  onStatus,
  opcoesStatus,
  placeholder = "Buscar por número, obra, cliente, fornecedor…",
}: {
  busca: string;
  onBusca: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
  opcoesStatus: Record<string, { rotulo: string; tom: Tom }>;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative min-w-60 flex-1">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={placeholder} value={busca} onChange={(e) => onBusca(e.target.value)} className="pl-8" />
      </div>
      <select value={status} onChange={(e) => onStatus(e.target.value)} className={`${selectClass} w-52`} aria-label="Filtrar por status">
        <option value="">Todos os status</option>
        {Object.entries(opcoesStatus).map(([v, s]) => (
          <option key={v} value={v}>
            {s.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}
