import { FavoritesView } from "../favorites-view";

export default async function FavoriteExhibitorsPage({ params, searchParams }: PageProps<"/a/[slug]/favorites/exhibitors">) {
  const { slug } = await params;
  return <FavoritesView slug={slug} tab="exhibitors" sp={await searchParams} />;
}
