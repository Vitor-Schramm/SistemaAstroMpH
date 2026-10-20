// Cabeçalho comum dos PDFs de guia do AstroTools: logo à esquerda, título e dados da obra ao centro.

export function CabecalhoGuia({ titulo, obra, coordenador, hoje }: { titulo: string; obra?: string; coordenador?: string | null; hoje?: string }) {
  return (
    <header className="relative mb-[28px] min-h-[70px]">
      <div className="absolute top-0 left-0 rounded-[6px] bg-[#e5e5e5] px-[12px] py-[6px] text-[22px] tracking-tight">
        <span className="font-semibold text-[#1f3d7a]">MpH</span>
        <span className="mx-[2px] font-bold text-[#c00000]">|</span>
        <span className="text-[#555]">engenharia</span>
      </div>
      <div className="pt-[18px] text-center text-[#212529]">
        <h1 className="text-[22px] font-normal">{titulo}</h1>
        {obra && <p className="mt-[6px] text-[10px]">Obra: {obra}</p>}
        {obra && <p className="mt-[3px] text-[10px]">Coordenador:{coordenador ? ` ${coordenador}` : ""}</p>}
        {hoje && <p className="mt-[3px] text-[10px]">Data: {hoje}</p>}
      </div>
    </header>
  );
}

export const celCab = "bg-[#e7e6e6] px-[3px] py-[4px] text-left font-normal";
export const cel = "px-[3px] py-[3px] align-top";
export const hojeBr = () => new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
