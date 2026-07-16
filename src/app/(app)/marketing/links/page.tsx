import { redirect } from "next/navigation";

// Links is now a tab on the single Marketing page (instant client switch).
export default function LinksRedirect() {
  redirect("/marketing?tab=links");
}
