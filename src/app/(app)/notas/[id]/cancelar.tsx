"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelarNota } from "@/lib/notas/actions";

export function CancelarNota({ id, numero }: { id: number; numero: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Cancelar a nota ${numero}? O valor volta para o saldo da OC.`)) return;
        startTransition(async () => {
          const r = await cancelarNota(id);
          if (!r.ok) return void toast.error(r.erro);
          toast.success("Nota cancelada.");
          router.refresh();
        });
      }}
    >
      <Ban /> Cancelar nota
    </Button>
  );
}
