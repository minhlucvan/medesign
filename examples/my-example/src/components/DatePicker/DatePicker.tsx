/**
 * DatePicker — captured by emdesign.
 * Reusable, design-system-bound component. Edit freely; re-capture to update.
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Input, Card, Stack } from "@ds";

export interface DatePickerProps {
  /** Placeholder displayed when no date is selected. */
  placeholder?: string;
  /** The currently selected date. */
  value?: Date;
  /** Called when the user selects a date. */
  onChange?: (date: Date) => void;
  /** Minimum selectable date. */
  minDate?: Date;
  /** Maximum selectable date. */
  maxDate?: Date;
  /** Reference date for "today" highlighting (defaults to current date client-side). */
  todayDate?: Date;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDate(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Atelier editorial date picker — input-triggered dropdown calendar for single date selection. */
export function DatePicker({
  placeholder,
  value,
  onChange,
  minDate,
  maxDate,
  todayDate,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = value || todayDate || new Date(2026, 5, 15);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Close the calendar when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const handleSelect = useCallback(
    (day: number) => {
      const date = new Date(currentMonth.year, currentMonth.month, day);
      setSelectedDate(date);
      onChange?.(date);
      setIsOpen(false);
    },
    [currentMonth, onChange],
  );

  const prevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  }, []);

  const nextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  }, []);

  const daysInMonth = getDaysInMonth(currentMonth.year, currentMonth.month);
  const firstDay = getFirstDayOfMonth(currentMonth.year, currentMonth.month);
  const today = todayDate || (value ? new Date(value.getFullYear(), value.getMonth(), value.getDate()) : new Date(2026, 5, 15));
  const monthLabel = `${MONTH_NAMES[currentMonth.month]} ${currentMonth.year}`;

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Trigger input — read-only, displays formatted selected date */}
      <Input
        readOnly
        value={selectedDate ? formatDate(selectedDate) : ""}
        placeholder={placeholder}
        onClick={() => setIsOpen((prev) => !prev)}
        className="cursor-pointer min-w-[220px]"
      />

      {/* Calendar dropdown */}
      {isOpen && (
        <Card className="absolute top-full left-0 mt-2 z-50 w-[280px] p-4">
          <Stack gap={3}>
            {/* Month and year navigation header */}
            <Stack direction="row" gap={2} className="items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="w-8 h-8 flex items-center justify-center rounded text-text-muted hover:bg-surface transition-[background-color] duration-[var(--motion-fast)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                ←
              </button>
              <span className="font-display font-medium text-text text-base">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="w-8 h-8 flex items-center justify-center rounded text-text-muted hover:bg-surface transition-[background-color] duration-[var(--motion-fast)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                →
              </button>
            </Stack>

            {/* Day-of-week header row */}
            <div className="grid grid-cols-7 gap-0">
              {DAY_NAMES.map((name) => (
                <div
                  key={name}
                  className="text-center text-text-muted text-xs font-semibold tracking-[0.12em] uppercase py-1"
                >
                  {name}
                </div>
              ))}
            </div>

            {/* Calendar day grid */}
            <div className="grid grid-cols-7 gap-0">
              {/* Empty cells padding before the first day */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const date = new Date(currentMonth.year, currentMonth.month, day);
                const isSelected = selectedDate
                  ? isSameDay(date, selectedDate)
                  : false;
                const isTodayDate = isSameDay(date, today);
                const isDisabled =
                  (minDate && date < minDate) || (maxDate && date > maxDate);

                let cellClass =
                  "text-center text-sm py-1.5 rounded-[var(--radius-sm)] transition-[background-color,color] duration-[var(--motion-fast)]";

                if (isSelected) {
                  cellClass += " bg-accent text-white";
                } else if (isDisabled) {
                  cellClass += " text-border cursor-not-allowed";
                } else if (isTodayDate) {
                  cellClass += " text-accent font-medium cursor-pointer hover:bg-surface";
                } else {
                  cellClass += " text-text cursor-pointer hover:bg-surface";
                }

                return (
                  <button
                    key={day}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => !isDisabled && handleSelect(day)}
                    className={cellClass}
                    aria-label={`${MONTH_NAMES[currentMonth.month]} ${day}, ${currentMonth.year}`}
                    aria-selected={isSelected}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </Stack>
        </Card>
      )}
    </div>
  );
}
