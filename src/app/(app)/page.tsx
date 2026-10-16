import Link from "next/link";
import { Ban, Building2, Package, Truck, Users } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";

async function contar(tabela: string, coluna: string, valor: boolean | null) {
  const supabase = await createClient();
  const q = supabase.from(tabela).select("id", { count: "exact", head: true });
  const { count } = await (valor === null ? q.is(coluna, null) : q.eq(coluna, valor));
  return count ?? 0;
}

export default async function InicioPage() {
  const perfil = await getPerfil();
  const [obras, clientes, fornecedores, bloqueados, itens] = await Promise.all([
    contar("obras", "ativo", true),
    contar("clientes", "ativo", true),
    contar("fornecedores", "ativo", true),
    contar("fornecedor_bloqueios", "desbloqueado_em", null),
    contar("itens", "ativo", true),
  ]);

  const cards = [
    { titulo: "Obras ativas", valor: obras, href: "/obras", icone: Building2 },
    { titulo: "Clientes ativos", valor: clientes, href: "/clientes", icone: Users },
    { titulo: "Fornecedores ativos", valor: fornecedores, href: "/fornecedores", icone: Truck },
    { titulo: "Fornecedores bloqueados", valor: bloqueados, href: "/fornecedores-bloqueados", icone: Ban },
    { titulo: "Itens no catálogo", valor: itens, href: "/itens", icone: Package },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {perfil.nome.split(" ")[0] || "bem-vindo"}</h1>
        <p className="text-sm text-muted-foreground">Visão geral dos cadastros. Os painéis Fase Cinza/Azul chegam na próxima etapa.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardDescription className="flex items-center gap-2">
                  <c.icone className="size-4" /> {c.titulo}
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums">{c.valor}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
