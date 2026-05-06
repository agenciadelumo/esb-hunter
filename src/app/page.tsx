import { redirect } from "next/navigation";
import { HunterApp } from "@/components/hunter-app";
import { getCurrentSession } from "@/lib/auth";

export default async function Home() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return <HunterApp username={session.username} />;
}
