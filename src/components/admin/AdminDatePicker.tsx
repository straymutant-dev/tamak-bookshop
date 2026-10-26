'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return null;
  }
  return date;
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
}

function shiftDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default function AdminDatePicker({
  value,
  onChange,
  name,
  maxDate,
  placeholder = 'Select date',
  className = '',
}: {
  value: string;
  onChange?: (value: string) => void;
  name?: string;
  maxDate?: string;
  placeholder?: string;
  className?: string;
}) {
  const selectedDate = parseDate(value);
  const today = new Date();
  const maxDateValue = maxDate ?? '';
  const max = parseDate(maxDateValue);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const calendarId = useId();
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date((selectedDate ?? today).getFullYear(), (selectedDate ?? today).getMonth(), 1)
  );
  const [activeDate, setActiveDate] = useState(() => toDateValue(selectedDate ?? today));

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    calendarRef.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${activeDate}"]`)
      ?.focus();
  }, [activeDate, open]);

  const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const maxMonthStart = max ? new Date(max.getFullYear(), max.getMonth(), 1) : null;
  const firstDay = monthStart.getDay();
  const dayCount = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const gridCount = Math.ceil((firstDay + dayCount) / 7) * 7;
  const days = Array.from({ length: gridCount }, (_, index) => {
    const day = index - firstDay + 1;
    return day > 0 && day <= dayCount
      ? new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day)
      : null;
  });
  const monthLabel = visibleMonth.toLocaleDateString('en-GH', { month: 'long', year: 'numeric' });
  const todayValue = toDateValue(today);

  function openCalendar() {
    const initialDate = selectedDate ?? today;
    setVisibleMonth(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
    setActiveDate(toDateValue(initialDate));
    setOpen(true);
  }

  function selectDate(date: Date) {
    const nextValue = toDateValue(date);
    onChange?.(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleDayKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, date: Date) {
    const movement = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }[event.key];
    if (movement === undefined) return;

    event.preventDefault();
    const next = shiftDate(date, movement);
    const nextValue = toDateValue(next);
    if (maxDateValue && nextValue > maxDateValue) return;
    setActiveDate(nextValue);
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function changeMonth(amount: number) {
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + amount, 1));
  }

  return (
    <div className={`admin-date-picker ${className}`.trim()} ref={rootRef}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        type="button"
        className="admin-date-picker__trigger"
        aria-label={value ? `Selected date: ${formatDate(value)}` : placeholder}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={calendarId}
        onClick={() => (open ? setOpen(false) : openCalendar())}
      >
        <span className={value ? '' : 'admin-date-picker__placeholder'}>
          {value ? formatDate(value) : placeholder}
        </span>
        <CalendarDays aria-hidden="true" size={16} />
      </button>
      {open && (
        <div
          ref={calendarRef}
          id={calendarId}
          className="admin-date-picker__calendar"
          role="dialog"
          aria-label="Choose a date"
        >
          <div className="admin-date-picker__header">
            <button
              type="button"
              className="admin-date-picker__month-button"
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft aria-hidden="true" size={17} />
            </button>
            <span aria-live="polite">{monthLabel}</span>
            <button
              type="button"
              className="admin-date-picker__month-button"
              aria-label="Next month"
              disabled={Boolean(maxMonthStart && monthStart >= maxMonthStart)}
              onClick={() => changeMonth(1)}
            >
              <ChevronRight aria-hidden="true" size={17} />
            </button>
          </div>
          <div className="admin-date-picker__grid" role="grid" aria-label={monthLabel}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <span key={day} className="admin-date-picker__weekday" role="columnheader">
                {day}
              </span>
            ))}
            {days.map((date, index) => {
              if (!date) {
                return <span key={`empty-${index}`} className="admin-date-picker__empty" role="gridcell" />;
              }
              const dateValue = toDateValue(date);
              const isDisabled = Boolean(maxDateValue && dateValue > maxDateValue);
              const isSelected = dateValue === value;
              return (
                <button
                  key={dateValue}
                  type="button"
                  data-date={dateValue}
                  className="admin-date-picker__day"
                  role="gridcell"
                  aria-label={date.toLocaleDateString('en-GH', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  aria-selected={isSelected}
                  aria-current={dateValue === todayValue ? 'date' : undefined}
                  disabled={isDisabled}
                  tabIndex={dateValue === activeDate ? 0 : -1}
                  data-selected={isSelected}
                  data-today={dateValue === todayValue}
                  onKeyDown={(event) => handleDayKeyDown(event, date)}
                  onClick={() => selectDate(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
