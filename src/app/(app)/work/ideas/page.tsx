import { redirect } from "next/navigation";

// Ideas is now a tab on the single Work page (instant client switch).
export default function IdeasRedirect() {
  redirect("/work?tab=ideas");
}
