'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

interface WeekRangePickerProps {
  value: string | null;
  onSelect: (weekLabel: string, expirationDate: string) => void;
}

export function WeekRangePicker({ value, onSelect }: WeekRangePickerProps) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setRangeStart(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectDay(day: number) {
    const clicked = new Date(viewYear, viewMonth, day);
    if (!rangeStart) {
      setRangeStart(clicked);
      return;
    }
    const start = clicked < rangeStart ? clicked : rangeStart;
    const end = clicked < rangeStart ? rangeStart : clicked;
    const label = `${start.getDate()}-${end.getDate()}`;
    const expirationDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    onSelect(label, expirationDate);
    setRangeStart(null);
    setOpen(false);
  }

  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-2 py-1 font-tabular text-[11.5px]',
          value ? 'text-foreground' : 'text-faint-foreground'
        )}
      >
        <Calendar className="h-3 w-3 text-accent" />
        {value || 'Escolher'}
      </button>

      {open && (
        <div className="absolute left-0 top-[110%] z-30 w-[220px] rounded-lg border border-border bg-surface p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((y) => y - 1);
                } else setViewMonth((m) => m - 1);
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ‹
            </button>
            <span className="text-[11.5px] font-bold text-foreground">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((y) => y + 1);
                } else setViewMonth((m) => m + 1);
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ›
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="text-center text-[9px] font-bold text-faint-foreground">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              const isStart = rangeStart && day && rangeStart.getDate() === day && rangeStart.getMonth() === viewMonth && rangeStart.getFullYear() === viewYear;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!day}
                  onClick={() => day && selectDay(day)}
                  className={cn(
                    'aspect-square rounded text-[10.5px]',
                    !day && 'invisible',
                    isStart ? 'bg-accent font-bold text-accent-foreground' : 'text-foreground hover:bg-surface-hover'
                  )}
                >
                  {day || ''}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[9.5px] text-faint-foreground">
            {rangeStart ? 'Clique no dia final' : 'Clique no dia inicial'}
          </p>
        </div>
      )}
    </div>
  );
}
