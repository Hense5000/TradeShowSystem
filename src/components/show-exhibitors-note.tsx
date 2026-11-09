import { Icon } from "@/components/icons";

/** The same note on every trade show: where its exhibitor list comes from and how often it is updated. */
export function ShowExhibitorsNote() {
  return (
    <section role="note" className="card flex items-start gap-3 bg-brand-soft">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-brand">
        <Icon name="help" className="size-4" />
      </span>
      <p className="text-sm text-ink">
        If the trade show takes place in the future then exhibitors from last show will appear under exhibitors. The Exhibitor list is updated weekly for this show for new exhibitors
      </p>
    </section>
  );
}
