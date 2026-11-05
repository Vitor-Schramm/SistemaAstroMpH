"use server";

import { getPerfil } from "@/lib/auth";
import type { Empresa } from "./busca-externa";

// Consulta de CNPJ na BrasilAPI feita pelo servidor (não depende do navegador liberar o site).
// Só para usuários ativos; devolve null quando o CNPJ é incompleto ou não foi encontrado.
export async function buscarCnpj(valor: string): Promise<Empresa | null> {
  const perfil = await getPerfil();
  const cnpj = valor.replace(/\D/g, "");
  if (!perfil.ativo || cnpj.length !== 14) return null;
  try {
    // A BrasilAPI recusa (403) pedidos sem User-Agent identificado.
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { headers: { "User-Agent": "mph-sistema/1.0" }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const d = await r.json();
    const cep = String(d.cep ?? "").replace(/\D/g, "");
    return {
      razao_social: d.razao_social ?? "",
      nome_fantasia: d.nome_fantasia ?? "",
      cep: cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : "",
      endereco: [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" "),
      numero: d.numero ?? "",
      complemento: d.complemento ?? "",
      bairro: d.bairro ?? "",
      cidade: d.municipio ?? "",
      uf: d.uf ?? "",
      codigo_municipio: d.codigo_municipio_ibge ? String(d.codigo_municipio_ibge) : "",
      telefone: d.ddd_telefone_1 ?? "",
      email: d.email ?? "",
    };
  } catch {
    return null;
  }
}
