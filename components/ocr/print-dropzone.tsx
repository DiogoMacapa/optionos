'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImagePlus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PrintDropzoneProps {
  onDrop: (file: File) => void;
  processing?: boolean;
  progress?: number | null;
  label?: string;
  hint?: string;
}

export function PrintDropzone({
  onDrop,
  processing = false,
  progress = null,
  label = 'Arraste o print aqui',
  hint = 'ou clique para selecionar, ou cole com Ctrl+V — PNG ou JPG',
}: PrintDropzoneProps) {
  const handleDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (file) onDrop(file);
    },
    [onDrop]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'] },
    maxFiles: 1,
    disabled: processing,
  });

  // Colar direto da área de transferência (Ctrl+V) — mesmo fluxo já usado
  // no chat, mais rápido do que abrir o seletor de arquivo.
  const processingRef = useRef(processing);
  useEffect(() => {
    processingRef.current = processing;
  }, [processing]);

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (processingRef.current) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            onDrop(file);
          }
          break;
        }
      }
    }
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onDrop]);

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
        isDragActive ? 'border-accent bg-accent-muted' : 'border-border bg-surface hover:bg-surface-hover',
        processing && 'cursor-wait opacity-70'
      )}
    >
      <input {...getInputProps()} />
      {processing ? (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Lendo o print…</p>
            {progress !== null && (
              <p className="font-tabular text-xs text-muted-foreground">{progress}%</p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-muted">
            <ImagePlus className="h-4.5 w-4.5 text-accent" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        </>
      )}
    </div>
  );
}
