import { Icon } from "@/components/icons";
import { toggleFavoriteShow } from "../favorites/actions";

/** The star that puts a trade show on the account's Favorites page, or takes it off. */
export function FavoriteShowStar({ slug, tradeShowId, name, on }: { slug: string; tradeShowId: string; name: string; on: boolean }) {
  return (
    <form action={toggleFavoriteShow.bind(null, slug, tradeShowId, !on)}>
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
