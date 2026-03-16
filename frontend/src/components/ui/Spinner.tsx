export function Spinner({ className }: { className?: string }) {
  return (
    <div className={`inline-block w-5 h-5 border-2 border-purple-700 border-t-purple-400 rounded-full animate-spin ${className ?? ""}`} />
  );
}
