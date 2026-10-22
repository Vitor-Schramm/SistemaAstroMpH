import { Suspense } from "react";
import type { Metadata } from "next";
import { LogoMphEmpilhado, LogoMphHorizontal } from "@/components/marca/logo-mph";
import { LoginForm } from "./login-form";
import { AcessoRapido } from "./acesso-rapido";

export const metadata: Metadata = { title: "Acesso" };

// Página de acesso exclusiva da MpH Engenharia: formulário à esquerda e painel da marca à direita
// (azul-marinho com a grade de uma prancha técnica e o logotipo empilhado).

async function FormComDestino({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next } = await searchParams;
  const destino = typeof next === "string" ? next : undefined;
  return (
    <>
      <LoginForm next={destino} />
      {process.env.LOGIN_TESTE_SENHA && <AcessoRapido next={destino} />}
    </>
  );
}

const grade = {
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
  backgroundSize: "120px 120px, 120px 120px, 24px 24px, 24px 24px",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="grid min-h-svh bg-white text-[#1c2341] lg:grid-cols-[minmax(420px,5fr)_7fr]">
      <section className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <LogoMphHorizontal className="h-[30px] w-auto self-start" />
        <div className="flex flex-1 items-center">
          <div className="w-full max-w-[380px] py-10">
            <span className="mb-4 block h-[3px] w-10 bg-[#e31b23]" />
            <h1 className="mb-2 text-[1.9rem] leading-tight font-semibold text-[#1c2341]">Acesso ao sistema</h1>
            <p className="mb-8 text-[0.95rem] leading-relaxed text-[#5b6178]">
              Ferramenta de gestão de obras da MpH Engenharia. Use o e-mail e a senha liberados pelo administrador.
            </p>
            <Suspense fallback={<LoginForm />}>
              <FormComDestino searchParams={searchParams} />
            </Suspense>
          </div>
        </div>
        <p className="text-[0.8rem] text-[#8a8fa3]">© MpH Engenharia · Uso restrito à equipe</p>
      </section>

      <section className="relative hidden overflow-hidden bg-[#1c2341] lg:block" style={grade}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_35%,rgba(255,255,255,0.08),transparent_60%)]" />
        <div className="absolute top-0 bottom-0 left-[18%] w-[3px] bg-[#e31b23]" />
        <div className="relative flex h-full flex-col justify-between p-16 pl-[calc(18%+3rem)] text-white">
          <LogoMphEmpilhado claro className="h-auto w-[220px] opacity-95" />
          <div className="max-w-[520px]">
            <p className="mb-3 text-[0.8rem] font-medium tracking-[0.2em] text-white/70 uppercase">Gestão de obras</p>
            <h2 className="mb-4 text-[2.2rem] leading-[1.15] font-semibold text-white">Da solicitação ao pagamento, cada obra em um só lugar.</h2>
            <p className="text-[1rem] leading-relaxed text-white/75">Compras, controle financeiro, notas e guias da MpH Engenharia, com os dados de cada obra reunidos e atualizados.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
