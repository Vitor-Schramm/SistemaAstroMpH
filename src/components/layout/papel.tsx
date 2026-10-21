"use client";

import { createContext, useContext, useEffect, useState } from "react";

// Perfil do usuário para a casca (menu por perfil). A casca é estática; o perfil chega depois,
// pelo bloco do usuário na barra superior (dentro de <Suspense>), via <RegistrarPapel>.

const Contexto = createContext<{ papel: string | null; setPapel: (p: string) => void }>({ papel: null, setPapel: () => {} });

export function ProvedorPapel({ children }: { children: React.ReactNode }) {
  const [papel, setPapel] = useState<string | null>(null);
  return <Contexto.Provider value={{ papel, setPapel }}>{children}</Contexto.Provider>;
}

export const usePapel = () => useContext(Contexto).papel;

export function RegistrarPapel({ papel }: { papel: string }) {
  const { setPapel } = useContext(Contexto);
  useEffect(() => setPapel(papel), [papel, setPapel]);
  return null;
}
