'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted] = useState(() => typeof document !== 'undefined');
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popupWidth = 236;
    const popupHeight = 260;
    // Ancora à direita do botão se não couber embaixo/à esquerda dentro da viewport.
    let left = rect.left;
    if (left + popupWidth > window.innerWidth - 8) {
      left = window.innerWidth - popupWidth - 8;
    }
    let top = rect.bottom + 6;
    if (top + popupHeight > window.innerHeight - 8) {
      top = rect.top - popupHeight - 6;
    }
    setCoords({ top, left });
  }, []);

  function openPicker() {
    updatePosition();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setRangeStart(null);
      }
    }
    function handleReposition() {
      updatePosition();
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [open, updatePosition]);

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
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-2 py-1 font-tabular text-[11.5px]',
          value ? 'text-foreground' : 'text-faint-foreground'
        )}
      >
        <Calendar className="h-3 w-3 text-accent" />
        {value || 'Escolher'}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={popupRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 100 }}
            className="w-[236px] rounded-lg border border-border bg-surface p-3 shadow-2xl"
          >
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
                const isStart =
                  rangeStart && day && rangeStart.getDate() === day && rangeStart.getMonth() === viewMonth && rangeStart.getFullYear() === viewYear;
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
          </div>,
          document.body
        )}
    </>
  );
}
