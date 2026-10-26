'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

type FilterOption = { value: string; label: string };

export default function AdminFilterDropdown({
  label,
  options,
  value,
  onChange,
  className = '',
}: {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedIndex = Math.max(options.findIndex((option) => option.value === value), 0);
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return;

    listboxRef.current?.focus();
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

  function openMenu() {
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  function selectOption(optionValue: string) {
    setOpen(false);
    onChange(optionValue);
    triggerRef.current?.focus();
  }

  function handleListboxKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectOption(options[activeIndex].value);
    }
  }

  return (
    <div className={`admin-filter-dropdown ${className}`.trim()} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="admin-filter-dropdown__trigger"
        aria-haspopup="listbox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openMenu();
          }
        }}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown aria-hidden="true" size={18} />
      </button>
      {open && (
        <div
          ref={listboxRef}
          id={listboxId}
          className="admin-filter-dropdown__menu"
          role="listbox"
          aria-label={label}
          aria-activedescendant={`${listboxId}-option-${activeIndex}`}
          tabIndex={0}
          onKeyDown={handleListboxKeyDown}
        >
          {options.map((option, index) => (
            <div
              id={`${listboxId}-option-${index}`}
              key={option.value || 'all'}
              className="admin-filter-dropdown__option"
              role="option"
              aria-selected={option.value === value}
              data-active={index === activeIndex}
              onMouseMove={() => setActiveIndex(index)}
              onClick={() => selectOption(option.value)}
            >
              <span>{option.label}</span>
              {option.value === value && <Check aria-hidden="true" size={16} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
