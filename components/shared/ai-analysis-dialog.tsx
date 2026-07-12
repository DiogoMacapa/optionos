'use client';

import { useState } from 'react';
import { Sparkles, Copy, Check, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface AiAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  prompt: string;
}

export function AiAnalysisDialog({ open, onOpenChange, title, prompt }: AiAnalysisDialogProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Copie o texto abaixo e cole em uma conversa com o Claude (ou outra IA de sua preferência) para receber a análise —
            sem custo de API embutido no sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-elevated p-3 font-tabular text-xs leading-relaxed text-foreground">
            {prompt}
          </pre>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" asChild>
              <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir Claude.ai
              </a>
            </Button>
            <Button size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar texto'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
