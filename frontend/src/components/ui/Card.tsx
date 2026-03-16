import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export function Card({ children, className, glow }: CardProps) {
  return (
    <div
      className={cn(
        "bg-[#111111] border border-purple-900/30 rounded-xl",
        glow && "shadow-[0_0_20px_rgba(168,85,247,0.1)]",
        className
      )}
    >
      {children}
    </div>
  );
}
