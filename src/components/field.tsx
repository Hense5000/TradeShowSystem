import { countryOptions } from "@/lib/countries";

/** A labelled text input with an optional hint underneath. */
export function Field({
  id,
  label,
  hint,
  className,
  ...input
}: { id: string; label: string; hint?: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`min-w-0 ${className ?? ""}`}>
      <label className="label" htmlFor={id}>{label}</label>
      <input className="input" id={id} name={id} {...input} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

/** A labelled country picker that submits ISO codes such as "DK". */
export function CountrySelect({ id, label = "Country", defaultValue }: { id: string; label?: string; defaultValue?: string | null }) {
  return (
    <div className="min-w-0">
      <label className="label" htmlFor={id}>{label}</label>
      <select className="input" id={id} name={id} defaultValue={defaultValue ?? ""} autoComplete="country">
        <option value="">Choose country</option>
        {countryOptions().map((c) => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}
