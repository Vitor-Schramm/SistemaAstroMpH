"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cartao, Campo } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { selectClass } from "@/components/cadastros/registro-form";
import { data as fmtData } from "@/lib/format";
import type { FiltroConsulta, LinhaFornecedor, LinhaItem, LinhaMapa, LinhaNota, LinhaPagamento, LinhaPedido, ResultadoConsulta } from "@/lib/consultas/dados";

// "Consultas" do AstroTools: um filtro (Obra, Fornecedor, Tipo Consulta, Cliente, Usuário, Classificação, datas,
// Modelo do Pedido, Data de Pagamento, Status e Materiais/Itens) e a tabela do tipo escolhido.

type Opcao = { valor: string; rotulo: string };
const real = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const soma = <T,>(ls: T[], f: (l: T) => number) => n2(ls.reduce((s, l) => s + f(l), 0));
const TIPOS = [
  { valor: "P", rotulo: "Pedidos" },
  { valor: "N", rotulo: "Pagamentos Efetuados" },
  { valor: "F", rotulo: "Fornecedores" },
  { valor: "MP", rotulo: "Mapas Pendentes" },
  { valor: "NF", rotulo: "Notas Fiscais" },
  { valor: "I", rotulo: "Itens" },
];

function Select({ id, name, valor, opcoes, vazio }: { id: string; name: string; valor: string; opcoes: Opcao[]; vazio: string }) {
  return (
    <select id={id} name={name} defaultValue={valor} className={selectClass}>
      <option value="">{vazio}</option>
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}

function Resultado({ r, modelo }: { r: ResultadoConsulta; modelo: "S" | "P" }) {
  switch (r.tipo) {
    case "P": {
      const completo = modelo === "P";
      const colunas: ColunaTabela<LinhaPedido>[] = [
        { chave: "oc", titulo: "OC", valor: (l) => l.oc },
        { chave: "nome", titulo: "Ordem Nome", valor: (l) => l.nome },
        { chave: "forn", titulo: "Fornecedor", valor: (l) => l.fornecedor },
        { chave: "obra", titulo: "Obra", valor: (l) => l.obra },
        { chave: "data", titulo: "Data", valor: (l) => l.data, render: (l) => fmtData(l.data) },
        { chave: "voc", titulo: "Val.OC", valor: (l) => l.valor_oc, render: (l) => real(l.valor_oc) },
        { chave: "vap", titulo: "Val.Aprop.", valor: (l) => l.valor_aprop, render: (l) => real(l.valor_aprop) },
        ...(completo
          ? ([
              { chave: "vnf", titulo: "Val.NF.", valor: (l) => l.valor_nf, render: (l) => real(l.valor_nf) },
              { chave: "vgu", titulo: "Val.Guia.", valor: (l) => l.valor_guia, render: (l) => real(l.valor_guia) },
              { chave: "apg", titulo: "Aprop - Pago.", valor: (l) => l.aprop_pago, render: (l) => real(l.aprop_pago) },
            ] as ColunaTabela<LinhaPedido>[])
          : []),
        { chave: "resp", titulo: "Responsavel", valor: (l) => l.responsavel },
        {
          chave: "acoes",
          titulo: "Ações",
          valor: () => "",
          exportar: false,
          ordenavel: false,
          render: (l) => (
            <a href={`/ordens-compra/${l.id}`} target="_blank" rel="noreferrer" title="Abrir" className="text-primary">
              <Search className="size-[14px]" />
            </a>
          ),
        },
      ];
      return (
        <TabelaDados
          colunas={colunas}
          linhas={r.linhas}
          chave={(l) => l.id}
          nomeArquivo="consulta-pedidos"
          totais={(ls) => ({
            voc: soma(ls, (l) => l.valor_oc),
            vap: soma(ls, (l) => l.valor_aprop),
            ...(completo ? { vnf: soma(ls, (l) => l.valor_nf), vgu: soma(ls, (l) => l.valor_guia), apg: soma(ls, (l) => l.aprop_pago) } : {}),
          })}
        />
      );
    }
    case "N": {
      const colunas: ColunaTabela<LinhaPagamento>[] = [
        { chave: "nota", titulo: "Nota", valor: (l) => l.nota },
        { chave: "serie", titulo: "Serie", valor: (l) => l.serie },
        { chave: "dpag", titulo: "Data Pagamento", valor: (l) => l.data_pagamento, render: (l) => fmtData(l.data_pagamento) },
        { chave: "usu", titulo: "Usuário", valor: (l) => l.usuario },
        { chave: "obra", titulo: "Obra", valor: (l) => l.obra },
        { chave: "ped", titulo: "Pedido", valor: (l) => l.pedido },
        { chave: "forn", titulo: "Fornecedor", valor: (l) => l.fornecedor },
        { chave: "valor", titulo: "Valor Pago", valor: (l) => l.valor, render: (l) => real(l.valor) },
      ];
      return <TabelaDados colunas={colunas} linhas={r.linhas} chave={(l) => l.id} nomeArquivo="consulta-pagamentos" totais={(ls) => ({ valor: soma(ls, (l) => l.valor) })} />;
    }
    case "F": {
      const colunas: ColunaTabela<LinhaFornecedor>[] = [
        { chave: "forn", titulo: "Fornecedor", valor: (l) => l.fornecedor },
        { chave: "cli", titulo: "Cliente", valor: (l) => l.cliente },
        { chave: "valor", titulo: "Valor Contratado", valor: (l) => l.valor, render: (l) => real(l.valor) },
        { chave: "qtd", titulo: "Qtd. Pedidos", valor: (l) => l.pedidos },
        { chave: "classe", titulo: "Classificação", valor: (l) => l.classificacao },
      ];
      return <TabelaDados colunas={colunas} linhas={r.linhas} chave={(l) => l.chave} nomeArquivo="consulta-fornecedores" />;
    }
    case "MP": {
      const colunas: ColunaTabela<LinhaMapa>[] = [
        { chave: "obra", titulo: "Obra", valor: (l) => l.obra },
        { chave: "sol", titulo: "Solicitante", valor: (l) => l.solicitante },
        { chave: "serv", titulo: "Serviço", valor: (l) => l.servico },
        { chave: "num", titulo: "Num Mapa", valor: (l) => l.numero },
        { chave: "orig", titulo: "Origem", valor: (l) => l.origem },
        { chave: "data", titulo: "Data", valor: (l) => l.data, render: (l) => fmtData(l.data) },
        { chave: "dias", titulo: "Qtd. Dias Pendente", valor: (l) => l.dias },
        { chave: "fin", titulo: "Finalizado Suprimentos", valor: (l) => (l.finalizado ? "Sim" : "Não") },
        { chave: "dfin", titulo: "Data Finalizado Suprimentos", valor: (l) => l.data_finalizado, render: (l) => fmtData(l.data_finalizado) },
      ];
      return <TabelaDados colunas={colunas} linhas={r.linhas} chave={(l) => l.id} nomeArquivo="consulta-mapas-pendentes" />;
    }
    case "NF": {
      const colunas: ColunaTabela<LinhaNota>[] = [
        { chave: "num", titulo: "Num NF", valor: (l) => l.numero },
        { chave: "guia", titulo: "Guia", valor: (l) => l.guia },
        { chave: "serie", titulo: "Nota / Serie / Controle / Parcela", valor: (l) => l.serie },
        { chave: "oc", titulo: "OC Cliente", valor: (l) => l.oc_cliente },
        { chave: "valor", titulo: "Valor", valor: (l) => l.valor, render: (l) => real(l.valor) },
        { chave: "venc", titulo: "Vencimento", valor: (l) => l.vencimento, render: (l) => fmtData(l.vencimento) },
        { chave: "pag", titulo: "Pagamento", valor: (l) => l.pagamento, render: (l) => fmtData(l.pagamento) },
        { chave: "tipo", titulo: "Tipo", valor: (l) => l.tipo },
        { chave: "sit", titulo: "Situação / Tipo Pagamento", valor: (l) => l.situacao },
        { chave: "forn", titulo: "Fornecedor", valor: (l) => l.fornecedor },
        { chave: "fase", titulo: "Fase", valor: (l) => l.fase },
        { chave: "obra", titulo: "Obra", valor: (l) => l.obra },
      ];
      return <TabelaDados colunas={colunas} linhas={r.linhas} chave={(l) => l.id} nomeArquivo="consulta-notas" />;
    }
    case "I": {
      const colunas: ColunaTabela<LinhaItem>[] = [
        { chave: "cod", titulo: "Cod. Item", valor: (l) => l.codigo },
        { chave: "item", titulo: "Item", valor: (l) => l.item },
        { chave: "forn", titulo: "Fornecedor", valor: (l) => l.fornecedor },
        { chave: "qtd", titulo: "Quantidade Total Comprada", valor: (l) => l.quantidade, render: (l) => n2(l.quantidade) },
        { chave: "un", titulo: "Unid. Medida", valor: (l) => l.unidade },
        { chave: "min", titulo: "Valor Unit. Mínimo", valor: (l) => l.minimo, render: (l) => real(l.minimo) },
        { chave: "max", titulo: "Valor Unit. Máximo", valor: (l) => l.maximo, render: (l) => real(l.maximo) },
        { chave: "med", titulo: "Valor Unit. Médio", valor: (l) => l.medio, render: (l) => real(l.medio) },
        { chave: "tot", titulo: "Valor Total Comprado", valor: (l) => l.total, render: (l) => real(l.total) },
        { chave: "obra", titulo: "Obra", valor: (l) => l.obra },
        { chave: "pri", titulo: "Primeira Compra", valor: (l) => l.primeira, render: (l) => fmtData(l.primeira) },
        { chave: "ult", titulo: "Última Compra", valor: (l) => l.ultima, render: (l) => fmtData(l.ultima) },
      ];
      return <TabelaDados colunas={colunas} linhas={r.linhas} chave={(l) => l.chave} nomeArquivo="consulta-itens" />;
    }
  }
}

export function TelaConsultas({
  filtro,
  opcoes,
  resultado,
}: {
  filtro: FiltroConsulta;
  opcoes: { obras: Opcao[]; fornecedores: Opcao[]; clientes: Opcao[]; usuarios: Opcao[]; itens: Opcao[] };
  resultado: ResultadoConsulta | null;
}) {
  const [tipo, setTipo] = useState(filtro.tipo);
  return (
    <Cartao>
      <div className="border-b border-border px-[1.5rem] py-[1.5rem]">
        <h4 className="mb-0 text-[1.285rem] font-medium">Filtro</h4>
      </div>
      <form method="get" action="/consultas" className="px-[1.5rem] pt-[1.5rem]">
        <input type="hidden" name="consultar" value="1" />
        <div className="grid gap-x-[1.5rem] md:grid-cols-[5fr_5fr_2fr]">
          <Campo rotulo="Obra" htmlFor="c-obra">
            <Select id="c-obra" name="obra" valor={filtro.obra} opcoes={opcoes.obras} vazio="Selecione uma Obra" />
          </Campo>
          <Campo rotulo="Fornecedor" htmlFor="c-forn">
            <Select id="c-forn" name="fornecedor" valor={filtro.fornecedor} opcoes={opcoes.fornecedores} vazio="Selecione um Fornecedor" />
          </Campo>
          <Campo rotulo="Tipo Consulta" htmlFor="c-tipo">
            <select id="c-tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as FiltroConsulta["tipo"])} className={selectClass}>
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <div className="grid gap-x-[1.5rem] md:grid-cols-[5fr_5fr_2fr]">
          <Campo rotulo="Cliente" htmlFor="c-cli">
            <Select id="c-cli" name="cliente" valor={filtro.cliente} opcoes={opcoes.clientes} vazio="Selecione um Cliente" />
          </Campo>
          <Campo rotulo="Usuário" htmlFor="c-usu">
            <Select id="c-usu" name="usuario" valor={filtro.usuario} opcoes={opcoes.usuarios} vazio="Selecione um Usuário" />
          </Campo>
          <Campo rotulo="Classificação" htmlFor="c-classe">
            <Input id="c-classe" name="classificacao" defaultValue={filtro.classificacao} />
          </Campo>
        </div>
        <div className="grid gap-x-[1.5rem] md:grid-cols-[3fr_3fr_2fr]">
          <Campo rotulo="Data Inicial" htmlFor="c-ini">
            <Input id="c-ini" name="inicio" type="date" defaultValue={filtro.inicio} />
          </Campo>
          <Campo rotulo="Data Final" htmlFor="c-fim">
            <Input id="c-fim" name="fim" type="date" defaultValue={filtro.fim} />
          </Campo>
          {tipo === "P" && (
            <Campo rotulo="Modelo Consulta Pedido" htmlFor="c-modelo">
              <select id="c-modelo" name="modelo" defaultValue={filtro.modelo} className={selectClass}>
                <option value="S">Simples</option>
                <option value="P">Apropriado x Pago</option>
              </select>
            </Campo>
          )}
        </div>
        {tipo === "NF" && (
          <div className="grid gap-x-[1.5rem] md:grid-cols-[3fr_3fr_2fr]">
            <Campo rotulo="Data Pagamento Inicial" htmlFor="c-pini">
              <Input id="c-pini" name="pgto_inicio" type="date" defaultValue={filtro.pgtoInicio} />
            </Campo>
            <Campo rotulo="Data Pagamento Final" htmlFor="c-pfim">
              <Input id="c-pfim" name="pgto_fim" type="date" defaultValue={filtro.pgtoFim} />
            </Campo>
            <Campo rotulo="Status" htmlFor="c-sit">
              <select id="c-sit" name="situacao" defaultValue={filtro.situacao} className={selectClass}>
                <option value="T">Todos</option>
                <option value="A">Pendente</option>
                <option value="F">Pago</option>
              </select>
            </Campo>
          </div>
        )}
        {tipo === "I" && (
          <Campo rotulo="Materias / Itens (Selecione um ou mais itens)" htmlFor="c-itens">
            <select id="c-itens" name="itens" multiple defaultValue={filtro.itens} className="h-[10rem] w-full rounded-[0.357rem] border border-input bg-card px-[0.5rem] py-[0.4rem] text-[1rem]">
              {opcoes.itens.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <div className="flex justify-end border-t border-border py-[1rem]">
          <Button type="submit">Filtrar</Button>
        </div>
      </form>
      {resultado && (
        <div className="pb-[0.5rem]">
          <Resultado r={resultado} modelo={filtro.modelo} />
        </div>
      )}
    </Cartao>
  );
}
