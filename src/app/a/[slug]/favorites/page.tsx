import { redirect } from "next/navigation";

/** Favorites opens its Exhibitors sub-page; old links (?tab=shows, filters) still land on the right sub-page. */
export default async function FavoritesPage({ params, searchParams }: PageProps<"/a/[slug]/favorites">) {
  const { slug } = await params;
  const { tab, ...rest } = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(rest)) for (const v of [value ?? []].flat()) query.append(key, v);
  const qs = query.toString();
  redirect(`/a/${slug}/favorites/${tab === "shows" ? "trade-shows" : "exhibitors"}${qs ? `?${qs}` : ""}`);
}
