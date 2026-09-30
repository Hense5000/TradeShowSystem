import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { visibleFeaturesWhere } from "@/lib/features";
import { requireMembership } from "@/lib/tenant";

export default async function FeaturesPage({ params }: PageProps<"/a/[slug]/features">) {
  const { slug } = await params;
  const { organization } = await requireMembership(slug);
  const features = await db.feature.findMany({ where: visibleFeaturesWhere(organization.id), orderBy: { name: "asc" } });
  // The menu item says "Soon" until at least one feature is switched on.
  if (features.length === 0) notFound();

  return (
    <>
      <PageHeader title="Features" description="The features available to your account." />
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <article key={f.id} className="card flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon name="grid" className="size-5" />
              </span>
              <span className="pill pill-ok">Available</span>
            </div>
            <h2 className="mt-1 font-bold">{f.name}</h2>
            {f.description && <p className="text-sm text-muted">{f.description}</p>}
          </article>
        ))}
      </section>
    </>
  );
}
