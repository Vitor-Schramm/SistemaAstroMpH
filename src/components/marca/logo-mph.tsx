// Logotipo da MpH Engenharia redesenhado em SVG (texto "MpH", barra vermelha e "engenharia"),
// nas versões horizontal e empilhada. `claro` usa o texto em branco para fundos escuros.
// Os textos usam textLength para ocupar sempre a mesma largura, seja qual for a fonte do sistema.

const AZUL = "#1c2341";
const VERMELHO = "#e31b23";
const FONTE = "'Segoe UI', 'Open Sans', Calibri, Arial, sans-serif";

export function LogoMphHorizontal({ claro = false, className }: { claro?: boolean; className?: string }) {
  const cor = claro ? "#ffffff" : AZUL;
  return (
    <svg viewBox="0 0 1015 198" className={className} role="img" aria-label="MpH engenharia">
      <text x="0" y="150" fill={cor} fontFamily={FONTE} fontSize="176" textLength="370" lengthAdjust="spacingAndGlyphs">
        MpH
      </text>
      <rect x="404" y="0" width="22" height="198" fill={VERMELHO} />
      <text x="462" y="136" fill={cor} fontFamily={FONTE} fontSize="112" textLength="550" lengthAdjust="spacingAndGlyphs">
        engenharia
      </text>
    </svg>
  );
}

export function LogoMphEmpilhado({ claro = false, className }: { claro?: boolean; className?: string }) {
  const cor = claro ? "#ffffff" : AZUL;
  return (
    <svg viewBox="0 0 387 300" className={className} role="img" aria-label="MpH engenharia">
      <text x="4" y="168" fill={cor} fontFamily={FONTE} fontSize="210" textLength="379" lengthAdjust="spacingAndGlyphs">
        MpH
      </text>
      <rect x="0" y="196" width="387" height="17" fill={VERMELHO} />
      <text x="4" y="285" fill={cor} fontFamily={FONTE} fontSize="84" textLength="379" lengthAdjust="spacingAndGlyphs">
        engenharia
      </text>
    </svg>
  );
}
