import { FavoritesView } from "../favorites-view";

export default async function FavoriteTradeShowsPage({ params, searchParams }: PageProps<"/a/[slug]/favorites/trade-shows">) {
  const { slug } = await params;
  return <FavoritesView slug={slug} tab="shows" sp={await searchParams} />;
}
