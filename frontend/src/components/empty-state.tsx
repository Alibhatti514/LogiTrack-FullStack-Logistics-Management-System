import { Package } from "lucide-react";
export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="empty-state">
      <Package size={28} />
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}
