import { Card } from "./Card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  percent?: number;
  className?: string;
}

export function StatCard({ label, value, sub, percent, className }: StatCardProps) {
  const color =
    percent === undefined ? "bg-purple-500"
    : percent > 90 ? "bg-red-500"
    : percent > 70 ? "bg-yellow-500"
    : "bg-purple-500";

  return (
    <Card className={cn("p-4", className)}>
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p className="text-white text-xl font-bold font-mono">{value}</p>
      {sub && <p className="text-gray-600 text-xs mt-0.5">{sub}</p>}
      {percent !== undefined && (
        <div className="mt-3 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", color)}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      )}
    </Card>
  );
}
