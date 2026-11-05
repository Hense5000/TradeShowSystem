import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { LEGAL_EFFECTIVE_DATE, LEGAL_SECTIONS, type LegalBlock } from "./content";

export const metadata: Metadata = { title: "Terms, Privacy & Cookie policies – Trade Show System" };

function Block({ block }: { block: LegalBlock }) {
  if ("p" in block) return <p>{block.p}</p>;
  if ("list" in block) {
    return (
      <ul className="list-disc space-y-1.5 pl-5">
        {block.list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-subtle text-muted">
          <tr>
            {block.table.head.map((h) => (
              <th key={h} className="px-3 py-2 font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((row) => (
            <tr key={row[0]} className="border-t border-line align-top">
              {row.map((cell, i) => (
                <td key={i} className="px-3 py-2">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Public page with the Terms of Service, Privacy Policy and Cookie Notice. Linked from the footer on every page. */
export default function LegalPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/" className="self-start">
        <Logo className="h-8 w-auto" />
      </Link>
      <div className="card space-y-4">
        <h1 className="page-title">Terms, Privacy &amp; Cookie policies</h1>
        <p className="text-muted">Effective date: {LEGAL_EFFECTIVE_DATE}</p>
        <nav className="flex flex-wrap gap-2">
          {LEGAL_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="btn-secondary">{s.title}</a>
          ))}
        </nav>
      </div>
      {LEGAL_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="card scroll-mt-6 space-y-5 leading-relaxed">
          <h2 className="text-xl font-bold">{section.title}</h2>
          {section.intro?.map((b, i) => <Block key={i} block={b} />)}
          {section.parts.map((part) => (
            <div key={part.title} className="space-y-2">
              <h3 className="font-bold">{part.title}</h3>
              {part.blocks.map((b, i) => <Block key={i} block={b} />)}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
