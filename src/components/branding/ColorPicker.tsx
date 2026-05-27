export function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-300">
      {label}
      <div className="flex items-center gap-3">
        <input type="color" value={value || "#00d66b"} onChange={event => onChange(event.target.value)} className="h-11 w-14 rounded-xl border border-white/10 bg-transparent p-1" />
        <input value={value || ""} onChange={event => onChange(event.target.value)} className="admin-input w-full" placeholder="#00d66b" />
      </div>
    </label>
  );
}
