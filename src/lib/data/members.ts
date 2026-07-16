import { memberColorCss } from "@/lib/colors";
import type { MembersMap } from "@/lib/types";
import type { SessionContext } from "@/lib/data/session";

/** Everyone's display name + identity color, for color-coding names app-wide. */
export async function getMembersMap(
  supabase: SessionContext["supabase"]
): Promise<MembersMap> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, color");

  const map: MembersMap = {};
  for (const p of data ?? []) {
    map[p.id] = {
      name: p.full_name || p.email,
      color: memberColorCss(p.id, p.color),
    };
  }
  return map;
}
