import { redirect } from "next/navigation";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConfiguracaoPage() {
  if (supabaseConfigurado) redirect("/");

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Configure o Supabase</CardTitle>
          <CardDescription>O sistema ainda não sabe a qual banco se conectar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Crie o arquivo <code className="rounded bg-muted px-1">.env.local</code> na raiz do projeto com:
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
          </pre>
          <p>Depois reinicie o servidor (npm run dev).</p>
        </CardContent>
      </Card>
    </main>
  );
}
