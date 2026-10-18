import { FavoritesView } from "../favorites-view";

// "Write email" waits for the AI on this page.
export const maxDuration = 60;

export default async function FavoriteExhibitorsPage({ params, searchParams }: PageProps<"/a/[slug]/favorites/exhibitors">) {
  const { slug } = await params;
  return <FavoritesView slug={slug} tab="exhibitors" sp={await searchParams} />;
}
