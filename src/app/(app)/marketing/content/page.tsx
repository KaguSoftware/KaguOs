import { redirect } from "next/navigation";

// Content is now a tab on the single Marketing page (instant client switch).
export default function ContentRedirect() {
  redirect("/marketing?tab=content");
}
