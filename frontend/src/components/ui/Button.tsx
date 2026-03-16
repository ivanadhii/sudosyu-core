import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
}

const variants = {
  primary: "bg-purple-700 hover:bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]",
  ghost: "bg-transparent hover:bg-white/5 text-gray-400 hover:text-white border border-transparent hover:border-purple-900/40",
  danger: "bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-700/40",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
