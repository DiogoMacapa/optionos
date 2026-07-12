'use client';

import { useState, useCallback } from 'react';
import { loadImage, cropAllRegions } from '@/lib/ocr/image-prep';
import { runOcrOnRegion } from '@/lib/ocr/tesseract-runner';
import { INVESTING_CHART_REGIONS, parseHeaderPrice, parseHeaderRanges, parseOhlcLegend, parseBollingerLegend, parseRsiLegend, parseMacdLegend, type ParsedChartData } from '@/lib/ocr/chart-regions';

export interface ChartOcrState {
  status: 'idle' | 'processing' | 'done' | 'error';
  progress: number; // 0-100
  result: Partial<ParsedChartData> | null;
  regionConfidences: Record<string, number>;
  error: string | null;
}

export function useChartOcr() {
  const [state, setState] = useState<ChartOcrState>({
    status: 'idle',
    progress: 0,
    result: null,
    regionConfidences: {},
    error: null,
  });

  const processImage = useCallback(async (file: File) => {
    setState({ status: 'processing', progress: 0, result: null, regionConfidences: {}, error: null });

    try {
      const img = await loadImage(file);
      const crops = cropAllRegions(img, INVESTING_CHART_REGIONS);

      let parsed: Partial<ParsedChartData> = {};
      const confidences: Record<string, number> = {};

      for (let i = 0; i < crops.length; i++) {
        const { region, dataUrl } = crops[i];
        const ocrResult = await runOcrOnRegion(region.id, dataUrl);
        confidences[region.id] = ocrResult.confidence;

        switch (region.id) {
          case 'header_price':
            parsed = { ...parsed, ...parseHeaderPrice(ocrResult.text) };
            break;
          case 'header_ranges':
            parsed = { ...parsed, ...parseHeaderRanges(ocrResult.text) };
            break;
          case 'ohlc_legend':
            parsed = { ...parsed, ...parseOhlcLegend(ocrResult.text) };
            break;
          case 'bollinger_legend':
            parsed = { ...parsed, ...parseBollingerLegend(ocrResult.text) };
            break;
          case 'rsi_legend':
            parsed = { ...parsed, ...parseRsiLegend(ocrResult.text) };
            break;
          case 'macd_legend':
            parsed = { ...parsed, ...parseMacdLegend(ocrResult.text) };
            break;
        }

        setState((s) => ({ ...s, progress: Math.round(((i + 1) / crops.length) * 100) }));
      }

      setState({
        status: 'done',
        progress: 100,
        result: parsed,
        regionConfidences: confidences,
        error: null,
      });
    } catch (err) {
      setState({
        status: 'error',
        progress: 0,
        result: null,
        regionConfidences: {},
        error: err instanceof Error ? err.message : 'Erro desconhecido ao processar imagem.',
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle', progress: 0, result: null, regionConfidences: {}, error: null });
  }, []);

  return { ...state, processImage, reset };
}
