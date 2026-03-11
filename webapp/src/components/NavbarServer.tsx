import { getInteractions, computeStats } from "@/lib/data";
import { Navbar } from "@/components/Navbar";

export async function NavbarServer() {
  const interactions = await getInteractions();
  const stats = await computeStats(interactions);

  return <Navbar streak={stats.current_streak} />;
}
