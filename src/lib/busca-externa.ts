// Consultas públicas usadas nos cadastros: CEP no ViaCEP (pelo navegador) e CNPJ na BrasilAPI (pelo servidor).
// Devolvem null quando o número é incompleto ou não foi encontrado; quem chama decide o que preencher.

const digitos = (s: string) => s.replace(/\D/g, "");

export type Endereco = { cep: string; endereco: string; bairro: string; cidade: string; uf: string; codigo_municipio: string };

export async function buscarCep(valor: string): Promise<Endereco | null> {
  const cep = digitos(valor);
  if (cep.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!r.ok) return null;
    const d = await r.json();
    if (d.erro) return null;
    return { cep: d.cep ?? valor, endereco: d.logradouro ?? "", bairro: d.bairro ?? "", cidade: d.localidade ?? "", uf: d.uf ?? "", codigo_municipio: d.ibge ?? "" };
  } catch {
    return null;
  }
}

export type Empresa = Endereco & { razao_social: string; nome_fantasia: string; numero: string; complemento: string; telefone: string; email: string };

// O CNPJ é consultado pelo servidor: ver buscarCnpj em ./busca-cnpj.
export { buscarCnpj } from "./busca-cnpj";

/** Junta os valores encontrados aos dados do formulário. Com `soVazios`, não troca o que a pessoa já digitou. */
export function preencher<T extends Record<string, string>>(dados: T, novos: Partial<Record<keyof T, string>>, soVazios = false): T {
  const r = { ...dados };
  for (const [k, v] of Object.entries(novos) as [keyof T, string | undefined][]) {
    if (v && (!soVazios || !String(r[k] ?? "").trim())) r[k] = v as T[keyof T];
  }
  return r;
}
