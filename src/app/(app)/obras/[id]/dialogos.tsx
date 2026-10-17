"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Campo } from "@/components/astro/basicos";
import { selectClass } from "@/components/cadastros/registro-form";
import { cn } from "@/lib/utils";
import { data as fmtData } from "@/lib/format";
import {
  adicionarFilial,
  adicionarPercentual,
  adicionarResponsavel,
  editarPlanilhaObra,
  excluirPagamentoCliente,
  excluirPercentual,
  importarPlanilha,
  removerFilial,
  removerResponsavel,
  salvarCc,
  salvarPagamentoCliente,
  type Resultado,
} from "@/lib/obras/actions";
import {
  lerPlanilhaTexto,
  MODOS,
  nivelPorCodigo,
  NIVEIS,
  numeroBr,
  type CentroCusto,
  type ModoPlanilha,
  type Nivel,
  type PagamentoCliente,
  type Percentual,
  type Planilha,
  type Responsavel,
} from "@/lib/obras/tipos";
import type { ObraDados } from "./controle-financeiro";

// Modais do Controle Financeiro, com os mesmos campos e botões do AstroTools.

type Opcao = { valor: string; rotulo: string };

const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

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

const th = "border-b border-[#ebe9f1] bg-muted px-[1.5rem] py-[0.72rem] text-left text-[0.857rem] font-bold tracking-[0.5px] text-[#22292f] uppercase dark:text-heading";
const td = "border-b border-border px-[1.5rem] py-[0.72rem]";

function Tabela({ colunas, children, vazio, rodape }: { colunas: string[]; children?: React.ReactNode; vazio?: boolean; rodape?: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[1rem]">
        <thead>
          <tr>
            {colunas.map((c, i) => (
              <th key={`${c}-${i}`} className={th}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vazio && (
            <tr>
              <td colSpan={colunas.length} className={cn(td, "text-center")}>
                Nenhum registro encontrado
              </td>
            </tr>
          )}
          {children}
        </tbody>
        {rodape}
      </table>
    </div>
  );
}

function Rodape({ children }: { children: React.ReactNode }) {
  return <div className="mt-[1rem] flex gap-[0.5rem]">{children}</div>;
}

function Voltar({ onFechar }: { onFechar: () => void }) {
  return (
    <Button variant="outline" type="button" onClick={onFechar}>
      Voltar
    </Button>
  );
}

const simNao = (v: boolean | null) => (v == null ? "Não informado" : v ? "Sim" : "Não");

// ---------------------------------------------------------------- Pagamentos Cliente

export function PagamentosCliente({
  obraId,
  planilhas,
  pagamentos,
  podeLancar,
  onFechar,
}: {
  obraId: number;
  planilhas: Planilha[];
  pagamentos: PagamentoCliente[];
  podeLancar: boolean;
  onFechar: () => void;
}) {
  const vazio = { id: "", data: hoje(), valor: "", planilha: "", previsao: "", efetivacao: "", realizado: "", descricao: "" };
  const [f, setF] = useState(vazio);
  const { pending, rodar } = useAcao();

  const editar = (p: PagamentoCliente) =>
    setF({
      id: String(p.id),
      data: p.data,
      valor: n2(Number(p.valor)),
      planilha: String(p.planilha_id),
      previsao: p.data_previsao ?? "",
      efetivacao: p.data_efetivacao ?? "",
      realizado: p.realizado == null ? "" : p.realizado ? "S" : "N",
      descricao: p.descricao,
    });

  const salvar = () => {
    const valor = numeroBr(f.valor);
    if (!f.planilha) return void toast.error("Selecione a planilha.");
    if (Number.isNaN(valor)) return void toast.error("Valor inválido.");
    rodar(
      () =>
        salvarPagamentoCliente(obraId, f.id ? Number(f.id) : null, {
          planilha_id: Number(f.planilha),
          data: f.data,
          valor,
          data_previsao: f.previsao || null,
          data_efetivacao: f.efetivacao || null,
          realizado: f.realizado === "" ? null : f.realizado === "S",
          descricao: f.descricao,
        }),
      "Pagamento salvo.",
      () => setF(vazio),
    );
  };

  return (
    <div className="max-h-[70vh] overflow-y-auto pr-1">
      {podeLancar && (
        <>
          <div className="grid gap-x-[1.5rem] md:grid-cols-4">
            <Campo rotulo="ID:" htmlFor="pg-id">
              <Input id="pg-id" value={f.id} readOnly disabled />
            </Campo>
            <Campo rotulo="Data:" htmlFor="pg-data">
              <Input id="pg-data" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
            </Campo>
            <Campo rotulo="Valor" htmlFor="pg-valor">
              <Input id="pg-valor" inputMode="decimal" placeholder="R$ 0,00" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
            </Campo>
            <Campo rotulo="Planilha" htmlFor="pg-pl">
              <select id="pg-pl" value={f.planilha} onChange={(e) => setF({ ...f, planilha: e.target.value })} className={selectClass}>
                <option value="">Selecione</option>
                {planilhas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Data Previsão Pagamento:" htmlFor="pg-prev">
              <Input id="pg-prev" type="date" value={f.previsao} onChange={(e) => setF({ ...f, previsao: e.target.value })} />
            </Campo>
            <Campo rotulo="Data Efetivação Pagamento:" htmlFor="pg-efet">
              <Input id="pg-efet" type="date" value={f.efetivacao} onChange={(e) => setF({ ...f, efetivacao: e.target.value })} />
            </Campo>
            <Campo rotulo="Pagamento Efetuado?" htmlFor="pg-real">
              <select id="pg-real" value={f.realizado} onChange={(e) => setF({ ...f, realizado: e.target.value })} className={selectClass}>
                <option value="">Selecione</option>
                <option value="S">Sim</option>
                <option value="N">Não</option>
              </select>
            </Campo>
            <Campo rotulo="Descrição:" htmlFor="pg-desc" className="md:col-span-4">
              <Textarea id="pg-desc" rows={2} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
            </Campo>
          </div>
          <Rodape>
            <Button onClick={salvar} disabled={pending}>
              Salvar
            </Button>
            <Button variant="outline" onClick={() => setF(vazio)}>
              Limpar Formulário
            </Button>
            <Voltar onFechar={onFechar} />
          </Rodape>
        </>
      )}
      {planilhas.map((p) => {
        const lista = pagamentos.filter((x) => x.planilha_id === p.id);
        return (
          <div key={p.id} className="mt-[1.5rem]">
            <h4 className="mb-[0.75rem] text-center text-[1.285rem] font-medium">{p.nome}</h4>
            <Tabela colunas={["Data", "Data Previsão Pagamento", "Data Efetivação Pagamento", "Pagamento Realizado?", "Valor", "Descrição", "Açoes"]} vazio={lista.length === 0}>
              {lista.map((x) => (
                <tr key={x.id}>
                  <td className={td}>{fmtData(x.data)}</td>
                  <td className={td}>{x.data_previsao ? fmtData(x.data_previsao) : "Não informado"}</td>
                  <td className={td}>{x.data_efetivacao ? fmtData(x.data_efetivacao) : "Não informado"}</td>
                  <td className={td}>{simNao(x.realizado)}</td>
                  <td className={td}>{n2(Number(x.valor))}</td>
                  <td className={td}>{x.descricao}</td>
                  <td className={cn(td, "whitespace-nowrap")}>
                    {podeLancar && (
                      <>
                        <button type="button" className="mr-3 text-primary" onClick={() => editar(x)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="text-[#ea5455]"
                          aria-label="Excluir"
                          onClick={() => confirm("Excluir este pagamento?") && rodar(() => excluirPagamentoCliente(obraId, x.id), "Pagamento excluído.")}
                        >
                          <Trash2 className="inline size-[14px]" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </Tabela>
          </div>
        );
      })}
      {!podeLancar && (
        <Rodape>
          <Voltar onFechar={onFechar} />
        </Rodape>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Responsáveis

const TIPOS_RESP = [
  { valor: "engenheiro", rotulo: "Engenheiro" },
  { valor: "coordenador", rotulo: "Cordenador" },
  { valor: "suprimentos", rotulo: "Suprimentos" },
];

export function Responsaveis({
  obraId,
  responsaveis,
  perfis,
  podeEditar,
  onFechar,
}: {
  obraId: number;
  responsaveis: Responsavel[];
  perfis: Opcao[];
  podeEditar: boolean;
  onFechar: () => void;
}) {
  const [perfil, setPerfil] = useState("");
  const [tipo, setTipo] = useState("");
  const [limite, setLimite] = useState("");
  const [qtd, setQtd] = useState("");
  const { pending, rodar } = useAcao();
  return (
    <div>
      {podeEditar && (
        <>
          <div className="grid gap-x-[1.5rem] md:grid-cols-4">
            <Campo rotulo="Usuario:" htmlFor="rs-u" className="md:col-span-2">
              <select id="rs-u" value={perfil} onChange={(e) => setPerfil(e.target.value)} className={selectClass}>
                <option value="">Selecione</option>
                {perfis.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Tipo" htmlFor="rs-t" className="md:col-span-2">
              <select id="rs-t" value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectClass}>
                <option value="">Selecione</option>
                {TIPOS_RESP.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Limite Aprovação OC" htmlFor="rs-l" className="md:col-span-2">
              <Input id="rs-l" inputMode="decimal" placeholder="R$ 0,00" value={limite} onChange={(e) => setLimite(e.target.value)} />
            </Campo>
            <Campo rotulo="Limite Aprovação OC" htmlFor="rs-q" className="md:col-span-2">
              <Input id="rs-q" type="number" min={0} value={qtd} onChange={(e) => setQtd(e.target.value)} />
            </Campo>
          </div>
          <Rodape>
            <Button
              disabled={pending}
              onClick={() => {
                if (!tipo) return void toast.error("Selecione o tipo.");
                rodar(
                  () =>
                    adicionarResponsavel(obraId, {
                      perfil_id: perfil,
                      tipo,
                      limite_aprovacao_oc: limite ? numeroBr(limite) : null,
                      qtd_aprovacao_oc: qtd ? Number(qtd) : null,
                    }),
                  "Responsável adicionado.",
                  () => {
                    setPerfil("");
                    setLimite("");
                    setQtd("");
                  },
                );
              }}
            >
              Adicionar
            </Button>
            <Voltar onFechar={onFechar} />
          </Rodape>
        </>
      )}
      <div className="mt-[1.5rem]">
        <Tabela colunas={["Perfil", "Nome", "E-mail", "Limite Aprov", "Quantidade Aprov", "Aprovações", "Açoes"]} vazio={responsaveis.length === 0}>
          {responsaveis.map((r) => (
            <tr key={r.id}>
              <td className={td}>{TIPOS_RESP.find((t) => t.valor === r.tipo)?.rotulo}</td>
              <td className={td}>{r.perfil?.nome}</td>
              <td className={td}>{r.perfil?.email}</td>
              <td className={td}>{n2(Number(r.limite_aprovacao_oc ?? 0))}</td>
              <td className={td}>{r.qtd_aprovacao_oc ?? 0}</td>
              <td className={td}>0</td>
              <td className={td}>
                {podeEditar && (
                  <button type="button" className="text-[#ea5455]" aria-label="Remover" onClick={() => rodar(() => removerResponsavel(obraId, r.id), "Responsável removido.")}>
                    <Trash2 className="inline size-[14px]" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Tabela>
      </div>
      {!podeEditar && (
        <Rodape>
          <Voltar onFechar={onFechar} />
        </Rodape>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Filiais

export function Filiais({
  obraId,
  filiais,
  clientes,
  podeEditar,
  onFechar,
}: {
  obraId: number;
  filiais: { id: number; nome: string }[];
  clientes: Opcao[];
  podeEditar: boolean;
  onFechar: () => void;
}) {
  const [cliente, setCliente] = useState("");
  const { pending, rodar } = useAcao();
  return (
    <div>
      {podeEditar && (
        <>
          <Campo rotulo="Cliente" htmlFor="fl-c">
            <select id="fl-c" value={cliente} onChange={(e) => setCliente(e.target.value)} className={selectClass}>
              <option value="">Selecione uma Cliente</option>
              {clientes.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Rodape>
            <Button disabled={pending} onClick={() => rodar(() => adicionarFilial(obraId, Number(cliente)), "Filial adicionada.", () => setCliente(""))}>
              Adicionar
            </Button>
            <Voltar onFechar={onFechar} />
          </Rodape>
        </>
      )}
      <div className="mt-[1.5rem]">
        <Tabela colunas={["Nome", "Ações"]} vazio={filiais.length === 0}>
          {filiais.map((f) => (
            <tr key={f.id}>
              <td className={td}>{f.nome}</td>
              <td className={td}>
                {podeEditar && (
                  <button type="button" className="text-[#ea5455]" aria-label="Remover" onClick={() => rodar(() => removerFilial(obraId, f.id), "Filial removida.")}>
                    <Trash2 className="inline size-[14px]" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Tabela>
      </div>
      {!podeEditar && (
        <Rodape>
          <Voltar onFechar={onFechar} />
        </Rodape>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Percentuais

const TIPOS_PCT = { adm: "Administração", imp: "Imposto", tot: "TOT" } as const;

export function Percentuais({
  obraId,
  planilhas,
  percentuais,
  podeEditar,
  onFechar,
}: {
  obraId: number;
  planilhas: Planilha[];
  percentuais: Percentual[];
  podeEditar: boolean;
  onFechar: () => void;
}) {
  const [planilha, setPlanilha] = useState("");
  const [tipo, setTipo] = useState("");
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState("");
  const { pending, rodar } = useAcao();
  const nomePl = (id: number) => planilhas.find((p) => p.id === id)?.nome ?? "";
  return (
    <div>
      {podeEditar && (
        <>
          <div className="grid gap-x-[1.5rem] md:grid-cols-2">
            <Campo rotulo="Planilha" htmlFor="pc-pl">
              <select id="pc-pl" value={planilha} onChange={(e) => setPlanilha(e.target.value)} className={selectClass}>
                <option value="">Selecione</option>
                {planilhas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Tipo" htmlFor="pc-t">
              <select id="pc-t" value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectClass}>
                <option value="">Selecione</option>
                <option value="adm">Administração</option>
                <option value="imp">Imposto</option>
                <option value="tot">Valor Total (TOT)</option>
              </select>
            </Campo>
            <Campo rotulo="Descrição:" htmlFor="pc-d">
              <Input id="pc-d" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </Campo>
            <Campo rotulo="Valor" htmlFor="pc-v">
              <Input id="pc-v" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            </Campo>
          </div>
          <Rodape>
            <Button
              disabled={pending}
              onClick={() => {
                if (!planilha || !tipo) return void toast.error("Selecione a planilha e o tipo.");
                rodar(() => adicionarPercentual(obraId, Number(planilha), tipo as "adm" | "imp" | "tot", desc, numeroBr(valor)), "Percentual salvo.", () => {
                  setDesc("");
                  setValor("");
                });
              }}
            >
              Salvar
            </Button>
            <Voltar onFechar={onFechar} />
          </Rodape>
        </>
      )}
      <div className="mt-[1.5rem]">
        <Tabela colunas={["Tipo", "Valor", "Planilha", "Descricao", ""]} vazio={percentuais.length === 0}>
          {percentuais.map((p) => (
            <tr key={p.id}>
              <td className={td}>{p.tipo === "tot" ? "TOT" : TIPOS_PCT[p.tipo]}</td>
              <td className={td}>{n2(Number(p.valor))}</td>
              <td className={td}>{nomePl(p.planilha_id)}</td>
              <td className={td}>{p.descricao}</td>
              <td className={td}>
                {podeEditar && (
                  <button type="button" className="text-[#ea5455]" aria-label="Excluir" onClick={() => rodar(() => excluirPercentual(obraId, p.id), "Excluído.")}>
                    <Trash2 className="inline size-[14px]" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Tabela>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Editar Planilha (planilha + dados da obra)

const TIPOS_OBRA = ["Apartamento", "Cobertura", "Casa Nova", "Casa Reforma", "Comercial / Corporativo", "Demolição", "Manutenção", "Novos Negócios"];
const REGIME_EDITAR: Record<string, string> = { administracao: "Administrativo", fechado: "Fechado", completo: "Completo" };

export function EditarPlanilha({ obra, planilha, onFechar }: { obra: ObraDados; planilha: Planilha; onFechar: () => void }) {
  const [nome, setNome] = useState("");
  const [o, setO] = useState({
    inicio: obra.inicio ?? "",
    termino: obra.termino ?? "",
    entrega_prevista: obra.entrega_prevista ?? "",
    ano: obra.ano != null ? String(obra.ano) : "",
    tipo_obra: obra.tipo_obra ?? "",
    metragem: obra.metragem != null ? String(obra.metragem) : "",
    status_complementar: obra.status_complementar ?? "",
    as_built_em: obra.as_built_em ?? "",
    diretor: obra.diretor ?? "",
    coordenador: obra.coordenador ?? "",
    engenheiro: obra.engenheiro ?? "",
    arquitetura: obra.arquitetura ?? "",
    gerenciadora: obra.gerenciadora ?? "",
    orcamentista: obra.orcamentista ?? "",
    suprimento: obra.suprimento ?? "",
  });
  const { pending, rodar } = useAcao();
  const campo = (k: keyof typeof o, rotulo: string, tipo = "text") => (
    <Campo rotulo={rotulo} htmlFor={`ep-${k}`}>
      <Input id={`ep-${k}`} type={tipo} value={o[k]} onChange={(e) => setO({ ...o, [k]: e.target.value })} />
    </Campo>
  );
  const nulo = (v: string) => (v.trim() ? v.trim() : null);

  return (
    <div className="max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid gap-x-[1.5rem] md:grid-cols-2">
        <Campo rotulo="Nome Atual:" htmlFor="ep-atual">
          <Input id="ep-atual" value={planilha.nome} disabled />
        </Campo>
        <Campo rotulo="Novo Nome:" htmlFor="ep-novo">
          <Input id="ep-novo" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        {campo("inicio", "Início da Obra:", "date")}
        {campo("termino", "Término da Obra:", "date")}
        {campo("entrega_prevista", "Entrega / Previsão da Obra:", "date")}
        {campo("ano", "Ano:", "number")}
        <Campo rotulo="Tipo de Obra:" htmlFor="ep-tipo">
          <select id="ep-tipo" value={o.tipo_obra} onChange={(e) => setO({ ...o, tipo_obra: e.target.value })} className={selectClass}>
            <option value="">Selecione o tipo de obra</option>
            {TIPOS_OBRA.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Campo>
        {campo("metragem", "Metragem:", "number")}
        <Campo rotulo="Regime:" htmlFor="ep-regime">
          <select id="ep-regime" value={obra.regime} disabled className={selectClass}>
            {Object.entries(REGIME_EDITAR).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </Campo>
        {campo("status_complementar", "Status Complementar da Obra:")}
        {campo("as_built_em", "As Built:", "date")}
        {campo("diretor", "Diretor:")}
        {campo("coordenador", "Coordenador:")}
        {campo("engenheiro", "Engenheiro:")}
        {campo("arquitetura", "Arquitetura:")}
        {campo("gerenciadora", "Gerenciadora:")}
        {campo("orcamentista", "Orçamentista:")}
        {campo("suprimento", "Suprimento:")}
      </div>
      <Rodape>
        <Button
          disabled={pending}
          onClick={() =>
            rodar(
              () =>
                editarPlanilhaObra(obra.id, planilha.id, nome, {
                  inicio: nulo(o.inicio),
                  termino: nulo(o.termino),
                  entrega_prevista: nulo(o.entrega_prevista),
                  ano: o.ano ? Number(o.ano) : null,
                  tipo_obra: nulo(o.tipo_obra),
                  metragem: o.metragem ? Number(o.metragem) : null,
                  status_complementar: nulo(o.status_complementar),
                  as_built_em: nulo(o.as_built_em),
                  diretor: nulo(o.diretor),
                  coordenador: nulo(o.coordenador),
                  engenheiro: nulo(o.engenheiro),
                  arquitetura: nulo(o.arquitetura),
                  gerenciadora: nulo(o.gerenciadora),
                  orcamentista: nulo(o.orcamentista),
                  suprimento: nulo(o.suprimento),
                }),
              "Atualizado.",
              onFechar,
            )
          }
        >
          Atualizar
        </Button>
        <Voltar onFechar={onFechar} />
      </Rodape>
    </div>
  );
}

// ---------------------------------------------------------------- Adicionar Centro de Custo

const NIVEIS_ADD: { valor: Nivel; rotulo: string }[] = [
  { valor: "T0", rotulo: "00 - Item Principal Com Imposto" },
  { valor: "T0-I", rotulo: "00 - Item Principal Sem Imposto" },
  { valor: "T1", rotulo: "00.00 - Sub Item" },
  { valor: "CC", rotulo: "00.00.00 - Centro de Custo" },
];

export function AdicionarCc({ obraId, planilhaId, pai, onFechar }: { obraId: number; planilhaId: number; pai: CentroCusto; onFechar: () => void }) {
  const [nivel, setNivel] = useState<Nivel | "">("");
  const [cc, setCc] = useState(`${pai.codigo}.`);
  const [desc, setDesc] = useState("");
  const { pending, rodar } = useAcao();
  return (
    <div>
      <Campo rotulo="Titulo Pai:" htmlFor="ac-pai">
        <Input id="ac-pai" value={`${pai.codigo} - ${pai.descricao}`} disabled />
      </Campo>
      <Campo rotulo="Nível" htmlFor="ac-nivel">
        <select id="ac-nivel" value={nivel} onChange={(e) => setNivel(e.target.value as Nivel)} className={selectClass}>
          <option value="">Selecione</option>
          {NIVEIS_ADD.map((n) => (
            <option key={n.valor} value={n.valor}>
              {n.rotulo}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="CC:" htmlFor="ac-cc">
        <Input id="ac-cc" value={cc} onChange={(e) => setCc(e.target.value)} />
      </Campo>
      <Campo rotulo="Descrição:" htmlFor="ac-desc">
        <Input id="ac-desc" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </Campo>
      <Rodape>
        <Button
          disabled={pending}
          onClick={() => {
            if (!nivel) return void toast.error("Selecione o nível.");
            if (!desc.trim()) return void toast.error("Informe a descrição.");
            rodar(() => salvarCc(obraId, planilhaId, null, { codigo: cc, descricao: desc, nivel, an_financeira: 0, orcamento: 0 }), "Centro de custo adicionado.", onFechar);
          }}
        >
          Atualizar
        </Button>
        <Voltar onFechar={onFechar} />
      </Rodape>
    </div>
  );
}

// ---------------------------------------------------------------- Detalhamento do CC

export function DetalheCc({ cc }: { cc: CentroCusto }) {
  return (
    <div>
      <div className="grid gap-x-[1.5rem] md:grid-cols-2">
        <Campo rotulo="CC:" htmlFor="dc-cc">
          <Input id="dc-cc" value={cc.codigo} readOnly />
        </Campo>
        <Campo rotulo="Descrição:" htmlFor="dc-desc">
          <Input id="dc-desc" value={cc.descricao} readOnly />
        </Campo>
      </div>
      {["Pedidos:", "Notas:", "Notas Alteradas CC:"].map((t) => (
        <div key={t} className="mt-[1rem]">
          <h6 className="mb-[0.5rem] text-[1rem] font-medium">{t}</h6>
          <Tabela colunas={["Documento", "Fornecedor", "Data", "Valor"]} vazio />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Caderno de Notas

const DOCUMENTOS = ["Todos os tipos", "Nota Fiscal", "Recibo", "Boleto", "Transferência", "Reembolso", "MPH (Controle Interno)"];

export function CadernoNotas({ onFechar }: { onFechar: () => void }) {
  const [marcados, setMarcados] = useState<string[]>([]);
  const alternar = (d: string) => {
    if (d === DOCUMENTOS[0]) return setMarcados(marcados.includes(d) ? [] : [d]);
    setMarcados((m) => (m.includes(d) ? m.filter((x) => x !== d) : [...m.filter((x) => x !== DOCUMENTOS[0]), d]));
  };
  return (
    <div>
      <p className="mb-[1rem]">Selecione um ou mais tipos de documentos</p>
      <div className="grid gap-2">
        {DOCUMENTOS.map((d) => (
          <label key={d} className="flex items-center gap-2">
            <input type="checkbox" checked={marcados.includes(d)} onChange={() => alternar(d)} className="size-[18px] accent-primary" />
            {d}
          </label>
        ))}
      </div>
      <Rodape>
        <Button
          disabled={!marcados.length}
          onClick={() => {
            toast.info("Aguarde... A geração do caderno de NFs ficará disponível quando as notas forem migradas para o novo modelo.");
            onFechar();
          }}
        >
          Gerar
        </Button>
        <Voltar onFechar={onFechar} />
      </Rodape>
    </div>
  );
}

// ---------------------------------------------------------------- Arquivos (Relatório de Obra / Contratos)

export function UploadArquivos({ rotulo, colunas, onFechar }: { rotulo?: string; colunas: string[]; onFechar: () => void }) {
  return (
    <div>
      {rotulo && <h6 className="mb-[0.5rem] text-[1rem] font-medium">{rotulo}</h6>}
      <div className="flex gap-2">
        <Input type="file" disabled title="Envio de arquivos da obra: próxima etapa" />
        <Button disabled title="Envio de arquivos da obra: próxima etapa">
          Adicionar
        </Button>
      </div>
      <div className="mt-[1.5rem]">
        <Tabela colunas={colunas} vazio />
      </div>
      <Rodape>
        <Voltar onFechar={onFechar} />
      </Rodape>
    </div>
  );
}

export function ModalVazio({ colunas, rodape }: { colunas: string[]; rodape?: string }) {
  return (
    <Tabela
      colunas={colunas}
      vazio
      rodape={
        rodape ? (
          <tfoot>
            <tr>
              <td colSpan={colunas.length} className={cn(td, "text-right font-semibold")}>
                {rodape}
              </td>
            </tr>
          </tfoot>
        ) : undefined
      }
    />
  );
}

// ---------------------------------------------------------------- Importar planilha de orçamento

export function ImportarPlanilha({ obraId, regime, onFechar }: { obraId: number; regime: string; onFechar: () => void }) {
  const [nome, setNome] = useState("");
  const [modo, setModo] = useState<ModoPlanilha>(regime === "administracao" ? "guia" : "verba");
  const [texto, setTexto] = useState("");
  const { pending, rodar } = useAcao();
  const { linhas, erros } = texto.trim() ? lerPlanilhaTexto(texto) : { linhas: [], erros: [] };

  async function lerArquivo(f: File) {
    const buf = await f.arrayBuffer();
    // CSV exportado pelo Excel costuma vir em Windows-1252; tenta UTF-8 primeiro.
    let t = new TextDecoder("utf-8").decode(buf);
    if (t.includes("�")) t = new TextDecoder("windows-1252").decode(buf);
    setTexto(t);
    if (!nome) setNome(f.name.replace(/\.[^.]+$/, ""));
  }

  return (
    <div>
      <div className="grid gap-x-[1.5rem] md:grid-cols-2">
        <Campo rotulo="Nome da planilha" htmlFor="pl-nome">
          <Input id="pl-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: FASE CINZA, EQUIPE TÉCNICA" />
        </Campo>
        <Campo rotulo="Modo" htmlFor="pl-modo">
          <select id="pl-modo" value={modo} onChange={(e) => setModo(e.target.value as ModoPlanilha)} className={selectClass}>
            {Object.entries(MODOS).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="mb-[0.3rem] flex items-center justify-between">
        <label htmlFor="pl-texto" className="text-[0.857rem] text-heading">
          Linhas (cole do Excel ou abra um CSV): Código | Descrição | An. Financeira | Orçamento | Nível
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1 text-primary">
          <FileUp className="size-4" /> Abrir CSV
          <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && lerArquivo(e.target.files[0])} />
        </label>
      </div>
      <Textarea id="pl-texto" rows={10} value={texto} onChange={(e) => setTexto(e.target.value)} className="font-mono text-[0.85rem]" />
      <p className="mt-1 text-[0.857rem] text-muted-foreground">Nível pelo código (00 = item, 00.01 = sub-item, 00.01.01 = centro de custo) ou pela 5ª coluna: {NIVEIS.join(", ")}.</p>
      {texto.trim() && (
        <div className="mt-2 rounded-[0.357rem] border p-3">
          <b>{linhas.length}</b> linhas válidas · {linhas.filter((l) => (l.nivel ?? nivelPorCodigo(l.codigo)) === "CC").length} centros de custo
          {erros.slice(0, 5).map((e) => (
            <div key={e} className="text-[#ff9f43]">
              {e}
            </div>
          ))}
        </div>
      )}
      <Rodape>
        <Button disabled={pending || !linhas.length} onClick={() => rodar(() => importarPlanilha(obraId, nome, modo, linhas), "Planilha importada.", onFechar)}>
          {pending ? "Importando…" : "Importar"}
        </Button>
        <Voltar onFechar={onFechar} />
      </Rodape>
    </div>
  );
}
