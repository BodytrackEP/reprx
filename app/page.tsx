import { redirect } from "next/navigation";

// proxy.ts sends signed-in users on; this covers anything it lets through.
export default function Home() {
  redirect("/admin");
}
