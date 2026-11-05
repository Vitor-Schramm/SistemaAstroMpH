"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit, KeyRound, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cartao, Campo, Selo } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { selectClass } from "@/components/cadastros/registro-form";
import { PERFIS } from "@/components/user-menu";
import type { Papel, Perfil } from "@/lib/auth";
import { criarUsuario, definirSenhaUsuario, salvarUsuario } from "./actions";

// Usuários (menu RH, só Admin): quem acessa o sistema e com qual setor.

type Edicao =
  | { modo: "novo"; email: string; nome: string; papel: Papel; senha: string }
  | { modo: "editar"; id: string; email: string; nome: string; celular: string; papel: Papel; ativo: boolean }
  | { modo: "senha"; id: string; nome: string; senha: string };

export function TelaUsuarios({ usuarios, meuId }: { usuarios: Perfil[]; meuId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>, ok: string) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.erro);
      toast.success(ok);
      setEdicao(null);
      router.refresh();
    });

  const colunas: ColunaTabela<Perfil>[] = [
    { chave: "nome", titulo: "Nome", valor: (u) => u.nome },
    { chave: "email", titulo: "E-mail", valor: (u) => u.email },
    { chave: "celular", titulo: "Celular", valor: (u) => u.celular ?? "" },
    { chave: "papel", titulo: "Perfil", valor: (u) => PERFIS[u.papel] ?? u.papel },
    { chave: "status", titulo: "Status", valor: (u) => (u.ativo ? "Ativo" : "Inativo"), render: (u) => <Selo tom={u.ativo ? "success" : "danger"}>{u.ativo ? "Ativo" : "Inativo"}</Selo> },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (u) => (
        <span className="flex items-center gap-[0.8rem] [&_svg]:size-[16px]">
          <button
            type="button"
            title="Editar"
            className="text-[#00cfe8]"
            onClick={() => setEdicao({ modo: "editar", id: u.id, email: u.email, nome: u.nome, celular: u.celular ?? "", papel: u.papel, ativo: u.ativo })}
          >
            <Edit />
          </button>
          <button type="button" title="Redefinir senha" className="text-[#ff9f43]" onClick={() => setEdicao({ modo: "senha", id: u.id, nome: u.nome, senha: "" })}>
            <KeyRound />
          </button>
          {u.id !== meuId && (
            <button
              type="button"
              title={u.ativo ? "Desativar" : "Ativar"}
              className={u.ativo ? "text-[#ea5455]" : "text-[#28c76f]"}
              disabled={pending}
              onClick={() =>
                confirm(u.ativo ? `Confirma a desativação de ${u.nome}?` : `Confirma a ativação de ${u.nome}?`) &&
                rodar(() => salvarUsuario(u.id, { nome: u.nome, celular: u.celular ?? "", papel: u.papel, ativo: !u.ativo }), u.ativo ? "Usuário desativado." : "Usuário ativado.")
              }
            >
              {u.ativo ? <ToggleRight /> : <ToggleLeft />}
            </button>
          )}
        </span>
      ),
    },
  ];

  const mudar = (p: Partial<Edicao>) => setEdicao((x) => x && ({ ...x, ...p } as Edicao));
  const seletorPerfil = (valor: Papel, desabilitado = false) => (
    <select id="u-papel" value={valor} disabled={desabilitado} onChange={(e) => mudar({ papel: e.target.value as Papel })} className={selectClass}>
      {Object.entries(PERFIS).map(([v, r]) => (
        <option key={v} value={v}>
          {r}
        </option>
      ))}
    </select>
  );

  return (
    <Cartao>
      <div className="flex items-center justify-between border-b border-border px-[1.5rem] py-[1.5rem]">
        <h4 className="mb-0 text-[1.285rem] font-medium">Usuários</h4>
        <Button onClick={() => setEdicao({ modo: "novo", email: "", nome: "", papel: "engenharia", senha: "" })}>Novo Usuário</Button>
      </div>
      <div className="pt-[0.5rem]">
        <TabelaDados colunas={colunas} linhas={usuarios} chave={(u) => u.id} nomeArquivo="usuarios" />
      </div>
      <Dialog open={edicao !== null} onOpenChange={(o) => !o && setEdicao(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[1.1rem] font-medium text-heading">
              {edicao?.modo === "novo" ? "Novo Usuário" : edicao?.modo === "senha" ? `Redefinir senha — ${edicao.nome}` : "Editar Usuário"}
            </DialogTitle>
          </DialogHeader>
          {edicao?.modo === "novo" && (
            <div>
              <Campo rotulo="Nome" htmlFor="u-nome">
                <Input id="u-nome" value={edicao.nome} onChange={(e) => mudar({ nome: e.target.value })} />
              </Campo>
              <Campo rotulo="E-mail" htmlFor="u-email">
                <Input id="u-email" type="email" value={edicao.email} onChange={(e) => mudar({ email: e.target.value })} />
              </Campo>
              <div className="grid gap-x-[1.5rem] md:grid-cols-2">
                <Campo rotulo="Perfil" htmlFor="u-papel">
                  {seletorPerfil(edicao.papel)}
                </Campo>
                <Campo rotulo="Senha inicial (mín. 8 caracteres)" htmlFor="u-senha">
                  <Input id="u-senha" type="text" autoComplete="off" value={edicao.senha} onChange={(e) => mudar({ senha: e.target.value })} />
                </Campo>
              </div>
              <p className="mb-[1rem] text-[0.857rem] text-muted-foreground">Passe a senha inicial para a pessoa; ela pode trocar em Minha Conta → Trocar Senha.</p>
              <div className="flex gap-[0.5rem]">
                <Button disabled={pending} onClick={() => rodar(() => criarUsuario(edicao), "Usuário criado.")}>
                  Enviar
                </Button>
                <Button variant="outline" onClick={() => setEdicao(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          {edicao?.modo === "editar" && (
            <div>
              <Campo rotulo="E-mail" htmlFor="u-email">
                <Input id="u-email" value={edicao.email} disabled />
              </Campo>
              <div className="grid gap-x-[1.5rem] md:grid-cols-2">
                <Campo rotulo="Nome" htmlFor="u-nome">
                  <Input id="u-nome" value={edicao.nome} onChange={(e) => mudar({ nome: e.target.value })} />
                </Campo>
                <Campo rotulo="Celular" htmlFor="u-cel">
                  <Input id="u-cel" value={edicao.celular} onChange={(e) => mudar({ celular: e.target.value })} />
                </Campo>
              </div>
              <Campo rotulo="Perfil" htmlFor="u-papel">
                {seletorPerfil(edicao.papel, edicao.id === meuId)}
              </Campo>
              <div className="flex gap-[0.5rem]">
                <Button disabled={pending} onClick={() => rodar(() => salvarUsuario(edicao.id, edicao), "Usuário salvo.")}>
                  Enviar
                </Button>
                <Button variant="outline" onClick={() => setEdicao(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          {edicao?.modo === "senha" && (
            <div>
              <Campo rotulo="Nova senha (mín. 8 caracteres)" htmlFor="u-senha">
                <Input id="u-senha" type="text" autoComplete="off" value={edicao.senha} onChange={(e) => mudar({ senha: e.target.value })} />
              </Campo>
              <div className="flex gap-[0.5rem]">
                <Button disabled={pending} onClick={() => rodar(() => definirSenhaUsuario(edicao.id, edicao.senha), "Senha redefinida.")}>
                  Enviar
                </Button>
                <Button variant="outline" onClick={() => setEdicao(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Cartao>
  );
}
