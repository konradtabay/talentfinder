"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchCities } from "@/lib/cities";

type Props = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
};

export function CityCombobox({ value, onChange, required, className }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const options = searchCities(value);

  useEffect(() => {
    setActive(0);
  }, [value, open]);

  function pick(label: string) {
    onChange(label);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        required={required}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        placeholder="City"
        className={className}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            setOpen(true);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && options[active]) {
            e.preventDefault();
            pick(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto border border-line bg-bg shadow-sm"
        >
          {options.map((label, i) => (
            <li key={label} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-accent/30 ${i === active ? "bg-accent/20" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(label)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
