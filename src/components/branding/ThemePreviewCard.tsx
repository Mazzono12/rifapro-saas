export function ThemePreviewCard({ mode, active }: { mode: string; active?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${active ? "border-emerald-300 bg-emerald-300/10" : "border-white/10 bg-white/[0.04]"}`}>
      <p className="font-black capitalize text-white">{mode}</p>
      <div className="mt-3 h-2 rounded-full bg-[var(--tenant-cta)]" />
    </div>
  );
}
