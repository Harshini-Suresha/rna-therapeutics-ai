"use client";

import PagePlaceholder from "@/components/PagePlaceholder";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <PagePlaceholder
      title="Settings"
      description="Platform configuration and preferences"
      icon={Settings}
      sections={[
        {
          label: "General",
          items: ["Theme", "Notifications", "Export defaults", "Units", "Organisms"],
        },
        {
          label: "API Keys",
          items: ["Claude", "OpenAI", "Gemini", "Custom endpoints"],
        },
        {
          label: "Team & Security",
          items: ["Team management", "Permissions", "Security settings", "Databases"],
        },
      ]}
    />
  );
}
