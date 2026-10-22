"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cartao, Campo } from "@/components/astro/basicos";
import { aplicarMascara } from "@/lib/format";
import { salvarPerfil, trocarSenha, type ContaState } from "./actions";

function useAviso(state: ContaState, aoOk?: () => void) {
  useEffect(() => {
    if (state.ok) {
      toast.success(state.ok);
      aoOk?.();
    } else if (state.erro) toast.error(state.erro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

function CabecalhoCartao({ titulo }: { titulo: string }) {
  return (
    <div className="border-b border-[#ebe9f1] px-[1.5rem] py-[1.5rem] dark:border-[#3b4253]">
      <h4 className="mb-0 text-[1.285rem] font-medium text-heading">{titulo}</h4>
    </div>
  );
}

function Botoes({ pending }: { pending: boolean }) {
  return (
    <div className="mt-[0.5rem] flex gap-[1rem]">
      <Button type="submit" disabled={pending}>
        Salvar
      </Button>
      <Button type="reset" variant="outline">
        Cancelar
      </Button>
    </div>
  );
}

export function FormPerfil({ nome, celular }: { nome: string; celular: string }) {
  const [state, action, pending] = useActionState<ContaState, FormData>(salvarPerfil, {});
  const [cel, setCel] = useState(celular);
  useAviso(state);

  return (
    <Cartao>
      <CabecalhoCartao titulo="Detalhes do Perfil" />
      <form action={action} onReset={() => setCel(celular)} className="px-[1.5rem] pt-[2.5rem] pb-[1.5rem]">
        <div className="w-full md:w-1/2">
          <Campo rotulo="Nome" htmlFor="nome">
            <Input id="nome" name="nome" defaultValue={nome} required />
          </Campo>
          <Campo rotulo="Celular" htmlFor="celular">
            <Input
              id="celular"
              name="celular"
              inputMode="numeric"
              placeholder="Número de celular"
              value={cel}
              onChange={(e) => setCel(aplicarMascara(e.target.value, "telefone"))}
            />
          </Campo>
        </div>
        <Botoes pending={pending} />
      </form>
    </Cartao>
  );
}

function CampoSenha({ id, name, placeholder, autoComplete }: { id: string; name: string; placeholder: string; autoComplete: string }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="flex">
      <Input id={id} name={name} type={ver ? "text" : "password"} placeholder={placeholder} autoComplete={autoComplete} required className="rounded-r-none" />
      <button
        type="button"
        onClick={() => setVer(!ver)}
        aria-label={ver ? "Ocultar senha" : "Mostrar senha"}
        className="flex w-[38px] shrink-0 items-center justify-center rounded-r-[0.357rem] border border-l-0 border-input text-foreground [&_svg]:size-[14px]"
      >
        {ver ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

export function FormSenha() {
  const [state, action, pending] = useActionState<ContaState, FormData>(trocarSenha, {});
  const form = useRef<HTMLFormElement>(null);
  useAviso(state, () => form.current?.reset());

  return (
    <Cartao>
      <CabecalhoCartao titulo="Alteração de senha" />
      <form ref={form} action={action} className="p-[1.5rem]">
        <div className="grid gap-x-[1.5rem] md:grid-cols-2">
          <Campo rotulo="Senha atual" htmlFor="atual">
            <CampoSenha id="atual" name="atual" placeholder="Entre com sua senha atual" autoComplete="current-password" />
          </Campo>
          <div className="max-md:hidden" />
          <Campo rotulo="Nova Senha" htmlFor="nova">
            <CampoSenha id="nova" name="nova" placeholder="Digite a nova senha" autoComplete="new-password" />
          </Campo>
          <Campo rotulo="Confirme a nova senha" htmlFor="confirma">
            <CampoSenha id="confirma" name="confirma" placeholder="Confirme sua nova senha" autoComplete="new-password" />
          </Campo>
        </div>
        <p className="mb-[0.5rem] font-semibold text-heading">Recomendação de senha:</p>
        <ul className="mb-[1rem] pl-[1rem] leading-[1.8]" style={{ listStyleType: "disc" }}>
          <li>Mínimo de 8 caracteres entre letras e números</li>
          <li>Ao menos uma letra maiúscula</li>
          <li>Ao menos um número ou símbolo (caractere especial)</li>
        </ul>
        <Botoes pending={pending} />
      </form>
    </Cartao>
  );
}
