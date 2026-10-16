import {
  BadgeCheck,
  Ban,
  Building2,
  ClipboardList,
  FileCheck2,
  FilePlus2,
  FileSearch,
  HandCoins,
  Handshake,
  LayoutDashboard,
  Map,
  Package,
  PiggyBank,
  Receipt,
  ReceiptText,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type ItemMenu = { titulo: string; href: string; icone: LucideIcon; emBreve?: boolean };
export type GrupoMenu = { titulo: string; itens: ItemMenu[] };

// Estrutura espelhada do sistema atual. Itens "emBreve" ainda não foram implementados.
export const MENU: GrupoMenu[] = [
  {
    titulo: "Dashboards",
    itens: [
      { titulo: "Início", href: "/", icone: LayoutDashboard },
      { titulo: "Financeiro", href: "/financeiro", icone: Wallet, emBreve: true },
    ],
  },
  {
    titulo: "Compras",
    itens: [
      { titulo: "Obras", href: "/obras", icone: Building2 },
      { titulo: "Solicitações", href: "/solicitacoes", icone: ClipboardList },
      { titulo: "Mapas", href: "/mapas", icone: Map },
      { titulo: "Ordem Compra", href: "/ordens-compra", icone: ShoppingCart },
      { titulo: "Ordem Reembolso", href: "/ordens-reembolso", icone: HandCoins, emBreve: true },
      { titulo: "Aprovação OC", href: "/aprovacao-oc", icone: BadgeCheck },
    ],
  },
  {
    titulo: "Notas e pagamentos",
    itens: [
      { titulo: "Anexar OC x NF", href: "/notas/nova", icone: FilePlus2 },
      { titulo: "Aprovação NF", href: "/aprovacao-nf", icone: FileCheck2 },
      { titulo: "Notas Fase Cinza", href: "/notas-cinza", icone: Receipt },
      { titulo: "Notas Fase Azul", href: "/notas-azul", icone: ReceiptText },
      { titulo: "Guias Adm", href: "/guias-adm", icone: Handshake },
      { titulo: "Verbas das obras", href: "/verbas", icone: PiggyBank },
      { titulo: "Consultas", href: "/consultas", icone: FileSearch, emBreve: true },
    ],
  },
  {
    titulo: "Cadastros Gerais",
    itens: [
      { titulo: "Clientes", href: "/clientes", icone: Users },
      { titulo: "Fornecedores", href: "/fornecedores", icone: Truck },
      { titulo: "Fornecedores Bloqueados", href: "/fornecedores-bloqueados", icone: Ban },
      { titulo: "Itens / Materiais", href: "/itens", icone: Package },
    ],
  },
];
