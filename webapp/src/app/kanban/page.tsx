import { getAllIdeas, getInteractions } from "@/lib/data";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
  const [dailyIdeas, interactions] = await Promise.all([
    getAllIdeas(),
    getInteractions(),
  ]);

  const allIdeas = dailyIdeas.flatMap(({ date, ideas }) =>
    ideas.map((idea) => ({
      ...idea,
      _date: date,
    })),
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        Opportunity Kanban
      </h1>
      <KanbanBoard ideas={allIdeas} interactions={interactions} />
    </div>
  );
}
