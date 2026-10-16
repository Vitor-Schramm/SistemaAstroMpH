import type { Mascara } from "@/lib/cadastros/config";

const so = (v: string) => v.replace(/\D/g, "");

export function aplicarMascara(valor: string, mascara?: Mascara): string {
  if (!mascara || mascara === "moeda") return valor;
  const d = so(valor);
  switch (mascara) {
    case "cep":
      return d.slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
    case "telefone":
      return d.length <= 10
        ? d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2")
        : d.slice(0, 11).replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
    case "cnpj":
      return formatarCnpj(d);
    case "cpf_cnpj":
      return d.length <= 11
        ? d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2")
        : formatarCnpj(d);
  }
}

function formatarCnpj(d: string) {
  return d
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function validarCpfCnpj(valor: string): boolean {
  const d = so(valor);
  if (d.length === 11) return validarCpf(d);
  if (d.length === 14) return validarCnpj(d);
  return false;
}

function validarCpf(d: string) {
  if (/^(\d)\1+$/.test(d)) return false;
  const dig = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10]);
}

function validarCnpj(d: string) {
  if (/^(\d)\1+$/.test(d)) return false;
  const dig = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dig(12) === Number(d[12]) && dig(13) === Number(d[13]);
}

export const moeda = (v: number | null | undefined) =>
  v == null ? "" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const data = (v: string | null | undefined) => {
  if (!v) return "";
  // Timestamp completo: converte para o fuso de São Paulo antes de pegar a data.
  if (v.length > 10) return new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const [a, m, d] = v.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

export const dataHora = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "";
