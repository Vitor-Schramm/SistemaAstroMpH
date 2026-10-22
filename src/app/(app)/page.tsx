import { connection } from "next/server";
import { PainelAnalitico } from "@/components/painel/analitico";
import { PainelSuprimentos } from "@/components/painel/suprimentos";
import { getPerfil } from "@/lib/auth";
import { carregarAnalitico } from "@/lib/painel-analitico";
import { carregarPainelSuprimentos } from "@/lib/painel-suprimentos";

// Dashboard "Analítico" do AstroTools: Suprimentos tem um painel próprio; os demais perfis veem as tabelas
// da Fase Cinza e da Fase Azul das suas obras.
export default async function InicioPage() {
  const perfil = await getPerfil();
  if (perfil.papel === "suprimentos") {
    await connection();
    const d = await carregarPainelSuprimentos(perfil.id, new Date());
    return <PainelSuprimentos {...d} />;
  }
  const d = await carregarAnalitico(perfil);
  return <PainelAnalitico {...d} />;
}
