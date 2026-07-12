'use client';

import { useState, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
import { parseOptionBookText, type ParsedOptionRow } from '@/lib/ocr/book-parser';

/**
 * OCR do book de opções (BTG Pactual).
 *
 * Diferente do gráfico (chart-regions.ts), ainda não temos coordenadas
 * calibradas com um print real do book — por isso este hook roda OCR
 * na imagem inteira (upscale 2x) em vez de recortar regiões fixas.
 * Menos preciso que o fluxo do gráfico; todo resultado passa pela
 * tabela de confirmação linha a linha antes de salvar (book-confirm-table.tsx).
 */
export interface BookOcrState {
  status: 'idle' | 'processing' | 'done' | 'error';
  rows: ParsedOptionRow[];
  rawText: string;
  error: string | null;
}

async function upscaleImage(file: File, factor = 2): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth * factor;
  canvas.height = img.naturalHeight * factor;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context indisponível.');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return canvas.toDataURL('image/png');
}

export function useBookOcr() {
  const [state, setState] = useState<BookOcrState>({
    status: 'idle',
    rows: [],
    rawText: '',
    error: null,
  });

  const processImage = useCallback(async (file: File) => {
    setState({ status: 'processing', rows: [], rawText: '', error: null });
    try {
      const upscaled = await upscaleImage(file, 2);
      const worker = await createWorker('por+eng');
      const { data } = await worker.recognize(upscaled);
      await worker.terminate();

      const rows = parseOptionBookText(data.text);
      setState({ status: 'done', rows, rawText: data.text, error: null });
    } catch (err) {
      setState({
        status: 'error',
        rows: [],
        rawText: '',
        error: err instanceof Error ? err.message : 'Erro desconhecido ao processar imagem.',
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle', rows: [], rawText: '', error: null });
  }, []);

  return { ...state, processImage, reset };
}
