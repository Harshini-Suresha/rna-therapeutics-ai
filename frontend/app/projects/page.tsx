"use client";

import PagePlaceholder from "@/components/PagePlaceholder";
import { Folder } from "lucide-react";

export default function ProjectsPage() {
  return (
    <PagePlaceholder
      title="Projects"
      description="All your therapeutic projects in one place"
      icon={Folder}
      sections={[
        {
          label: "Project Card",
          items: [
            "Name & disease",
            "Progress %",
            "Status (Running / Complete)",
            "Candidate count",
            "Created date",
            "Owner",
            "Last updated",
          ],
        },
        {
          label: "Project Detail View",
          items: [
            "Timeline",
            "Files",
            "Analysis history",
            "Reports",
            "Version history",
            "Collaborators",
          ],
        },
      ]}
    />
  );
}
