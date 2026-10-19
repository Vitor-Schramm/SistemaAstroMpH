"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Delete, Link2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Cartao, Campo } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { selectClass } from "@/components/cadastros/registro-form";
import { zerarSaldoOc } from "@/lib/ocs/actions";

// "Vincular Pedido x Nota" (Fase Cinza e Fase Azul) do AstroTools.

export type OcVinculo = {
  id: number;
  obra_id: number;
  fornecedor_id: number;
  nome: string | null;
  numero_cliente: number | null;
  cliente_nome: string | null;
  fornecedor_nome: string;
  fornecedor_fantasia: string | null;
  valor_total: number;
  disponivel: number;
};
type Opcao = { valor: string; rotulo: string };
const real = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ListaVinculo({ fase, ocs, obras, fornecedores }: { fase: "cinza" | "azul"; ocs: OcVinculo[]; obras: Opcao[]; fornecedores: Opcao[] }) {
  const router = useRouter();
  const [obra, setObra] = useState("");
  const [forn, setForn] = useState("");
  const [resultado, setResultado] = useState<OcVinculo[] | null>(null);
  const [, startTransition] = useTransition();

  const filtrar = () => setResultado(ocs.filter((o) => (!obra || String(o.obra_id) === obra) && (!forn || String(o.fornecedor_id) === forn)));

  const colunas: ColunaTabela<OcVinculo>[] = [
    { chave: "num", titulo: "Num. OC", valor: (o) => o.numero_cliente ?? o.id, className: "font-semibold" },
    { chave: "cli", titulo: "Cliente", valor: (o) => o.cliente_nome ?? "", className: "font-semibold uppercase" },
    { chave: "serv", titulo: "Serviço", valor: (o) => o.nome ?? "", className: "font-semibold" },
    { chave: "forn", titulo: "Fornecedor", valor: (o) => o.fornecedor_fantasia || o.fornecedor_nome, className: "font-semibold uppercase" },
    { chave: "valor", titulo: "Valor", valor: (o) => Number(o.valor_total), render: (o) => real(o.valor_total), className: "font-semibold whitespace-nowrap" },
    { chave: "disp", titulo: "Disponivel", valor: (o) => Number(o.disponivel), render: (o) => real(o.disponivel), className: "font-semibold whitespace-nowrap" },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (o) => (
        <span className="flex items-center gap-[0.6rem]">
          <Link href={`/ordens-compra/${o.id}`} title="Vizualizar Pedido" className="text-primary">
            <Search className="size-[14px]" />
          </Link>
          <Link href={`/vincular/${fase}/${o.id}`} title="Vincular NF" className="text-primary">
            <Link2 className="size-[14px]" />
          </Link>
          {fase === "cinza" && (
            <button
              type="button"
              title="Zerar Saldo Pedido"
              className="text-primary"
              onClick={() => {
                if (!confirm("Confirma a operação? Esta opção zera o saldo apropriado não utilizado!")) return;
                startTransition(async () => {
                  const r = await zerarSaldoOc(o.id);
                  if (!r.ok) return void toast.error(`Erro: ${r.erro} Tenta novamente!`);
                  toast.success("Operação efetuada com sucesso!");
                  setResultado((l) => l?.filter((x) => x.id !== o.id) ?? null);
                  router.refresh();
                });
              }}
            >
              <Delete className="size-[14px]" />
            </button>
          )}
        </span>
      ),
    },
  ];

  return (
    <Cartao>
      <div className="border-b border-border px-[1.5rem] py-[1.5rem]">
        <h4 className="mb-0 text-[1.285rem] font-medium">Vincular Pedido x Nota</h4>
      </div>
      <div className="px-[1.5rem] pt-[1.5rem] pb-[1.5rem]">
        <div className="grid gap-x-[2rem] md:grid-cols-2">
          <Campo rotulo="Obra" htmlFor="vf-obra">
            <select id="vf-obra" value={obra} onChange={(e) => setObra(e.target.value)} className={selectClass}>
              <option value="">Selecione uma Obra</option>
              {obras.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Fornecedor" htmlFor="vf-forn">
            <select id="vf-forn" value={forn} onChange={(e) => setForn(e.target.value)} className={selectClass}>
              <option value="">Selecione um Fornecedor</option>
              {fornecedores.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Button onClick={filtrar}>Filtrar</Button>
      </div>
      {resultado && (
        <div className="border-t border-border">
          <TabelaDados colunas={colunas} linhas={resultado} chave={(o) => o.id} nomeArquivo={`vincular-${fase}`} />
        </div>
      )}
    </Cartao>
  );
}
