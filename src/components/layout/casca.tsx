"use client";

import Link from "next/link";
import { Home, Menu, Settings, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { MenuLateral } from "./menu-lateral";
import { ProvedorPreferencias, usePreferencias, type Largura, type Skin, type TipoNavbar, type TipoRodape } from "./preferencias";

// Casca de página igual ao AstroTools (Vuexy, layout vertical): menu lateral, barra superior
// flutuante, conteúdo, rodapé e o painel "Customização de tema".

const CORES_NAVBAR = ["", "#01a08a", "#82868b", "#28c76f", "#ea5455", "#00cfe8", "#ff9f43", "#4b4b4b"];

function Opcoes<T extends string>({ nome, valor, opcoes, onChange }: { nome: string; valor: T; opcoes: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {opcoes.map(([v, rotulo]) => (
        <label key={v} className="flex cursor-pointer items-center gap-2 text-[1rem]">
          <input type="radio" name={nome} checked={valor === v} onChange={() => onChange(v)} className="size-[18px] accent-primary" />
          {rotulo}
        </label>
      ))}
    </div>
  );
}

function Customizador() {
  const p = usePreferencias();
  const [aberto, setAberto] = useState(false);
  const secao = "border-b border-border px-[1.5rem] py-[1.5rem]";
  const titulo = "mb-[0.8rem] block text-[1rem] font-medium text-heading";
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className={cn(
          "fixed top-1/2 z-[60] flex size-[38px] -translate-y-1/2 items-center justify-center rounded-l-[6px] bg-primary text-white shadow transition-[right] duration-300",
          aberto ? "right-[400px]" : "right-0",
        )}
        aria-label="Customização de tema"
      >
        <Settings className="size-[15px] animate-[spin_3s_linear_infinite]" />
      </button>
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-[60] w-[400px] max-w-full overflow-y-auto bg-card shadow-[0_0_15px_0_rgba(34,41,47,0.05)] transition-transform duration-300",
          aberto ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!aberto}
      >
        <div className="flex items-start justify-between px-[1.5rem] py-[1.5rem]">
          <div>
            <h4 className="mb-0 text-[1.286rem] font-semibold uppercase">Customização de tema</h4>
            <small className="text-muted-foreground">Costumize o tema em tempo real</small>
          </div>
          <button type="button" onClick={() => setAberto(false)} aria-label="Fechar">
            <X className="size-[20px]" />
          </button>
        </div>
        <hr className="border-border" />
        <div className={secao}>
          <span className={titulo}>Skins</span>
          <Opcoes<Skin>
            nome="skin"
            valor={p.skin}
            onChange={(skin) => p.alterar({ skin })}
            opcoes={[
              ["claro", "Claro"],
              ["bordas", "Bordas"],
              ["dark", "Dark"],
              ["meio-dark", "Meio Dark"],
            ]}
          />
        </div>
        <div className={cn(secao, "flex items-center justify-between")}>
          <span className="text-[1rem] font-medium text-heading">Menu Colapsado</span>
          <button
            type="button"
            role="switch"
            aria-checked={p.menuColapsado}
            onClick={() => p.alterar({ menuColapsado: !p.menuColapsado })}
            className={cn("relative h-[1.7rem] w-[3rem] rounded-full transition-colors", p.menuColapsado ? "bg-primary" : "bg-[#e2e2e2]")}
          >
            <span className={cn("absolute top-[0.2rem] size-[1.3rem] rounded-full bg-white shadow transition-[left]", p.menuColapsado ? "left-[1.5rem]" : "left-[0.2rem]")} />
          </button>
        </div>
        <div className={secao}>
          <span className={titulo}>Largura do Layout</span>
          <Opcoes<Largura>
            nome="largura"
            valor={p.largura}
            onChange={(largura) => p.alterar({ largura })}
            opcoes={[
              ["cheia", "Tela Cheia"],
              ["box", "Box"],
            ]}
          />
        </div>
        <div className={secao}>
          <span className={titulo}>Cor da barra de navegação</span>
          <div className="flex gap-2">
            {CORES_NAVBAR.map((c) => (
              <button
                key={c || "branco"}
                type="button"
                onClick={() => p.alterar({ corNavbar: c })}
                className={cn("size-[24px] rounded-[6px] border border-border", p.corNavbar === c && "ring-2 ring-primary ring-offset-1")}
                style={{ background: c || "#fff" }}
                aria-label={c || "Branca"}
              />
            ))}
          </div>
          <span className={cn(titulo, "mt-[1.5rem]")}>Tipo da barra de navegação</span>
          <Opcoes<TipoNavbar>
            nome="navbar"
            valor={p.navbar}
            onChange={(navbar) => p.alterar({ navbar })}
            opcoes={[
              ["flutuante", "Flutuante"],
              ["descolado", "Descolado"],
              ["estatico", "Estático"],
              ["oculto", "Oculto"],
            ]}
          />
        </div>
        <div className={secao}>
          <span className={titulo}>Tipo do Rodapé</span>
          <Opcoes<TipoRodape>
            nome="rodape"
            valor={p.rodape}
            onChange={(rodape) => p.alterar({ rodape })}
            opcoes={[
              ["descolado", "Descolado"],
              ["estatico", "Estático"],
              ["oculto", "Oculto"],
            ]}
          />
        </div>
      </aside>
    </>
  );
}

function BarraSuperior({ usuario }: { usuario: React.ReactNode }) {
  const { navbar, corNavbar, setMenuAbertoMobile } = usePreferencias();
  if (navbar === "oculto") return null;
  const flutuante = navbar === "flutuante";
  const escura = corNavbar !== "";
  return (
    <>
      {flutuante && <div className="pointer-events-none sticky top-0 z-20 -mb-[102px] h-[102px] bg-[linear-gradient(180deg,rgba(217,217,217,0.95)_44%,rgba(217,217,217,0.46)_73%,rgba(217,217,217,0))] dark:bg-[linear-gradient(180deg,rgba(22,29,49,0.9)_44%,rgba(22,29,49,0.43)_73%,rgba(22,29,49,0))]" />}
      <header
        className={cn(
          "z-30 flex h-[62px] items-center justify-between px-[1rem]",
          navbar === "estatico" ? "relative" : "sticky",
          flutuante ? "top-[18.2px] mx-[28px] mt-[18.2px] rounded-[6px] shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]" : "top-0 shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]",
          escura ? "text-white" : "bg-card",
        )}
        style={escura ? { background: corNavbar } : undefined}
      >
        <div className="flex items-center">
          <button type="button" className="mr-2 p-[0.5rem] xl:hidden" onClick={() => setMenuAbertoMobile(true)} aria-label="Abrir menu">
            <Menu className="size-[1.5rem]" />
          </button>
          <Link href="/" className="hidden p-[0.5rem] lg:block" title="Home" aria-label="Home">
            <Home className="size-[1.5rem]" strokeWidth={1.75} />
          </Link>
        </div>
        {usuario}
      </header>
    </>
  );
}

// O ano só é lido no navegador: o Cache Components não aceita new Date() na pré-renderização.
const semAssinatura = () => () => {};
function useAno() {
  return useSyncExternalStore(semAssinatura, () => new Date().getFullYear(), () => null);
}

function Rodape() {
  const { rodape } = usePreferencias();
  const ano = useAno();
  if (rodape === "oculto") return null;
  return (
    <footer
      className={cn(
        "px-[28px] py-[0.8rem] text-[1rem] text-foreground",
        rodape === "descolado" && "sticky bottom-0 z-20 mx-[28px] mb-[1rem] rounded-[6px] bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]",
      )}
    >
      <p className="mb-0 clearfix">
        <span className="mt-[0.25rem] block md:inline-block">
          COPYRIGHT © {ano}
          <span className="ml-[0.25rem] text-primary">MpH Engenharia</span>
          <span className="hidden sm:inline-block">, Todos os direitos reservados</span>
        </span>
        <span className="float-right hidden md:block">Ferramenta de Gestão MpH ENGENHARIA</span>
      </p>
    </footer>
  );
}

function Conteudo({ usuario, children }: { usuario: React.ReactNode; children: React.ReactNode }) {
  const { menuColapsado, largura } = usePreferencias();
  return (
    <div className={cn("flex min-h-screen flex-col transition-[margin] duration-300", menuColapsado ? "xl:ml-[80px]" : "xl:ml-[260px]")}>
      <div className={cn("flex min-h-screen w-full flex-col", largura === "box" && "mx-auto max-w-[1440px]")}>
        <BarraSuperior usuario={usuario} />
        <main className="flex-1 px-[28px] pt-[28px] pb-[0.5rem]">{children}</main>
        <Rodape />
      </div>
    </div>
  );
}

export function Casca({ usuario, children }: { usuario: React.ReactNode; children: React.ReactNode }) {
  return (
    <ProvedorPreferencias>
      <MenuLateral />
      <Conteudo usuario={usuario}>{children}</Conteudo>
      <Customizador />
    </ProvedorPreferencias>
  );
}
