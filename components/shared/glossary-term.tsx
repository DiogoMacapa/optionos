'use client';

import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { GLOSSARY } from '@/lib/education/glossary';

interface GlossaryTermProps {
  termKey: keyof typeof GLOSSARY;
  children: React.ReactNode;
}

/** Envolve um rótulo (ex: "Delta") e mostra uma explicação simples ao passar o mouse/tocar. */
export function GlossaryTerm({ termKey, children }: GlossaryTermProps) {
  const entry = GLOSSARY[termKey];
  if (!entry) return <>{children}</>;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex items-center gap-1 underline decoration-dotted decoration-faint-foreground underline-offset-2">
            {children}
            <HelpCircle className="h-3 w-3 text-faint-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium text-foreground">{entry.term}</p>
          <p className="mt-1 text-muted-foreground">{entry.explanation}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
