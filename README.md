# MPH Sistema

Recriação do sistema de obras, compras e pagamentos da MPH Engenharia.
Stack: **Next.js 16** (App Router, Cache Components), **Supabase** (Postgres, Auth, RLS), **shadcn/ui** (Base UI) e Tailwind 4.

Mapa do sistema original: [`../analise-sistema-mph.md`](../analise-sistema-mph.md).

## Status

| Módulo | Situação |
|---|---|
| Login, sessão, proxy de autenticação | ✅ |
| Layout com menu lateral (estrutura do sistema original) | ✅ |
| Minha conta (perfil + troca de senha) | ✅ |
| Cadastros: Clientes, Obras, Fornecedores, Fornecedores Bloqueados, Itens | ✅ |
| Solicitações, Mapas, Ordens de Compra/Reembolso, Aprovação OC | ⏳ próxima fase |
| Notas Fase Cinza/Azul, pagamentos, Guias Adm, Consultas, Dashboards | ⏳ |

## Configuração

1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo).
2. **Banco:** abra *SQL Editor → New query*, cole o conteúdo de `supabase/migrations/0001_cadastros.sql` e clique *Run*.
3. **Usuários:** em *Authentication → Users → Add user*, crie seu usuário com *Auto Confirm*. **O primeiro usuário criado vira admin.** Os próximos entram como `usuario` (só leitura); o papel é alterado na tabela `perfis`.
4. **Chaves:** copie `.env.example` para `.env.local` e preencha a URL e a chave *publishable/anon* (em *Project Settings → API*).
5. Rode:

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Perfis de acesso (RLS)

| Papel | Ler cadastros | Criar/editar/ativar | Excluir |
|---|---|---|---|
| `admin` | ✅ | ✅ | ✅ |
| `financeiro`, `suprimentos` | ✅ | ✅ | — |
| `engenharia`, `usuario` | ✅ | — | — |

As regras valem no banco (Row Level Security), não só na interface.

## Estrutura

```
src/
  proxy.ts                      # protege as rotas (antigo middleware)
  app/login/                    # tela e actions de login/logout
  app/(app)/                    # área logada: layout com sidebar + páginas
  components/cadastros/         # CRUD genérico (tabela, busca, modal, exportar CSV)
  lib/cadastros/config.ts       # definição dos campos de cada cadastro
  lib/supabase/                 # clientes Supabase (server/proxy)
supabase/migrations/            # SQL do banco
```

Para adicionar um cadastro simples, crie a tabela no SQL, descreva os campos em `lib/cadastros/config.ts` e crie uma página com `<CrudTable chave="..."/>`.
