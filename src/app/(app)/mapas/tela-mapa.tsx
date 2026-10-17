"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cartao, Campo } from "@/components/astro/basicos";
import { BuscaItens, ModalApropriacao, cabecalho, celula, editavelCls, type Apropriacao, type CcSaldo } from "@/components/astro/itens";
import { selectClass } from "@/components/cadastros/registro-form";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { data as fmtData, dataHora } from "@/lib/format";
import { STATUS_MAPA, type ItemCatalogo } from "@/lib/compras/tipos";
import type { ItemEnvio } from "@/lib/solicitacoes/actions";
import {
  adicionarFornecedorMapa,
  alternarRegularizacao,
  apropriarItemMapa,
  efetivarMapa,
  excluirApropriacaoMapa,
  excluirArquivoMapa,
  excluirFornecedorMapa,
  finalizarCotacao,
  importarItensMapa,
  linkArquivoMapa,
  registrarArquivoMapa,
  salvarMapa,
  type DadosMapa,
  type Resultado,
} from "@/lib/mapas/actions";
import { GradeCotacao, type FornecedorMapa } from "./grade-cotacao";

// "Adicionar Mapa" e "Vizualizar Mapa" do AstroTools.

const TIPOS = [
  { valor: "compra", rotulo: "Compra de Materias" },
  { valor: "locacao", rotulo: "Serviço de Locação" },
  { valor: "servico", rotulo: "Serviço" },
];

export type ItemMapa = {
  id: number;
  e_titulo: boolean;
  item_id: number | null;
  codigo: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_medio: number | null;
  apropriacoes: (Apropriacao & { valor: number })[];
  comPedido: boolean;
};
export type CabecalhoMapa = {
  id: number;
  status: string;
  solicitante: string;
  obra_id: number;
  obra_rotulo: string;
  numero_cliente: number | null;
  regularizacao_engenharia: boolean;
  dados: DadosMapa;
};
type Opcao = { valor: string; rotulo: string };
type Arquivo = { id: number; nome: string; enviado_em: string };

type Linha = {
  chave: string;
  id?: number;
  e_titulo: boolean;
  item_id: number | null;
  codigo: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  valor_medio: number | null;
  excluir: boolean;
  apropriacoes: Apropriacao[];
};

const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const vlMedio = (v: number | null) => (v == null ? "N/A" : `R$ ${v.toFixed(2).replace(".", ",")}`);
const numero = (s: string) => {
  const t = s.trim();
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : NaN;
};
let seq = 0;
const novaChave = () => `n${++seq}`;
const DADOS_VAZIOS: DadosMapa = { obra_id: "", servico: "", apropriacao: "", observacao: "", tipo: "", data_entrega: "", prazo_locacao: "", data_devolucao: "" };

function useAcao() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const rodar = (fn: () => Promise<Resultado>, ok: string, depois?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.erro);
      toast.success(ok);
      depois?.();
      router.refresh();
    });
  return { pending, rodar };
}

function ModalFornecedores({
  mapaId,
  fornecedores,
  opcoes,
  onFechar,
}: {
  mapaId: number;
  fornecedores: FornecedorMapa[];
  opcoes: (Opcao & { bloqueado: boolean })[];
  onFechar: () => void;
}) {
  const [f, setF] = useState("");
  const [busca, setBusca] = useState("");
  const { pending, rodar } = useAcao();
  const lista = opcoes.filter((o) => !fornecedores.some((x) => String(x.fornecedor_id) === o.valor) && o.rotulo.toLowerCase().includes(busca.trim().toLowerCase())).slice(0, 300);
  return (
    <div>
      <Campo rotulo="Fornecedor:" htmlFor="mf-f">
        <Input placeholder="Filtrar fornecedor…" value={busca} onChange={(e) => setBusca(e.target.value)} className="mb-[0.5rem]" />
        <select id="mf-f" value={f} onChange={(e) => setF(e.target.value)} className={selectClass}>
          <option value="">Selecione</option>
          {lista.map((o) => (
            <option key={o.valor} value={o.valor} disabled={o.bloqueado}>
              {o.rotulo}
              {o.bloqueado ? " (bloqueado)" : ""}
            </option>
          ))}
        </select>
      </Campo>
      <div className="mb-[1rem] flex gap-[0.5rem]">
        <Button disabled={pending || !f} onClick={() => rodar(() => adicionarFornecedorMapa(mapaId, Number(f)), "Fornecedor incluído.", () => setF(""))}>
          Adicionar
        </Button>
        <Button variant="outline" onClick={onFechar}>
          Voltar
        </Button>
      </div>
      <table className="w-full text-[1rem]">
        <thead>
          <tr>
            <th className={cabecalho}>ID</th>
            <th className={cabecalho}>Fornecedor</th>
            <th className={cabecalho}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {fornecedores.length === 0 && (
            <tr>
              <td colSpan={3} className={cn(celula, "text-center")}>
                Nenhum fornecedor
              </td>
            </tr>
          )}
          {fornecedores.map((x) => (
            <tr key={x.fornecedor_id}>
              <td className={celula}>{x.fornecedor_id}</td>
              <td className={celula}>{x.nome}</td>
              <td className={celula}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    confirm("Confirma exclusão do Fornecedor? Esta opção exclui todas as cotações Vinculadas?") &&
                    rodar(() => excluirFornecedorMapa(mapaId, x.fornecedor_id), "Fornecedor excluído.")
                  }
                  className="rounded-[0.358rem] bg-[#ea5455] px-[0.7rem] py-[0.2rem] text-[0.857rem] text-white"
                >
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModalArquivos({ mapaId, arquivos }: { mapaId: number; arquivos: Arquivo[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const { pending, rodar } = useAcao();
  const [enviando, setEnviando] = useState(false);
  const enviar = async () => {
    const files = [...(ref.current?.files ?? [])];
    if (!files.length) return void toast.error("Escolha um arquivo.");
    setEnviando(true);
    const supabase = createClient();
    for (const file of files) {
      const caminho = `${mapaId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error } = await supabase.storage.from("mapa-arquivos").upload(caminho, file);
      if (error) {
        toast.error(`Falha ao enviar ${file.name}: ${error.message}`);
        continue;
      }
      await registrarArquivoMapa(mapaId, caminho, file.name, file.size);
    }
    setEnviando(false);
    if (ref.current) ref.current.value = "";
    rodar(async () => ({ ok: true }), "Arquivo(s) enviado(s).");
  };
  return (
    <div>
      <h6 className="mb-[0.5rem] text-[1rem] font-medium">Arquivos:</h6>
      <div className="flex gap-2">
        <Input ref={ref} type="file" multiple />
        <Button onClick={enviar} disabled={enviando || pending}>
          {enviando ? "Enviando…" : "Adicionar"}
        </Button>
      </div>
      <table className="mt-[1.5rem] w-full text-[1rem]">
        <thead>
          <tr>
            <th className={cabecalho}>Arquivo</th>
            <th className={cabecalho}>Data</th>
            <th className={cabecalho} />
          </tr>
        </thead>
        <tbody>
          {arquivos.length === 0 && (
            <tr>
              <td colSpan={3} className={cn(celula, "text-center")}>
                Nenhum registro encontrado
              </td>
            </tr>
          )}
          {arquivos.map((a) => (
            <tr key={a.id}>
              <td className={celula}>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={async () => {
                    const r = await linkArquivoMapa(a.id);
                    if (!r.ok) return void toast.error(r.erro);
                    window.open(r.url, "_blank");
                  }}
                >
                  {a.nome}
                </button>
              </td>
              <td className={celula}>{dataHora(a.enviado_em)}</td>
              <td className={celula}>
                <button type="button" aria-label="Excluir" className="text-[#ea5455]" onClick={() => confirm("Excluir o arquivo?") && rodar(() => excluirArquivoMapa(mapaId, a.id), "Arquivo excluído.")}>
                  <Trash2 className="size-[14px]" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function paraLinha(i: ItemMapa): Linha {
  return {
    chave: `i${i.id}`,
    id: i.id,
    e_titulo: i.e_titulo,
    item_id: i.item_id,
    codigo: i.codigo ?? "0",
    descricao: i.descricao,
    quantidade: n2(Number(i.quantidade)),
    unidade: i.unidade,
    valor_medio: i.valor_medio,
    excluir: false,
    apropriacoes: i.apropriacoes,
  };
}

/** Lê "Importar Itens Excel": A Título (1 ou vazio), B Item, C Quantidade, D Unidade, E Valor — a partir da linha 2. */
function lerExcel(texto: string): Linha[] {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).slice(1).filter((l) => l.trim());
  return linhas.map((l) => {
    const sep = l.includes("\t") ? "\t" : l.includes(";") ? ";" : ",";
    const [tit, item, qtd, un, valor] = l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const v = numero(valor ?? "");
    return {
      chave: novaChave(),
      e_titulo: tit === "1",
      item_id: null,
      codigo: "0",
      descricao: item ?? "",
      quantidade: qtd || "0",
      unidade: un ?? "",
      valor_medio: valor && !Number.isNaN(v) ? v : null,
      excluir: false,
      apropriacoes: [],
    };
  });
}

export function TelaMapa({
  cabecalho: cab,
  itens,
  obras,
  catalogo,
  ccs,
  fornecedores,
  opcoesFornecedores,
  precos,
  arquivos,
  solicitacoesObra,
  podeMontar,
  podeCotar,
}: {
  cabecalho: CabecalhoMapa | null;
  itens: ItemMapa[];
  obras: Opcao[];
  catalogo: ItemCatalogo[];
  ccs: CcSaldo[];
  fornecedores: FornecedorMapa[];
  opcoesFornecedores: (Opcao & { bloqueado: boolean })[];
  precos: Record<string, number>;
  arquivos: Arquivo[];
  solicitacoesObra: { id: number; servico: string; criado_em: string }[];
  podeMontar: boolean;
  podeCotar: boolean;
}) {
  const router = useRouter();
  const novo = cab === null;
  const digitacao = novo || cab.status === "digitacao";
  const editavel = podeMontar && digitacao;
  const [d, setD] = useState<DadosMapa>(cab?.dados ?? DADOS_VAZIOS);
  const [linhas, setLinhas] = useState<Linha[]>(() => itens.map(paraLinha));
  const [ativa, setAtiva] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "fornecedores" | "cotacao" | "parcial" | "arquivos" | "importar" | "excel">(null);
  const [aprop, setAprop] = useState<Linha | null>(null);
  const [textoExcel, setTextoExcel] = useState("");
  const [pending, startTransition] = useTransition();
  const { rodar } = useAcao();

  const inserir = (l: Linha) =>
    setLinhas((ls) => {
      const i = ativa ? ls.findIndex((x) => x.chave === ativa) : -1;
      return i < 0 ? [...ls, l] : [...ls.slice(0, i + 1), l, ...ls.slice(i + 1)];
    });
  const mudar = (chave: string, p: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...p } : l)));
  const campo = (k: keyof DadosMapa) => ({ value: d[k], onChange: (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value }), disabled: !editavel });

  const salvar = () => {
    const envio: ItemEnvio[] = [];
    for (const l of linhas) {
      if (!l.descricao.trim() && !l.id) continue;
      const q = numero(l.quantidade || "0");
      if (Number.isNaN(q)) return void toast.error(`Quantidade inválida em "${l.descricao}".`);
      envio.push({ id: l.id, e_titulo: l.e_titulo, item_id: l.item_id, codigo: l.codigo, descricao: l.descricao.trim(), quantidade: q, unidade: l.unidade.trim(), valor_medio: l.valor_medio, excluir: l.excluir });
    }
    startTransition(async () => {
      const r = await salvarMapa(cab?.id ?? null, d, envio);
      if (!r.ok) return void toast.error(r.erro);
      toast.success("Mapa salvo com sucesso.");
      if (novo) router.push(`/mapas/${r.id}`);
      else router.refresh();
    });
  };

  const itensCotacao = itens.map((i) => ({
    id: i.id,
    descricao: i.descricao,
    unidade: i.unidade,
    quantidade: Number(i.quantidade),
    orcamento: i.apropriacoes.reduce((s, a) => s + a.valor, 0),
    e_titulo: i.e_titulo,
    comPedido: i.comPedido,
  }));
  const status = cab ? STATUS_MAPA[cab.status] : null;
  const btnVerde = "bg-primary text-white";

  return (
    <Cartao>
      {novo ? (
        <div className="border-b border-border px-[1.5rem] py-[1.5rem]">
          <h4 className="mb-0 text-[1.285rem] font-medium">Novo Mapa</h4>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-[1.5rem] py-[1.5rem]">
          <div className="flex items-center gap-[1.5rem]">
            <h4 className="mb-0 text-[1.285rem] font-medium">Mapa: {cab.id}</h4>
            <Button
              variant="outline"
              disabled={!podeMontar}
              onClick={() =>
                confirm("Confirma a alteração do status de 'Regularização Engenharia' para esse Mapa?") && rodar(() => alternarRegularizacao(cab.id), "Regularização Engenharia alterada.")
              }
              className={cn(cab.regularizacao_engenharia && "border-primary text-primary")}
            >
              {cab.regularizacao_engenharia ? "Regularização Engenharia: Sim" : "Clique aqui para Regularização Engenharia"}
            </Button>
          </div>
          <span className="text-[1rem] font-semibold">
            Status: <span className={cn(cab.status === "finalizado" ? "text-primary" : "text-[#ff9f43]")}>{status?.rotulo ?? cab.status}</span>
          </span>
          <h4 className="mb-0 text-[1.285rem] font-medium">Solicitante: {cab.solicitante}</h4>
        </div>
      )}

      <div className="px-[1.5rem] pt-[1.5rem]">
        <div className={cn("grid gap-x-[2rem]", novo ? "md:grid-cols-[3fr_4.5fr_1.5fr]" : "md:grid-cols-[3fr_4fr_1.5fr_0.62fr]")}>
          <Campo rotulo="Obra" htmlFor="m-obra">
            {novo ? (
              <select id="m-obra" value={d.obra_id} onChange={(e) => setD({ ...d, obra_id: e.target.value })} className={selectClass}>
                <option value="">Selecione uma Obra</option>
                {obras.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            ) : (
              <Input id="m-obra" value={cab.obra_rotulo} disabled />
            )}
          </Campo>
          <Campo rotulo="Serviço" htmlFor="m-serv">
            <Input id="m-serv" {...campo("servico")} />
          </Campo>
          <Campo rotulo="Apropriação" htmlFor="m-aprop">
            <Input id="m-aprop" {...campo("apropriacao")} />
          </Campo>
          {!novo && (
            <Campo rotulo="Num. Cliente" htmlFor="m-num">
              <Input id="m-num" value={cab.numero_cliente ?? ""} disabled />
            </Campo>
          )}
        </div>
        <Campo rotulo="Observação" htmlFor="m-obs">
          <Textarea id="m-obs" rows={3} {...campo("observacao")} />
        </Campo>
        <div className="grid gap-x-[2rem] md:grid-cols-4">
          <Campo rotulo="Serviço" htmlFor="m-tipo">
            <select id="m-tipo" {...campo("tipo")} className={selectClass}>
              <option value="">Selecione</option>
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Data de Entrega" htmlFor="m-ent">
            <Input id="m-ent" type="date" {...campo("data_entrega")} />
          </Campo>
          <Campo rotulo="Prazo de Locação" htmlFor="m-prazo">
            <Input id="m-prazo" {...campo("prazo_locacao")} />
          </Campo>
          <Campo rotulo="Data de Devolução" htmlFor="m-dev">
            <Input id="m-dev" type="date" {...campo("data_devolucao")} />
          </Campo>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-[1.5rem] py-[0.2rem]">
        <div className="flex flex-wrap gap-[1rem]">
          {!novo && digitacao && (
            <Button
              disabled={!podeMontar || pending}
              onClick={() => confirm("Confirma o envio do Mapa para Cotação? Esta opção bloqueia possiveis alterações!") && rodar(() => efetivarMapa(cab.id), "Mapa enviado para cotação.")}
            >
              Efetivar Mapa
            </Button>
          )}
          {!novo && (
            <>
              <Button className={btnVerde} onClick={() => setModal("cotacao")}>
                Cotação
              </Button>
              <Button className={btnVerde} onClick={() => setModal("parcial")}>
                Pedido Parcial
              </Button>
              <Button className={btnVerde} disabled={!podeCotar} onClick={() => setModal("fornecedores")}>
                Fornecedores
              </Button>
              {cab.status === "cotacao" && podeCotar && (
                <Button
                  variant="outline"
                  onClick={() => confirm("Confirma o encerramento da Cotação Suprimentos?") && rodar(() => finalizarCotacao(cab.id), "Cotação de Suprimentos finalizada.")}
                >
                  Finalizar Cotação Suprimentos
                </Button>
              )}
            </>
          )}
        </div>
        <div className="flex gap-[0.3rem]">
          <Button onClick={salvar} disabled={!editavel || pending} className="disabled:opacity-65">
            Salvar
          </Button>
          {!novo && (
            <>
              <Button variant="outline" onClick={() => setModal("arquivos")}>
                Arquivos
              </Button>
              <Button variant="outline" onClick={() => window.open(`/imprimir/mapa/${cab.id}`, "_blank")}>
                PDF
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => router.back()}>
            {novo ? "cancelar" : "Voltar"}
          </Button>
        </div>
      </div>

      <div className="px-[1.5rem] pt-[1.5rem] pb-[2.5rem]">
        <fieldset disabled={!editavel} className="mb-[1rem] space-y-[1rem]">
          <BuscaItens
            catalogo={catalogo}
            onAdicionar={(c) =>
              inserir({
                chave: novaChave(),
                e_titulo: false,
                item_id: c.id,
                codigo: c.codigo,
                descricao: c.descricao,
                quantidade: "0",
                unidade: c.unidade,
                valor_medio: c.valor_medio,
                excluir: false,
                apropriacoes: [],
              })
            }
          />
          <div className="flex flex-wrap gap-[0.5rem]">
            <Button
              variant="outline"
              onClick={() =>
                inserir({ chave: novaChave(), e_titulo: false, item_id: null, codigo: "0", descricao: "", quantidade: "0", unidade: "", valor_medio: null, excluir: false, apropriacoes: [] })
              }
            >
              Adicionar Linha
            </Button>
            {!novo && (
              <Button variant="outline" onClick={() => setModal("importar")}>
                Importar Itens
              </Button>
            )}
            <Button variant="outline" onClick={() => setModal("excel")}>
              Importar Excel
            </Button>
          </div>
        </fieldset>

        <div className="overflow-x-auto">
          <table className="w-full text-[1rem]">
            <thead>
              <tr>
                <th className={cn(cabecalho, "w-[5%]")}>{novo ? "Titulo" : "Tit."}</th>
                <th className={cn(cabecalho, "w-[6%]")}>{novo ? "Cod" : "Cod."}</th>
                <th className={cabecalho}>Item</th>
                <th className={cn(cabecalho, "w-[9%]")}>Qtde</th>
                <th className={cn(cabecalho, "w-[8%]")}>Unid.Med</th>
                <th className={cn(cabecalho, "w-[9%]")}>Vl.Médio</th>
                <th className={cn(cabecalho, "w-[8%]")}>{novo ? "Del." : "Ações"}</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const livre = l.item_id == null;
                const pode = editavel && !l.excluir;
                return (
                  <tr
                    key={l.chave}
                    onClick={() => setAtiva(l.chave)}
                    className={cn(ativa === l.chave && "bg-[#f3f2f7] dark:bg-[#242b3d]", l.excluir && "opacity-50", l.e_titulo && "font-semibold")}
                  >
                    <td className={cn(celula, "text-center")}>
                      <input
                        type="checkbox"
                        checked={l.e_titulo}
                        disabled={!pode || !livre}
                        onChange={(e) => mudar(l.chave, { e_titulo: e.target.checked })}
                        className="size-[14px] accent-primary"
                        aria-label="Título"
                      />
                    </td>
                    <td className={celula}>{l.codigo}</td>
                    <td className={celula}>
                      {pode && livre ? <input value={l.descricao} onChange={(e) => mudar(l.chave, { descricao: e.target.value })} className={editavelCls} aria-label="Item" /> : l.descricao}
                    </td>
                    <td className={celula}>
                      {pode ? <input value={l.quantidade} onChange={(e) => mudar(l.chave, { quantidade: e.target.value })} className={editavelCls} aria-label="Quantidade" /> : l.quantidade}
                    </td>
                    <td className={celula}>
                      {pode && livre ? <input value={l.unidade} onChange={(e) => mudar(l.chave, { unidade: e.target.value })} className={editavelCls} aria-label="Unidade" /> : l.unidade}
                    </td>
                    <td className={celula}>{vlMedio(l.valor_medio)}</td>
                    <td className={celula}>
                      <div className="flex flex-col items-start gap-[0.5rem]">
                        {editavel && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!l.id) setLinhas((ls) => ls.filter((x) => x.chave !== l.chave));
                              else mudar(l.chave, { excluir: !l.excluir });
                            }}
                            className={cn("rounded-[0.358rem] px-[0.9rem] py-[0.3rem] text-[0.857rem] text-white", l.excluir ? "bg-[#28c76f]" : "bg-[#ea5455]")}
                          >
                            {l.excluir ? "Adicionar" : "Excluir"}
                          </button>
                        )}
                        {!novo && !l.e_titulo && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!l.id) return void toast.info("Salve o mapa antes de apropriar este item.");
                              setAprop(l);
                            }}
                            className={cn("px-[0.4rem] text-[1rem] text-[#ff9f43]", l.apropriacoes.length > 0 && "border border-[#ff9f43] bg-[#ffff00]")}
                          >
                            Aprop.
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={aprop !== null} onOpenChange={(o) => !o && setAprop(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-[1.285rem] font-medium text-heading">Apropriações</DialogTitle>
          </DialogHeader>
          {aprop && cab && (
            <ModalApropriacao
              key={aprop.chave}
              linha={{ ...(linhas.find((l) => l.chave === aprop.chave) ?? aprop), bloqueado: !digitacao }}
              ccs={ccs}
              podeEditar={editavel}
              onApropriar={(itemId, ccId) => apropriarItemMapa(cab.id, itemId, ccId)}
              onExcluir={(id) => excluirApropriacaoMapa(cab.id, id)}
              onFechar={() => setAprop(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={modal !== null} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className={cn(modal === "cotacao" || modal === "parcial" ? "sm:max-w-[min(95vw,90rem)]" : "sm:max-w-3xl")}>
          <DialogHeader>
            <DialogTitle className="text-[1.285rem] font-medium text-heading">
              {modal === "fornecedores"
                ? "Fornecedores"
                : modal === "cotacao" || modal === "parcial"
                  ? "Cotações"
                  : modal === "arquivos"
                    ? "Arquivos"
                    : modal === "excel"
                      ? "Importar Itens Excel"
                      : "Importar Itens"}
            </DialogTitle>
          </DialogHeader>
          {cab && modal === "fornecedores" && <ModalFornecedores mapaId={cab.id} fornecedores={fornecedores} opcoes={opcoesFornecedores} onFechar={() => setModal(null)} />}
          {cab && (modal === "cotacao" || modal === "parcial") && (
            <GradeCotacao
              key={`${modal}-${JSON.stringify(precos)}-${fornecedores.length}`}
              mapaId={cab.id}
              itens={itensCotacao}
              fornecedores={fornecedores}
              precos={precos}
              modo={modal === "cotacao" ? "total" : "parcial"}
              podeCotar={podeCotar}
              editavel={cab.status === "cotacao" || cab.status === "aberto"}
              onFechar={() => setModal(null)}
              onPdf={() => window.open(`/imprimir/mapa/${cab.id}`, "_blank")}
            />
          )}
          {cab && modal === "arquivos" && <ModalArquivos mapaId={cab.id} arquivos={arquivos} />}
          {cab && modal === "importar" && (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-[1rem]">
                <thead>
                  <tr>
                    <th className={cabecalho}>Cod.</th>
                    <th className={cabecalho}>Serviço</th>
                    <th className={cabecalho}>Data</th>
                    <th className={cabecalho}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitacoesObra.length === 0 && (
                    <tr>
                      <td colSpan={4} className={cn(celula, "text-center")}>
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  )}
                  {solicitacoesObra.map((s) => (
                    <tr key={s.id}>
                      <td className={celula}>{s.id}</td>
                      <td className={celula}>{s.servico}</td>
                      <td className={celula}>{fmtData(s.criado_em)}</td>
                      <td className={celula}>
                        <Button
                          size="sm"
                          disabled={!editavel || pending}
                          onClick={() => confirm(`Confirma A importação dos itens? Solicitação:${s.id}`) && rodar(() => importarItensMapa(cab.id, s.id), "Itens importados.", () => setModal(null))}
                        >
                          Imp.
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {modal === "excel" && (
            <div>
              <Campo rotulo="Arquivo" htmlFor="ex-arq">
                <Input
                  id="ex-arq"
                  type="file"
                  accept=".csv,.txt"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const buf = await f.arrayBuffer();
                    let t = new TextDecoder("utf-8").decode(buf);
                    if (t.includes("�")) t = new TextDecoder("windows-1252").decode(buf);
                    setTextoExcel(t);
                  }}
                />
              </Campo>
              <Campo rotulo="Mensagem" htmlFor="ex-txt">
                <Textarea
                  id="ex-txt"
                  rows={8}
                  value={textoExcel}
                  onChange={(e) => setTextoExcel(e.target.value)}
                  className="font-mono text-[0.85rem]"
                  placeholder={"Leitura a partir da linha 2 onde:\nColuna A: Titulo - Informar 1 ou Vazio\nColuna B: Item\nColuna C: Quantidade\nColuna D: Unidade Medida\nColuna E: Valor\n(cole do Excel ou abra um CSV)"}
                />
              </Campo>
              <Button
                disabled={!editavel || !textoExcel.trim()}
                onClick={() => {
                  const novas = lerExcel(textoExcel).filter((l) => l.descricao);
                  if (!novas.length) return void toast.error("Nenhuma linha válida a partir da linha 2.");
                  setLinhas((ls) => [...ls, ...novas]);
                  setTextoExcel("");
                  setModal(null);
                  toast.success(`${novas.length} linha(s) incluída(s). Clique em Salvar.`);
                }}
              >
                Processar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Cartao>
  );
}
