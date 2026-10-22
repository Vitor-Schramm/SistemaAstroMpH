"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { entrar, type LoginState } from "./actions";

// Formulário da página de acesso da MpH (e-mail, senha com "mostrar/ocultar" e Entrar).

const campo =
  "h-[46px] w-full rounded-[4px] border border-[#cfd3de] bg-white px-[14px] text-[0.95rem] text-[#1c2341] outline-none transition-colors placeholder:text-[#a3a8b8] focus:border-[#1c2341] focus:ring-2 focus:ring-[#1c2341]/10";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(entrar, {});
  const [ver, setVer] = useState(false);

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="grid gap-2">
        <label htmlFor="email" className="text-[0.85rem] font-medium">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} placeholder="nome@mphengenharia.com.br" className={campo} />
      </div>
      <div className="grid gap-2">
        <label htmlFor="senha" className="text-[0.85rem] font-medium">
          Senha
        </label>
        <div className="relative">
          <input id="senha" name="senha" type={ver ? "text" : "password"} autoComplete="current-password" required className={`${campo} pr-[46px]`} />
          <button
            type="button"
            onClick={() => setVer(!ver)}
            aria-label={ver ? "Ocultar senha" : "Mostrar senha"}
            className="absolute top-0 right-0 flex h-[46px] w-[46px] items-center justify-center text-[#5b6178] hover:text-[#1c2341]"
          >
            {ver ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
      </div>
      {state.erro && (
        <p role="alert" className="rounded-[4px] border-l-[3px] border-[#e31b23] bg-[#e31b23]/5 px-3 py-2 text-[0.85rem] text-[#b3141b]">
          {state.erro}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 h-[46px] w-full rounded-[4px] bg-[#1c2341] text-[0.95rem] font-semibold text-white transition-colors hover:bg-[#262f57] disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
