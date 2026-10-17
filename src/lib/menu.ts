// Menu lateral idêntico ao do AstroTools: mesmos rótulos, ordem, grupos, submenus e ícones (feather → lucide).

export type IconeMenu = "home" | "grid" | "circle" | "align-justify" | "file-text" | "database";

export type ItemMenu = {
  titulo: string;
  href?: string;
  icone: IconeMenu;
  badge?: string;
  /** Rotas que também marcam o item como ativo (telas de detalhe). */
  ativoEm?: string[];
  sub?: { titulo: string; href: string; ativoEm?: string[] }[];
};

export type EntradaMenu = ItemMenu | { cabecalho: string };

export const MENU: EntradaMenu[] = [
  {
    titulo: "Dashboards",
    icone: "home",
    badge: "1",
    sub: [
      { titulo: "Analítico", href: "/" },
      { titulo: "Financeiro", href: "/financeiro" },
    ],
  },
  { cabecalho: "Administrativo" },
  { titulo: "Obras", href: "/obras", icone: "grid" },
  { titulo: "Solicitações", href: "/solicitacoes", icone: "circle" },
  { titulo: "Mapas", href: "/mapas", icone: "circle" },
  { titulo: "Ordem Compra", href: "/ordens-compra", icone: "circle" },
  { titulo: "Ordem Reembolso", href: "/ordens-reembolso", icone: "circle" },
  { titulo: "Aprovação OC", href: "/aprovacao-oc", icone: "circle" },
  {
    titulo: "Anexar OC x NF",
    icone: "align-justify",
    sub: [
      { titulo: "NF's Fase Cinza", href: "/notas/nova?fase=cinza", ativoEm: ["/notas/nova"] },
      { titulo: "NF's Fase Azul", href: "/notas/nova?fase=azul" },
    ],
  },
  {
    titulo: "Notas Fase Cinza",
    icone: "align-justify",
    sub: [
      { titulo: "Pendentes", href: "/notas-cinza" },
      { titulo: "Pagas", href: "/notas-cinza?situacao=pagas" },
      { titulo: "Aprovação NF", href: "/aprovacao-nf" },
    ],
  },
  {
    titulo: "Notas Fase Azul",
    icone: "align-justify",
    sub: [
      { titulo: "Pendentes", href: "/notas-azul" },
      { titulo: "Pagas", href: "/notas-azul?situacao=pagas" },
    ],
  },
  { titulo: "Guias Adm", href: "/guias-adm", icone: "align-justify" },
  { titulo: "Consultas", href: "/consultas", icone: "file-text" },
  { cabecalho: "Cadastros" },
  {
    titulo: "Cadastro Gerais",
    icone: "database",
    sub: [
      { titulo: "Clientes", href: "/clientes" },
      { titulo: "Fornecedores", href: "/fornecedores" },
      { titulo: "Fornecedores Bloqueados", href: "/fornecedores-bloqueados" },
    ],
  },
  { cabecalho: "RH" },
];
