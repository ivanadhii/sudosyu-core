import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "purple" | "green" | "red" | "yellow" | "gray";
  className?: string;
}

const variants = {
  purple: "bg-purple-900/30 text-purple-400 border border-purple-700/40",
  green: "bg-green-900/30 text-green-400 border border-green-700/40",
  red: "bg-red-900/30 text-red-400 border border-red-700/40",
  yellow: "bg-yellow-900/30 text-yellow-400 border border-yellow-700/40",
  gray: "bg-gray-800 text-gray-400 border border-gray-700/40",
};

export function Badge({ children, variant = "gray", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}
