// Definições dos cadastros. Os mesmos objetos alimentam a tabela, o formulário (cliente)
// e a validação nas server actions, então precisam ser serializáveis (sem funções).

export type Mascara = "cpf_cnpj" | "cnpj" | "cep" | "telefone" | "moeda";

export type Campo = {
  nome: string;
  rotulo: string;
  tipo: "text" | "email" | "textarea" | "number" | "date" | "boolean" | "select";
  obrigatorio?: boolean;
  opcoes?: { valor: string; rotulo: string }[];
  /** Nome da chave em `opcoesRelacao` passada pela página (ex.: lista de clientes). */
  relacao?: string;
  mascara?: Mascara;
  largura?: 1 | 2 | 3; // colunas ocupadas na grade de 3 do formulário
  secao?: string;
};

export type Coluna = { campo: string; rotulo: string; formato?: "data" | "moeda" | "boolean" | "opcao" | "relacao" };

export type Entidade = {
  chave: string;
  tabela: string;
  titulo: string;
  singular: string;
  /** Substantivo feminino ("nova obra"). */
  feminino?: boolean;
  descricao: string;
  campos: Campo[];
  colunas: Coluna[];
  busca: string[];
  ordem: string;
  /** select do Supabase para a listagem */
  select?: string;
};

export const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
  .split(" ")
  .map((uf) => ({ valor: uf, rotulo: uf }));

export const REGIMES = [
  { valor: "administracao", rotulo: "Administração" },
  { valor: "empreitada", rotulo: "Empreitada" },
];

export const STATUS_OBRA = [
  { valor: "orcamento", rotulo: "Orçamento" },
  { valor: "em_andamento", rotulo: "Em andamento" },
  { valor: "paralisada", rotulo: "Paralisada" },
  { valor: "concluida", rotulo: "Concluída" },
];

export const ENTIDADES: Record<string, Entidade> = {
  clientes: {
    chave: "clientes",
    tabela: "clientes",
    titulo: "Clientes",
    singular: "Cliente",
    descricao: "Cadastro de clientes contratantes",
    ordem: "nome",
    busca: ["nome", "razao_social", "cnpj", "responsavel"],
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true, largura: 2, secao: "Dados" },
      { nome: "cnpj", rotulo: "CNPJ", tipo: "text", mascara: "cnpj" },
      { nome: "razao_social", rotulo: "Razão Social", tipo: "text", largura: 2 },
      { nome: "tipo", rotulo: "Tipo", tipo: "text" },
      { nome: "responsavel", rotulo: "Responsável", tipo: "text" },
      { nome: "telefone", rotulo: "Telefone", tipo: "text", mascara: "telefone" },
      { nome: "celular", rotulo: "Celular", tipo: "text", mascara: "telefone" },
      { nome: "endereco", rotulo: "Endereço", tipo: "text", largura: 2, secao: "Endereço" },
      { nome: "bairro", rotulo: "Bairro", tipo: "text" },
      { nome: "cep", rotulo: "CEP", tipo: "text", mascara: "cep" },
      { nome: "gerenciadora", rotulo: "Gerenciadora", tipo: "text", secao: "Contrato" },
      { nome: "arquitetura", rotulo: "Arquitetura", tipo: "text" },
      { nome: "inicio", rotulo: "Início", tipo: "date" },
      { nome: "fim", rotulo: "Fim", tipo: "date" },
      { nome: "valida_engenharia_nota", rotulo: "Valida Engenharia na Nota", tipo: "boolean" },
      { nome: "obriga_anexo_oc_nf", rotulo: "Obriga anexo no vínculo OC x NF", tipo: "boolean" },
    ],
    colunas: [
      { campo: "nome", rotulo: "Nome" },
      { campo: "cnpj", rotulo: "CNPJ" },
      { campo: "responsavel", rotulo: "Responsável" },
      { campo: "celular", rotulo: "Celular" },
      { campo: "gerenciadora", rotulo: "Gerenciadora" },
      { campo: "inicio", rotulo: "Início", formato: "data" },
      { campo: "fim", rotulo: "Fim", formato: "data" },
    ],
  },

  obras: {
    chave: "obras",
    tabela: "obras",
    titulo: "Obras",
    singular: "Obra",
    feminino: true,
    descricao: "Listagem e cadastro de obras",
    ordem: "codigo",
    select: "*, cliente:clientes(nome)",
    busca: ["codigo", "nome", "engenheiro"],
    campos: [
      { nome: "codigo", rotulo: "Código", tipo: "text", obrigatorio: true, secao: "Identificação" },
      { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true, largura: 2 },
      { nome: "cliente_id", rotulo: "Cliente", tipo: "select", relacao: "clientes", largura: 2 },
      { nome: "ano", rotulo: "Ano", tipo: "number" },
      { nome: "regime", rotulo: "Regime", tipo: "select", opcoes: REGIMES, obrigatorio: true },
      { nome: "status", rotulo: "Status", tipo: "select", opcoes: STATUS_OBRA, obrigatorio: true },
      { nome: "status_complementar", rotulo: "Status complementar", tipo: "text" },
      { nome: "tipo_obra", rotulo: "Tipo de obra", tipo: "text" },
      { nome: "metragem", rotulo: "Metragem (m²)", tipo: "number" },
      { nome: "valor_total", rotulo: "Valor total da obra", tipo: "number", mascara: "moeda" },
      { nome: "inicio", rotulo: "Início", tipo: "date", secao: "Prazos" },
      { nome: "termino", rotulo: "Término", tipo: "date" },
      { nome: "entrega_prevista", rotulo: "Entrega / previsão", tipo: "date" },
      { nome: "as_built", rotulo: "As Built entregue", tipo: "boolean" },
      { nome: "possui_seguro", rotulo: "Possui seguro", tipo: "boolean" },
      { nome: "engenheiro", rotulo: "Engenheiro", tipo: "text", secao: "Equipe" },
      { nome: "arquitetura", rotulo: "Arquitetura", tipo: "text" },
      { nome: "gerenciadora", rotulo: "Gerenciadora", tipo: "text" },
      { nome: "orcamentista", rotulo: "Orçamentista", tipo: "text" },
      { nome: "suprimento", rotulo: "Suprimento", tipo: "text" },
      { nome: "taxa_adm_analise_financeira", rotulo: "Taxa adm. (análise financeira) %", tipo: "number", secao: "Administração" },
      { nome: "taxa_adm_analise_orcamento", rotulo: "Taxa adm. (análise orçamento) %", tipo: "number" },
    ],
    colunas: [
      { campo: "codigo", rotulo: "Cód." },
      { campo: "nome", rotulo: "Nome" },
      { campo: "cliente_id", rotulo: "Cliente", formato: "relacao" },
      { campo: "regime", rotulo: "Regime", formato: "opcao" },
      { campo: "status", rotulo: "Status", formato: "opcao" },
      { campo: "possui_seguro", rotulo: "Seguro", formato: "boolean" },
      { campo: "engenheiro", rotulo: "Engenheiro" },
    ],
  },

  fornecedores: {
    chave: "fornecedores",
    tabela: "fornecedores",
    titulo: "Fornecedores",
    singular: "Fornecedor",
    descricao: "Cadastro de fornecedores e dados bancários",
    ordem: "nome",
    select: "*, bloqueios:fornecedor_bloqueios(id, desbloqueado_em)",
    busca: ["cpf_cnpj", "nome", "nome_fantasia", "classificacao", "cidade"],
    campos: [
      { nome: "cpf_cnpj", rotulo: "CPF/CNPJ", tipo: "text", obrigatorio: true, mascara: "cpf_cnpj", secao: "Dados" },
      { nome: "nome", rotulo: "Nome / Razão social", tipo: "text", obrigatorio: true, largura: 2 },
      { nome: "nome_fantasia", rotulo: "Nome fantasia", tipo: "text" },
      { nome: "nome_fantasia_mapa", rotulo: "Nome fantasia (mapa)", tipo: "text" },
      { nome: "classificacao", rotulo: "Classificação", tipo: "text" },
      { nome: "avaliacao", rotulo: "Avaliação (0 a 5)", tipo: "number" },
      { nome: "inscricao_estadual", rotulo: "Inscrição estadual", tipo: "text" },
      { nome: "inscricao_municipal", rotulo: "Inscrição municipal", tipo: "text" },
      { nome: "cep", rotulo: "CEP", tipo: "text", mascara: "cep", secao: "Endereço" },
      { nome: "endereco", rotulo: "Endereço", tipo: "text", largura: 2 },
      { nome: "numero", rotulo: "Número", tipo: "text" },
      { nome: "complemento", rotulo: "Complemento", tipo: "text" },
      { nome: "bairro", rotulo: "Bairro", tipo: "text" },
      { nome: "cidade", rotulo: "Cidade", tipo: "text", largura: 2 },
      { nome: "uf", rotulo: "UF", tipo: "select", opcoes: UFS },
      { nome: "contato1_nome", rotulo: "Contato 1", tipo: "text", secao: "Contatos" },
      { nome: "contato1_fone", rotulo: "Fone", tipo: "text", mascara: "telefone" },
      { nome: "contato1_email", rotulo: "E-mail", tipo: "email" },
      { nome: "contato2_nome", rotulo: "Contato 2", tipo: "text" },
      { nome: "contato2_fone", rotulo: "Fone", tipo: "text", mascara: "telefone" },
      { nome: "contato2_email", rotulo: "E-mail", tipo: "email" },
      { nome: "observacao", rotulo: "Observação", tipo: "textarea", largura: 3 },
      { nome: "banco_cnpj_favorecido", rotulo: "CPF/CNPJ do favorecido", tipo: "text", mascara: "cpf_cnpj", secao: "Dados bancários" },
      { nome: "banco_favorecido", rotulo: "Favorecido", tipo: "text", largura: 2 },
      { nome: "banco", rotulo: "Banco", tipo: "text" },
      { nome: "agencia", rotulo: "Agência", tipo: "text" },
      { nome: "conta", rotulo: "Conta", tipo: "text" },
    ],
    colunas: [
      { campo: "cpf_cnpj", rotulo: "CPF/CNPJ" },
      { campo: "nome", rotulo: "Nome" },
      { campo: "nome_fantasia", rotulo: "Fantasia" },
      { campo: "classificacao", rotulo: "Classificação" },
      { campo: "cidade", rotulo: "Cidade" },
      { campo: "uf", rotulo: "UF" },
    ],
  },

  itens: {
    chave: "itens",
    tabela: "itens",
    titulo: "Itens / Materiais",
    singular: "Item",
    descricao: "Catálogo usado em solicitações e mapas de cotação",
    ordem: "codigo",
    busca: ["codigo", "descricao"],
    campos: [
      { nome: "codigo", rotulo: "Código", tipo: "text", obrigatorio: true },
      { nome: "descricao", rotulo: "Descrição", tipo: "text", obrigatorio: true, largura: 2 },
      { nome: "unidade", rotulo: "Unidade", tipo: "text", obrigatorio: true },
      { nome: "valor_medio", rotulo: "Valor médio", tipo: "number", mascara: "moeda" },
    ],
    colunas: [
      { campo: "codigo", rotulo: "Código" },
      { campo: "descricao", rotulo: "Descrição" },
      { campo: "unidade", rotulo: "Unid." },
      { campo: "valor_medio", rotulo: "Vl. médio", formato: "moeda" },
    ],
  },
};
