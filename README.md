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
| Solicitações → Mapas de cotação → Ordens de Compra → Aprovação OC (Engenharia + Financeiro), impressão/PDF da OC | ✅ |
| Ordens de Reembolso | ⏳ |
| Notas fiscais vinculadas à OC (anexos), aprovação da engenharia, Fase Cinza (pagamento com verba da obra, pagamento forçado), Fase Azul (Guias Adm), verbas/aportes | ✅ |
| Consultas, Dashboards financeiros | ⏳ |

## Configuração

1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo).
2. **Banco:** abra *SQL Editor → New query* e rode, **um de cada vez e uma única vez**, os arquivos de `supabase/migrations/` em ordem (`0001_cadastros.sql`, `0002_compras.sql`, …).
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

Notas: `admin`, `suprimentos` e `financeiro` lançam; **engenharia** aprova toda NF; **financeiro** efetiva pagamentos, lança aportes e monta guias.

Compras: qualquer usuário ativo cria **solicitações**; **mapas** e **OCs** só `admin` e `suprimentos`. A OC é aprovada quando **engenharia** e **financeiro** aprovam (o `admin` pode decidir por qualquer um dos dois); uma reprovação devolve a OC para compras.

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
