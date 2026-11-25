import { redirect } from "next/navigation";
import { requireSignedInUser } from "@/lib/server/page-session";

export default async function HomePage() {
  await requireSignedInUser("/");
  redirect("/prompts");
}
