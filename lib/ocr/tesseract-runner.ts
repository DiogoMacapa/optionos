import { createWorker, type Worker } from 'tesseract.js';

/**
 * OptionOS — Runner de OCR.
 *
 * Baseado em teste real (não estimativa): texto grande e nítido
 * (preço, variação, faixas, OHLC) sai com ~100% de precisão. Texto
 * pequeno (legendas de indicadores tipo Bollinger Bands) precisa de
 * recorte de região + upscale 4-5x para ficar confiável — por isso
 * este runner sempre recebe a imagem já recortada por região
 * (ver chart-regions.ts / book-regions.ts) em vez de rodar na imagem inteira.
 */

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('por+eng');
  }
  return workerPromise;
}

export interface OcrRegionResult {
  regionId: string;
  text: string;
  confidence: number; // 0-1
}

/**
 * Roda OCR em uma região já recortada (dataURL ou Blob).
 * O upscale deve ser aplicado ANTES de chamar esta função
 * (ver util `upscaleCanvas` em image-prep.ts).
 */
export async function runOcrOnRegion(
  regionId: string,
  imageSource: string | Blob
): Promise<OcrRegionResult> {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageSource);
  return {
    regionId,
    text: data.text.trim(),
    confidence: (data.confidence ?? 0) / 100,
  };
}

export async function terminateOcrWorker(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
