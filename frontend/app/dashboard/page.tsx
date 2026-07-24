"use client";

import PagePlaceholder from "@/components/PagePlaceholder";
import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  return (
    <PagePlaceholder
      title="Dashboard"
      description="Overview of your RNA therapeutics pipeline"
      icon={LayoutDashboard}
      sections={[
        {
          label: "Overview",
          items: [
            "Active projects",
            "Recent analyses",
            "Running jobs",
            "AI recommendations",
            "Recently viewed genes",
            "Upcoming wet-lab validations",
          ],
        },
        {
          label: "Statistics",
          items: [
            "Genes analyzed",
            "ASOs designed",
            "Successful candidates",
            "Active experiments",
            "Computational jobs",
            "Validation status",
          ],
        },
        {
          label: "Widgets",
          items: [
            "Recent activity",
            "Pipeline progress",
            "Literature updates",
            "Database update status",
            "AI suggestions",
          ],
        },
      ]}
    />
  );
}
