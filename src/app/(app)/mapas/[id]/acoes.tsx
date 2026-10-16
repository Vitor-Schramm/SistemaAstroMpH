"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelarMapa } from "@/lib/compras/actions";

export function AcoesMapa({ id }: { id: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!confirm("Cancelar este mapa de cotação?")) return;
        startTransition(async () => {
          const r = await cancelarMapa(id);
          if (!r.ok) return void toast.error(r.erro);
          toast.success("Mapa cancelado.");
          router.refresh();
        });
      }}
    >
      <Ban /> Cancelar mapa
    </Button>
  );
}
