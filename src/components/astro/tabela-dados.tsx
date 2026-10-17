"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clipboard, Copy, ExternalLink, File, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Tabela no padrão DataTables do AstroTools: "Exibir N resultados por página", "Pesquisar",
// "Exportar" (Imprimir/Csv/Excel/Pdf/Copiar), ordenação por coluna e paginação.

export type ColunaTabela<T> = {
  chave: string;
  titulo: string;
  /** Texto usado na busca, na ordenação e na exportação. */
  valor: (linha: T) => string | number | null;
  render?: (linha: T) => React.ReactNode;
  ordenavel?: boolean;
  exportar?: boolean;
  className?: string;
};

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function SetasOrdem({ estado }: { estado: "asc" | "desc" | null }) {
  return (
    <span className="ml-auto flex flex-col leading-none text-[0.7rem]">
      <span className={cn("opacity-30", estado === "asc" && "opacity-100")}>▲</span>
      <span className={cn("opacity-30", estado === "desc" && "opacity-100")}>▼</span>
    </span>
  );
}

export function TabelaDados<T>({
  colunas,
  linhas,
  chave,
  nomeArquivo = "dados",
  porPaginaInicial = 10,
  vazio = "Nenhum registro encontrado",
}: {
  colunas: ColunaTabela<T>[];
  linhas: T[];
  chave: (linha: T) => string | number;
  nomeArquivo?: string;
  porPaginaInicial?: number;
  vazio?: string;
}) {
  const [porPagina, setPorPagina] = useState(porPaginaInicial);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [ordem, setOrdem] = useState<{ col: string; dir: "asc" | "desc" } | null>(null);

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    let r = q ? linhas.filter((l) => colunas.some((c) => normalizar(String(c.valor(l) ?? "")).includes(q))) : linhas;
    if (ordem) {
      const col = colunas.find((c) => c.chave === ordem.col)!;
      r = [...r].sort((a, b) => {
        const va = col.valor(a);
        const vb = col.valor(b);
        const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR", { numeric: true });
        return ordem.dir === "asc" ? cmp : -cmp;
      });
    }
    return r;
  }, [linhas, colunas, busca, ordem]);

  const total = filtradas.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const atual = Math.min(pagina, paginas - 1);
  const visiveis = filtradas.slice(atual * porPagina, (atual + 1) * porPagina);
  const exportaveis = colunas.filter((c) => c.exportar !== false);

  const matriz = () => [exportaveis.map((c) => c.titulo), ...filtradas.map((l) => exportaveis.map((c) => String(c.valor(l) ?? "")))];
  const baixar = (conteudo: string, tipo: string, ext: string) => {
    const url = URL.createObjectURL(new Blob(["﻿" + conteudo], { type: tipo }));
    Object.assign(document.createElement("a"), { href: url, download: `${nomeArquivo}.${ext}` }).click();
    URL.revokeObjectURL(url);
  };
  const html = () => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const [cab, ...corpo] = matriz();
    return `<table border="1"><thead><tr>${cab.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${corpo
      .map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;
  };
  const imprimir = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${nomeArquivo}</title><style>body{font-family:Montserrat,Arial;font-size:12px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px}</style></head><body>${html()}</body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div>
      <div className="mx-[1.5rem] mt-[1rem] flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[1rem]">
          Exibir
          <select
            value={porPagina}
            onChange={(e) => {
              setPorPagina(Number(e.target.value));
              setPagina(0);
            }}
            className="h-[38px] rounded-[0.357rem] border border-input bg-card px-[0.8rem] text-[1rem]"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          resultados por página
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[1rem]">
            Pesquisar
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(0);
              }}
              placeholder="Buscar registros"
              className="h-[38px] w-[200px] rounded-[0.357rem] border border-input bg-card px-[1rem] text-[1rem] outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-[38px] items-center gap-2 rounded-[0.358rem] border border-[#82868b] px-[1.5rem] text-[1rem] text-[#82868b] hover:bg-[rgba(130,134,139,0.04)]">
              <ExternalLink className="size-[14px]" /> Exportar
              <ChevronRight className="size-[14px] rotate-90" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={imprimir}>
                <Printer /> Imprimir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => baixar(matriz().map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\r\n"), "text/csv;charset=utf-8", "csv")}>
                <FileText /> Csv
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => baixar(html(), "application/vnd.ms-excel;charset=utf-8", "xls")}>
                <File /> Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={imprimir}>
                <Clipboard /> Pdf
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(matriz().map((l) => l.join("\t")).join("\n"));
                  toast.success(`${total} linhas copiadas para a área de transferência`);
                }}
              >
                <Copy /> Copiar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-[1rem] overflow-x-auto">
        <table className="w-full text-[1rem]">
          <thead>
            <tr>
              {colunas.map((c) => {
                const ordenavel = c.ordenavel !== false;
                const estado = ordem?.col === c.chave ? ordem.dir : null;
                return (
                  <th
                    key={c.chave}
                    onClick={
                      ordenavel ? () => setOrdem(estado === "asc" ? { col: c.chave, dir: "desc" } : estado === "desc" ? null : { col: c.chave, dir: "asc" }) : undefined
                    }
                    className={cn(
                      "border-b border-[#ebe9f1] bg-muted py-[0.72rem] pr-[1.5rem] pl-[1.5rem] text-left align-middle text-[0.857rem] font-bold tracking-[0.5px] text-[#22292f] uppercase dark:text-heading",
                      ordenavel && "cursor-pointer select-none",
                      c.className,
                    )}
                  >
                    <span className="flex items-center gap-3">
                      {c.titulo}
                      {ordenavel && <SetasOrdem estado={estado} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={colunas.length} className="border-b border-border px-[1.5rem] py-[0.72rem] text-center">
                  {vazio}
                </td>
              </tr>
            )}
            {visiveis.map((l) => (
              <tr key={chave(l)} className="hover:bg-[#f6f6f9] dark:hover:bg-[#242b3d]">
                {colunas.map((c) => (
                  <td key={c.chave} className={cn("border-b border-border px-[1.5rem] py-[0.72rem] align-middle", c.className)}>
                    {c.render ? c.render(l) : c.valor(l)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mx-[1.5rem] flex flex-wrap items-center justify-between gap-3 py-[1rem]">
        <span className="text-[1rem] text-muted-foreground">
          {total === 0 ? "Mostrando 0 até 0 de 0 registros" : `Mostrando de ${atual * porPagina + 1} até ${Math.min(total, (atual + 1) * porPagina)} de ${total} registros`}
          {busca && linhas.length !== total && ` (filtrados de ${linhas.length} registros no total)`}
        </span>
        <div className="flex items-center rounded-full bg-[#f3f2f7] dark:bg-[#242b3d]">
          <button type="button" disabled={atual === 0} onClick={() => setPagina(atual - 1)} className="flex items-center px-[0.6rem] py-[0.4rem] text-[1rem] disabled:opacity-50">
            <ChevronLeft className="size-[14px]" />
            Anterior
          </button>
          {Array.from({ length: paginas }, (_, i) => i)
            .filter((i) => paginas <= 7 || Math.abs(i - atual) <= 2 || i === 0 || i === paginas - 1)
            .map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPagina(i)}
                className={cn("flex size-[32px] items-center justify-center rounded-full text-[1rem]", i === atual && "bg-primary font-semibold text-white")}
              >
                {i + 1}
              </button>
            ))}
          <button
            type="button"
            disabled={atual >= paginas - 1}
            onClick={() => setPagina(atual + 1)}
            className="flex items-center px-[0.6rem] py-[0.4rem] text-[1rem] disabled:opacity-50"
          >
            Próximo
            <ChevronRight className="size-[14px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
