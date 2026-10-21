import { createClient } from "@/lib/supabase/server";

// Dashboard de Suprimentos do AstroTools: OCs das últimas 8 semanas (departamento × meu usuário),
// OCs da semana, mapas pendentes e a tabela por obra (solicitações e mapas, totais e pendentes).

export type SemanaOc = { rotulo: string; total: number; meu: number };
export type LinhaObra = { obra_id: number; obra: string; cliente_id: number | null; solicitacoes: number; solicitacoesPendentes: number; mapas: number; mapasPendentes: number };

const SEMANAS = 8;
const DIA = 86400000;
const ddmm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** Segunda-feira (00:00 UTC) da semana de `d`. */
function segunda(d: Date) {
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return new Date(s.getTime() - ((s.getUTCDay() + 6) % 7) * DIA);
}

export async function carregarPainelSuprimentos(usuarioId: string, hoje: Date) {
  const supabase = await createClient();
  const inicio = new Date(segunda(hoje).getTime() - (SEMANAS - 1) * 7 * DIA);
  const [{ data: ocs }, { data: mapas }, { data: sols }, { data: obras }] = await Promise.all([
    supabase.from("ordens_compra").select("criado_em, criado_por").neq("status", "cancelada").gte("criado_em", inicio.toISOString()).limit(20000),
    supabase.from("mapas").select("obra_id, status, criado_por").limit(50000),
    supabase.from("solicitacoes").select("obra_id, status").limit(50000),
    supabase.from("obras").select("id, nome, cliente_id").eq("ativo", true),
  ]);

  const semanas: SemanaOc[] = Array.from({ length: SEMANAS }, (_, i) => {
    const ini = new Date(inicio.getTime() + i * 7 * DIA);
    return { rotulo: `${ddmm(ini)} - ${ddmm(new Date(ini.getTime() + 6 * DIA))}`, total: 0, meu: 0 };
  });
  for (const o of ocs ?? []) {
    const i = Math.floor((new Date(o.criado_em).getTime() - inicio.getTime()) / (7 * DIA));
    if (i < 0 || i >= SEMANAS) continue;
    semanas[i].total++;
    if (o.criado_por === usuarioId) semanas[i].meu++;
  }

  const pendente = (s: string) => s !== "finalizado" && s !== "cancelado";
  const porObra = new Map<number, LinhaObra>();
  for (const o of obras ?? []) porObra.set(o.id, { obra_id: o.id, obra: o.nome, cliente_id: o.cliente_id, solicitacoes: 0, solicitacoesPendentes: 0, mapas: 0, mapasPendentes: 0 });
  for (const s of sols ?? []) {
    const l = porObra.get(s.obra_id);
    if (!l || s.status === "cancelada") continue;
    l.solicitacoes++;
    if (s.status === "pendente") l.solicitacoesPendentes++;
  }
  let mapasPendentes = 0;
  let mapasPendentesMeus = 0;
  for (const m of mapas ?? []) {
    if (m.status === "cancelado") continue;
    if (pendente(m.status)) {
      mapasPendentes++;
      if (m.criado_por === usuarioId) mapasPendentesMeus++;
    }
    const l = porObra.get(m.obra_id);
    if (!l) continue;
    l.mapas++;
    if (pendente(m.status)) l.mapasPendentes++;
  }

  const atual = semanas[SEMANAS - 1];
  return {
    semanas,
    ocsSemanaMeu: atual.meu,
    ocsSemanaGeral: atual.total,
    mapasPendentes,
    mapasPendentesMeus,
    obras: [...porObra.values()].filter((l) => l.solicitacoes + l.mapas > 0),
  };
}
