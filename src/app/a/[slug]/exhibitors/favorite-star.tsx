import { Icon } from "@/components/icons";
import { toggleFavorite } from "../lists/actions";

/** The star that puts a company on the account's Favorites list, or takes it off. */
export function FavoriteStar({ slug, exhibitorIds, name, on }: { slug: string; exhibitorIds: string | string[]; name: string; on: boolean }) {
  return (
    <form action={toggleFavorite.bind(null, slug, exhibitorIds, !on)}>
      <button
        className={`grid size-8 place-items-center rounded-lg hover:bg-subtle ${on ? "text-brand" : "text-faint hover:text-muted"}`}
        title={on ? "Remove from Favorites" : "Add to Favorites"}
        aria-label={on ? `Remove ${name} from Favorites` : `Add ${name} to Favorites`}
        aria-pressed={on}
      >
        <Icon name="star" className="size-5" filled={on} />
      </button>
    </form>
  );
}
