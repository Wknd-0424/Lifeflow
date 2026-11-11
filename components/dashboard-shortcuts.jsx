import { HugeiconsIcon } from "@hugeicons/react";
import { Folder01Icon, FavouriteIcon, Note01Icon, ChartHistogramIcon } from "@hugeicons/core-free-icons";
import GlassIcons from "./ui/GlassIcons";

const shortcuts = [
  { page: "inventory", label: "Inventory", color: "red", icon: Folder01Icon },
  { page: "requests", label: "Requests", color: "pink", icon: FavouriteIcon },
  { page: "expiry", label: "Expiry", color: "orange", icon: Note01Icon },
  { page: "reports", label: "Reports", color: "teal", icon: ChartHistogramIcon },
];

export function DashboardShortcuts() {
  return (
    <GlassIcons
      items={shortcuts.map(({ page, label, color, icon }) => ({
        id: page,
        label,
        color,
        icon: <HugeiconsIcon icon={icon} />,
        onClick: () => document.querySelector(`.command-nav [data-page="${page}"]`)?.click(),
      }))}
      size={48}
      gap={16}
      columns={4}
      labels="always"
      theme="dark"
    />
  );
}
