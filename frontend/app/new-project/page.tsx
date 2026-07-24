"use client";

import PagePlaceholder from "@/components/PagePlaceholder";
import { FolderPlus } from "lucide-react";

export default function NewProjectPage() {
  return (
    <PagePlaceholder
      title="New Project"
      description="Start a new therapeutic project"
      icon={FolderPlus}
      sections={[
        {
          label: "Step 1 — Target Identification",
          items: ["Disease", "Gene", "Organism", "Mechanism"],
        },
        {
          label: "Step 2 — Clinical Goal",
          items: [
            "Knockdown",
            "Exon skipping",
            "Exon inclusion",
            "Splice correction",
            "Translation inhibition",
            "RNA editing",
          ],
        },
        {
          label: "Step 3 — Experimental Context",
          items: ["Target tissue", "Cell line", "Mutation", "Transcript"],
        },
        {
          label: "Step 4 — Launch",
          items: ["Review & launch project"],
        },
      ]}
    />
  );
}
