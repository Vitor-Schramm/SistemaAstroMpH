// Menu lateral idêntico ao do AstroTools: mesmos rótulos, ordem, grupos, submenus e ícones (feather → lucide).

export type IconeMenu = "home" | "grid" | "circle" | "align-justify" | "file-text" | "database";

/** Visibilidade por perfil, como no original: `papeis` = só esses perfis; `exceto` = todos menos esses. */
type Perfis = { papeis?: string[]; exceto?: string[] };

export type ItemMenu = Perfis & {
  titulo: string;
  href?: string;
  icone: IconeMenu;
  badge?: string;
  /** Rotas que também marcam o item como ativo (telas de detalhe). */
  ativoEm?: string[];
  sub?: (Perfis & { titulo: string; href: string; ativoEm?: string[] })[];
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
  { titulo: "Obras", href: "/obras", icone: "grid", exceto: ["suprimentos"] },
  { titulo: "Solicitações", href: "/solicitacoes", icone: "circle" },
  { titulo: "Mapas", href: "/mapas", icone: "circle" },
  { titulo: "Ordem Compra", href: "/ordens-compra", icone: "circle" },
  { titulo: "Ordem Reembolso", href: "/ordens-reembolso", icone: "circle" },
  { titulo: "Aprovação OC", href: "/aprovacao-oc", icone: "circle" },
  {
    titulo: "Anexar OC x NF",
    icone: "align-justify",
    sub: [
      { titulo: "NF's Fase Cinza", href: "/vincular/cinza" },
      { titulo: "NF's Fase Azul", href: "/vincular/azul" },
    ],
  },
  {
    titulo: "Notas Fase Cinza",
    icone: "align-justify",
    sub: [
      { titulo: "Pendentes", href: "/notas-cinza" },
      { titulo: "Pagas", href: "/notas-cinza?situacao=pagas" },
      { titulo: "Aprovação NF", href: "/aprovacao-nf", exceto: ["suprimentos"] },
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
      { titulo: "Materiais", href: "/materiais", papeis: ["suprimentos", "admin"] },
      { titulo: "Fornecedores Bloqueados", href: "/fornecedores-bloqueados" },
    ],
  },
  { cabecalho: "RH" },
];

/** Item visível para o perfil. Enquanto o perfil não carregou, itens restritos ficam ocultos. */
export function visivelPara(item: Perfis, papel: string | null) {
  if (item.papeis) return papel !== null && item.papeis.includes(papel);
  if (item.exceto) return papel !== null && !item.exceto.includes(papel);
  return true;
}

export function menuDoPerfil(papel: string | null): EntradaMenu[] {
  return MENU.filter((e) => "cabecalho" in e || visivelPara(e, papel)).map((e) =>
    "cabecalho" in e || !e.sub ? e : { ...e, sub: e.sub.filter((s) => visivelPara(s, papel)) },
  );
}
