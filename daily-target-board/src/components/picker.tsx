"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";

export interface PickerOption {
  value: string;
  label: string;
  /** Options with the same section are listed together under a heading. */
  section?: string | null;
}

interface PickerProps {
  label: string;
  /** The hidden field that carries the chosen value when the form is sent. */
  name: string;
  options: PickerOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function Picker({
  label,
  name,
  options,
  value,
  onChange,
  placeholder = "Choose…",
}: PickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value);

  // Close when the person taps anywhere else.
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // Make sure the whole list is on screen when it opens.
  useEffect(() => {
    if (open) listRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  // Sections in the order they first appear.
  const sections: (string | null)[] = [];
  for (const option of options) {
    const section = option.section ?? null;
    if (!sections.includes(section)) sections.push(section);
  }

  return (
    <div
      ref={rootRef}
      className="text-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <span className="font-medium">{label}</span>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm"
      >
        <span className={selected ? "" : "text-slate-500"}>
          {selected ? selected.label : placeholder}
        </span>
        <span aria-hidden="true" className="text-xs text-slate-400">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={label}
          className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-300 bg-white"
        >
          {sections.map((section) => (
            <Fragment key={section ?? "_none"}>
              {section ? (
                <li
                  role="presentation"
                  className="sticky top-0 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {section}
                </li>
              ) : null}
              {options
                .filter((option) => (option.section ?? null) === section)
                .map((option) => (
                  <li key={option.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={option.value === value}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={`block w-full break-words px-3 py-2 text-left text-sm ${
                        option.value === value ? "bg-slate-100 font-medium" : ""
                      }`}
                    >
                      {option.label}
                    </button>
                  </li>
                ))}
            </Fragment>
          ))}
        </ul>
      ) : null}
    </div>
  );
}