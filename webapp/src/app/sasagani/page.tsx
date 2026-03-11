import { getSasaganiData } from "@/lib/sasagani-data";
import { SasaganiDashboard } from "@/components/sasagani/SasaganiDashboard";

export const metadata = {
  title: "ささがに — Asagiri",
  description: "靈感織網",
};

export const dynamic = "force-dynamic";

export default async function SasaganiPage() {
  const data = await getSasaganiData();
  return <SasaganiDashboard initialData={data} />;
}
