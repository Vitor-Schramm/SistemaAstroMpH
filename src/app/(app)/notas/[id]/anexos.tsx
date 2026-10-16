"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { dataHora } from "@/lib/format";
import { linkAnexo, registrarAnexo, removerAnexo } from "@/lib/notas/actions";

export type Anexo = { id: number; nome: string; tamanho: number | null; criado_em: string };

const MAX = 20 * 1024 * 1024;
const kb = (n: number | null) => (n == null ? "" : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export function Anexos({ notaId, anexos, podeEnviar, podeRemover }: { notaId: number; anexos: Anexo[]; podeEnviar: boolean; podeRemover: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [pending, startTransition] = useTransition();

  const enviar = async (files: FileList | null) => {
    if (!files?.length) return;
    setEnviando(true);
    const supabase = createClient();
    let ok = 0;
    for (const file of Array.from(files)) {
      if (file.size > MAX) {
        toast.error(`${file.name}: maior que 20 MB.`);
        continue;
      }
      const seguro = file.name.normalize("NFD").replace(/[^\w.\-]+/g, "_");
      const caminho = `${notaId}/${crypto.randomUUID()}-${seguro}`;
      const { error } = await supabase.storage.from("nf-anexos").upload(caminho, file, { contentType: file.type || undefined });
      if (error) {
        toast.error(`${file.name}: ${error.message}`);
        continue;
      }
      const r = await registrarAnexo(notaId, caminho, file.name, file.size);
      if (!r.ok) {
        await supabase.storage.from("nf-anexos").remove([caminho]);
        toast.error(`${file.name}: ${r.erro}`);
        continue;
      }
      ok++;
    }
    setEnviando(false);
    if (input.current) input.current.value = "";
    if (ok) {
      toast.success(`${ok} arquivo(s) anexado(s).`);
      router.refresh();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Arquivos da NF</CardTitle>
        {podeEnviar && (
          <>
            <input
              ref={input}
              type="file"
              multiple
              accept=".pdf,.xml,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => enviar(e.target.files)}
            />
            <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={enviando}>
              <Upload /> {enviando ? "Enviando…" : "Anexar arquivos"}
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent>
        {anexos.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhum arquivo. Anexe o PDF/XML da nota (até 20 MB cada).
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {anexos.map((a) => (
              <li key={a.id} className="flex items-center gap-3 p-2 text-sm">
                <FileText className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{a.nome}</span>
                <span className="text-xs text-muted-foreground">
                  {kb(a.tamanho)} · {dataHora(a.criado_em)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Baixar ${a.nome}`}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await linkAnexo(a.id);
                      if (!r.ok || !r.url) return void toast.error(r.ok ? "Link indisponível." : r.erro);
                      window.open(r.url, "_blank");
                    })
                  }
                >
                  <Download />
                </Button>
                {podeRemover && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remover ${a.nome}`}
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`Remover ${a.nome}?`)) return;
                      startTransition(async () => {
                        const r = await removerAnexo(a.id, notaId);
                        if (!r.ok) return void toast.error(r.erro);
                        toast.success("Arquivo removido.");
                        router.refresh();
                      });
                    }}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
