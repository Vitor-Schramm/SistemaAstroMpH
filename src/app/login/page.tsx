import { Suspense } from "react";
import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";
import { AcessoRapido } from "./acesso-rapido";

export const metadata: Metadata = { title: "Entrar" };

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

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-6" />
          </div>
          <CardTitle className="text-xl">MPH Sistema</CardTitle>
          <CardDescription>Entre com seu e-mail corporativo</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoginForm />}>
            <FormComDestino searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
