// ============================================================
// OptionOS — Preparação de imagem para OCR
// Recorte por região relativa (% da imagem) + upscale.
// Regiões relativas (não pixels absolutos) porque o print pode
// vir em resoluções diferentes dependendo do dispositivo/zoom.
// ============================================================

export interface RelativeRegion {
  id: string;
  label: string;
  /** Coordenadas relativas, 0 a 1, em relação à imagem completa. */
  xPct: [number, number];
  yPct: [number, number];
  /** Fator de upscale aplicado antes do OCR (texto pequeno precisa de mais). */
  upscale: number;
}

export async function loadImage(source: string | File): Promise<HTMLImageElement> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Recorta uma região relativa da imagem e aplica upscale via canvas.
 * Retorna um dataURL PNG pronto para o Tesseract.
 */
export function cropAndUpscale(img: HTMLImageElement, region: RelativeRegion): string {
  const [x0, x1] = region.xPct;
  const [y0, y1] = region.yPct;

  const sx = Math.round(x0 * img.naturalWidth);
  const sy = Math.round(y0 * img.naturalHeight);
  const sw = Math.round((x1 - x0) * img.naturalWidth);
  const sh = Math.round((y1 - y0) * img.naturalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = sw * region.upscale;
  canvas.height = sh * region.upscale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context indisponível.');

  // Suavização desligada: texto de UI fica mais nítido em upscale sem blur.
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/png');
}

export function cropAllRegions(
  img: HTMLImageElement,
  regions: RelativeRegion[]
): { region: RelativeRegion; dataUrl: string }[] {
  return regions.map((region) => ({ region, dataUrl: cropAndUpscale(img, region) }));
}
