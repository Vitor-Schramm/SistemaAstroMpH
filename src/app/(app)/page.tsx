import Link from "next/link";
import { BadgeCheck, ClipboardList, FileCheck2, FilePlus2, HandCoins, Receipt, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { connection } from "next/server";
import { PainelSuprimentos } from "@/components/painel/suprimentos";
import { getPerfil } from "@/lib/auth";
import { carregarPainelSuprimentos } from "@/lib/painel-suprimentos";
import { carregarPainel, carregarPendencias } from "@/lib/painel";
import { moeda } from "@/lib/format";
import { cn } from "@/lib/utils";

const pct = (v: number | null) => (v == null ? "—" : `${String(v).replace(".", ",")}%`);

export default async function InicioPage() {
  const perfil = await getPerfil();
  // Suprimentos tem um dashboard próprio no original.
  if (perfil.papel === "suprimentos") {
    await connection();
    const d = await carregarPainelSuprimentos(perfil.id, new Date());
    return <PainelSuprimentos {...d} />;
  }
  const [painelOuNulo, p] = await Promise.all([carregarPainel(), carregarPendencias()]);
  const painel = painelOuNulo ?? [];
  const papel = perfil.papel;
  const admin = papel === "admin";

  const cards = [
    { titulo: "Solicitações pendentes", n: p.solicitacoes, href: "/solicitacoes", icone: ClipboardList, meu: admin },
    { titulo: "OCs aguardando aprovação", n: p.ocsAprovacao, href: "/aprovacao-oc", icone: BadgeCheck, meu: admin || papel === "engenharia" || papel === "financeiro" },
    {
      titulo: "NFs e reembolsos p/ engenharia",
      n: p.nfsEngenharia + p.reembolsosEngenharia,
      extra: `${p.nfsEngenharia} NF · ${p.reembolsosEngenharia} reembolso`,
      href: "/aprovacao-nf",
      icone: FileCheck2,
      meu: admin || papel === "engenharia",
    },
    { titulo: "Pagamentos pendentes", n: p.pagar, extra: moeda(p.pagarValor), href: "/notas-cinza", icone: HandCoins, meu: admin || papel === "financeiro" },
    { titulo: "Fase Azul aguardando guia", n: p.azulGuia, extra: moeda(p.azulGuiaValor), href: "/notas-azul", icone: Receipt, meu: admin || papel === "financeiro" },
  ];

  const soma = (k: keyof (typeof painel)[number]) => painel.reduce((s, o) => s + Number(o[k] ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {perfil.nome.split(/[\s.]/)[0] || "bem-vindo"}</h1>
          <p className="text-sm text-muted-foreground">Pendências do fluxo e situação das obras ativas.</p>
        </div>
        <Link href="/notas/nova" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <FilePlus2 className="size-4" /> Anexar OC x NF
        </Link>
      </div>

      {painelOuNulo === null && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Os painéis por obra ficam disponíveis depois de rodar o SQL <code>0004_reembolsos_painel.sql</code> no Supabase.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.titulo} href={c.href}>
            <Card className={cn("h-full transition-colors hover:bg-muted/50", c.meu && c.n > 0 && "border-primary/50 bg-primary/5")}>
              <CardHeader>
                <CardDescription className="flex items-center gap-2">
                  <c.icone className="size-4" /> {c.titulo}
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums">{c.n}</CardTitle>
                {c.extra && <div className="text-xs text-muted-foreground">{c.extra}</div>}
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fase Cinza — MPH paga o fornecedor</CardTitle>
          <CardDescription>Verba alocada = aportes do cliente. Disponível = aportes − pagamentos efetivados.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obra</TableHead>
                  <TableHead className="text-right">Adm. análise fin.</TableHead>
                  <TableHead className="text-right">Adm. orçamento</TableHead>
                  <TableHead className="text-right">Valor total obra</TableHead>
                  <TableHead className="text-right">Verba alocada</TableHead>
                  <TableHead className="text-right">Verba disponível</TableHead>
                  <TableHead className="text-right">Pagamentos pendentes</TableHead>
                  <TableHead className="text-right">OCs bloqueadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {painel.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-16 text-center text-muted-foreground">
                      Nenhuma obra ativa.
                    </TableCell>
                  </TableRow>
                )}
                {painel.map((o) => (
                  <TableRow key={o.obra_id}>
                    <TableCell>
                      {o.codigo} — {o.nome}
                      {o.cliente_nome && <div className="text-xs text-muted-foreground">{o.cliente_nome}</div>}
                    </TableCell>
                    <TableCell className="text-right">{pct(o.taxa_adm_analise_financeira)}</TableCell>
                    <TableCell className="text-right">{pct(o.taxa_adm_analise_orcamento)}</TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(Number(o.valor_total ?? 0))}</TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(Number(o.aportes))}</TableCell>
                    <TableCell className={cn("text-right font-medium tabular-nums", Number(o.disponivel) < 0 && "text-destructive")}>
                      {moeda(Number(o.disponivel))}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", Number(o.pagamentos_pendentes) > Number(o.disponivel) && "text-amber-700")}>
                      {moeda(Number(o.pagamentos_pendentes))}
                    </TableCell>
                    <TableCell className="text-right">
                      {o.ocs_bloqueadas > 0 ? (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <TriangleAlert className="size-3.5" /> {o.ocs_bloqueadas}
                        </span>
                      ) : (
                        0
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {painel.length > 1 && (
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-medium">Total</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right tabular-nums">{moeda(soma("valor_total"))}</TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(soma("aportes"))}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{moeda(soma("disponivel"))}</TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(soma("pagamentos_pendentes"))}</TableCell>
                    <TableCell className="text-right">{soma("ocs_bloqueadas")}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fase Azul — cliente paga direto</CardTitle>
          <CardDescription>Notas acompanhadas pela MPH e enviadas ao cliente em Guias Adm.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obra</TableHead>
                  <TableHead className="text-right">Análise financeira</TableHead>
                  <TableHead className="text-right">Orçamento</TableHead>
                  <TableHead className="text-right">Valor fechado</TableHead>
                  <TableHead className="text-right">Pendente guia</TableHead>
                  <TableHead className="text-right">Guia adm enviada</TableHead>
                  <TableHead className="text-right">Pago pelo cliente</TableHead>
                  <TableHead className="text-right">Total adm prevista</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {painel.map((o) => (
                  <TableRow key={o.obra_id}>
                    <TableCell>
                      {o.codigo} — {o.nome}
                    </TableCell>
                    <TableCell className="text-right">{pct(o.taxa_adm_analise_financeira)}</TableCell>
                    <TableCell className="text-right">{pct(o.taxa_adm_analise_orcamento)}</TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(Number(o.valor_total ?? 0))}</TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(Number(o.azul_pendente_guia))}</TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(Number(o.azul_em_guia))}</TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(Number(o.azul_pago))}</TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(Number(o.adm_prevista))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {painel.length > 1 && (
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-medium">Total</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right tabular-nums">{moeda(soma("valor_total"))}</TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(soma("azul_pendente_guia"))}</TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(soma("azul_em_guia"))}</TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(soma("azul_pago"))}</TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(soma("adm_prevista"))}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
