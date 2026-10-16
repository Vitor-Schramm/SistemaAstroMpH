/**
 * As mensagens das funções do banco formatam valores com o locale do Postgres (en-US):
 * "R$ 6,250.00". Converte para o padrão brasileiro: "R$ 6.250,00".
 */
export function traduzirErro(msg: string): string {
  return msg.replace(/\b(\d{1,3}(?:,\d{3})*)\.(\d{2})\b/g, (_, inteiro: string, centavos: string) => `${inteiro.replace(/,/g, ".")},${centavos}`);
}
