import { redirect } from "next/navigation";

// Layout B is a single page — the per-position detail opens as a slide-in rail
// on the dashboard rather than its own route. Old deep links redirect there.
export default async function PositionRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/?pos=${encodeURIComponent(id)}`);
}
