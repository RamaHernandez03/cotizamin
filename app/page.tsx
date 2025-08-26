// app/dashboard/page.tsx (server component)
import { redirect } from "next/navigation";

export default function DashboardIndex() {
  redirect("/dashboard/home");
}
