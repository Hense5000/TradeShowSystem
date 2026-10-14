"use client";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Picks the day of the month a check runs on; empty means about every four weeks. */
export function DaySelect({
  value,
  onChange,
  disabled,
  label,
  title,
}: {
  value: number | null;
  onChange: (day: number | null) => void;
  disabled?: boolean;
  label: string;
  title?: string;
}) {
  return (
    <select
      className="input w-auto py-1.5"
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      aria-label={label}
      title={title}
    >
      <option value="">About monthly</option>
      {DAYS.map((d) => (
        <option key={d} value={d}>
          Every month on the {ordinal(d)}
        </option>
      ))}
    </select>
  );
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}
