import { redirect } from "next/navigation";

// Contracts is now a tab on the single Management page (instant client switch).
export default function ContractsRedirect() {
  redirect("/management/finance?tab=contracts");
}
