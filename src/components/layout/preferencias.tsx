"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";

// Opções do painel "Customização de tema", como no AstroTools. Ficam no navegador de cada usuário.

export type Skin = "claro" | "bordas" | "dark" | "meio-dark";
export type Largura = "cheia" | "box";
export type TipoNavbar = "flutuante" | "descolado" | "estatico" | "oculto";
export type TipoRodape = "descolado" | "estatico" | "oculto";

export type Preferencias = {
  skin: Skin;
  menuColapsado: boolean;
  largura: Largura;
  corNavbar: string;
  navbar: TipoNavbar;
  rodape: TipoRodape;
};

// O original abre com o menu escuro ("Meio Dark") e recolhido.
const PADRAO: Preferencias = { skin: "meio-dark", menuColapsado: true, largura: "cheia", corNavbar: "", navbar: "flutuante", rodape: "estatico" };
const CHAVE = "astro-preferencias";

type Ctx = Preferencias & {
  alterar: (p: Partial<Preferencias>) => void;
  menuAbertoMobile: boolean;
  setMenuAbertoMobile: (v: boolean) => void;
};

const Contexto = createContext<Ctx | null>(null);

function ler(): Preferencias {
  try {
    const v = localStorage.getItem(CHAVE);
    return v ? { ...PADRAO, ...JSON.parse(v) } : PADRAO;
  } catch {
    return PADRAO;
  }
}

const assinar = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener("astro-preferencias", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("astro-preferencias", cb);
  };
};
let cache: { bruto: string | null; valor: Preferencias } = { bruto: null, valor: PADRAO };
const instantaneo = () => {
  let bruto: string | null = null;
  try {
    bruto = localStorage.getItem(CHAVE);
  } catch {}
  if (bruto !== cache.bruto) cache = { bruto, valor: ler() };
  return cache.valor;
};

export function ProvedorPreferencias({ children }: { children: React.ReactNode }) {
  const prefs = useSyncExternalStore(assinar, instantaneo, () => PADRAO);
  const [menuAbertoMobile, setMenuAbertoMobile] = useState(false);

  const alterar = useCallback((p: Partial<Preferencias>) => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ ...instantaneo(), ...p }));
    } catch {}
    window.dispatchEvent(new Event("astro-preferencias"));
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", prefs.skin === "dark");
    html.classList.toggle("skin-bordas", prefs.skin === "bordas");
    html.classList.toggle("skin-claro", prefs.skin === "claro" || prefs.skin === "bordas");
  }, [prefs.skin]);

  return <Contexto.Provider value={{ ...prefs, alterar, menuAbertoMobile, setMenuAbertoMobile }}>{children}</Contexto.Provider>;
}

export function usePreferencias() {
  const c = useContext(Contexto);
  if (!c) throw new Error("usePreferencias fora do ProvedorPreferencias");
  return c;
}
