"use client";

import PagePlaceholder from "@/components/PagePlaceholder";
import { BarChart3 } from "lucide-react";

export default function AnalysisPage() {
  return (
    <PagePlaceholder
      title="Computational Analysis"
      description="In-depth computational analyses of your sequences"
      icon={BarChart3}
      sections={[
        {
          label: "Structure & Folding",
          items: [
            "Off-target prediction",
            "Secondary structure",
            "RNA folding",
            "Accessibility mapping",
            "Thermodynamics",
          ],
        },
        {
          label: "Sequence Analysis",
          items: [
            "Conservation analysis",
            "SNP overlap",
            "Binding energy",
            "RNA-RNA interaction",
            "K-mer frequency",
          ],
        },
        {
          label: "Safety & Delivery",
          items: [
            "Toxicity prediction",
            "Delivery compatibility",
            "Immunogenicity screening",
          ],
        },
        {
          label: "Results",
          items: ["Interactive plots", "Export data", "Compare sequences"],
        },
      ]}
    />
  );
}
