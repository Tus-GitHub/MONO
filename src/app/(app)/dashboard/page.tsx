import { redirect } from "next/navigation";

/** The dashboard was renamed to Home; keep the old path working. */
export default function DashboardPage() {
  redirect("/home");
}
