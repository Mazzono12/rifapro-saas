export function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">
      {label}
      <div className="flex items-center gap-3 rounded-[8px] border border-[var(--admin-border)] bg-white px-3 py-2">
        <input type="color" value={value || "#2563eb"} onChange={event => onChange(event.target.value)} className="h-10 w-12 rounded-[8px] border border-[var(--admin-border)] bg-white p-1" />
        <input value={value || ""} onChange={event => onChange(event.target.value)} className="admin-input min-h-10 flex-1" placeholder="#2563eb" />
      </div>
    </label>
  );
}