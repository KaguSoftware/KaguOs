import { permanentRedirect } from "next/navigation";

/**
 * The input pack used to live here, when it was the only thing in the portal.
 *
 * Kept as a redirect rather than deleted: this URL is in the bell notification
 * every client got when their account was set up, and in whatever email or
 * WhatsApp message pointed them at it. A 404 for someone who bookmarked the one
 * page they were asked to fill in is the worst possible way to find out the
 * navigation changed.
 *
 * `permanentRedirect` (308) rather than `redirect` (307), because the move is
 * permanent and the old path is never coming back.
 */
export default async function LegacyPortalProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  permanentRedirect(`/portal/inputs/${projectId}`);
}
