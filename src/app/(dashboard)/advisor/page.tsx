import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { ServiceAdvisor } from "@/components/advisor/service-advisor";

export default async function AdvisorPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  return (
    <div>
      <PageHeader
        title="Smart Service Advisor"
        description="Describe your growth goal and we will recommend real services from the catalog."
      />
      <ServiceAdvisor />
    </div>
  );
}
