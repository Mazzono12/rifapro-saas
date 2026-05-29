import { ArrowDown, ArrowUp, Eye, Save, Send } from "lucide-react";
import { ColorPicker } from "./ColorPicker";

const blockLabels: Record<string, string> = {
  hero: "Hero",
  banner: "Banner",
  video: "Video",
  premio_principal: "Premio principal",
  premios_extras: "Premios extras",
  pacotes_cotas: "Pacotes de cotas",
  roletas: "Roletas",
  caixinhas: "Caixinhas",
  raspadinhas: "Raspadinhas",
  ranking: "Ranking",
  prova_social: "Prova social",
  faq: "FAQ",
  regulamento: "Regulamento",
  rodape: "Rodape"
};

function moveBlock(blocks: any[], index: number, direction: -1 | 1) {
  const next = [...blocks];
  const target = index + direction;
  if (target < 0 || target >= next.length) return blocks;
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((block, order) => ({ ...block, order }));
}

export function ThemeBuilder({
  data,
  onChange,
  onSave,
  onPublish
}: {
  data: any;
  onChange: (value: any) => void;
  onSave: () => void;
  onPublish: () => void;
}) {
  const template = data?.template || {};
  const settings = template.settings || {};
  const colors = settings.colors || {};
  const blocks = [...(settings.blocks || [])].sort((a, b) => Number(a.order) - Number(b.order));
  const marketplace = data?.marketplace || [];

  const patchTemplate = (patch: any) => onChange({ ...data, template: { ...template, ...patch } });
  const patchSettings = (patch: any) => patchTemplate({ settings: { ...settings, ...patch } });
  const patchBlock = (id: string, patch: any) => patchSettings({ blocks: blocks.map(block => block.id === id ? { ...block, ...patch } : block) });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="premium-card grid gap-5 p-5">
        <div>
          <h2 className="text-xl font-black text-white">Construtor visual</h2>
          <p className="mt-1 text-sm text-slate-400">Ative blocos, ordene secoes, troque textos, cores e midias sem codigo.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-300">Tema do marketplace
            <select value={template.theme_key || "premium-dark"} onChange={event => patchTemplate({ theme_key: event.target.value })} className="admin-input">
              {marketplace.map((theme: any) => <option key={theme.key} value={theme.key}>{theme.name}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-300">Nome do tema
            <input value={template.name || ""} onChange={event => patchTemplate({ name: event.target.value })} className="admin-input" />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <ColorPicker label="Primaria" value={colors.primary || "#00d66b"} onChange={primary => patchSettings({ colors: { ...colors, primary } })} />
          <ColorPicker label="Secundaria" value={colors.secondary || "#0f2d1d"} onChange={secondary => patchSettings({ colors: { ...colors, secondary } })} />
          <ColorPicker label="CTA" value={colors.cta || "#00d66b"} onChange={cta => patchSettings({ colors: { ...colors, cta } })} />
          <ColorPicker label="Fundo" value={colors.background || "#050807"} onChange={background => patchSettings({ colors: { ...colors, background } })} />
        </div>

        <div className="grid gap-3">
          {blocks.map((block, index) => (
            <div key={block.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-bold text-white">
                  <input type="checkbox" checked={block.enabled !== false} onChange={event => patchBlock(block.id, { enabled: event.target.checked })} />
                  {blockLabels[block.id] || block.id}
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => patchSettings({ blocks: moveBlock(blocks, index, -1) })} className="admin-icon-button" title="Subir bloco"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => patchSettings({ blocks: moveBlock(blocks, index, 1) })} className="admin-icon-button" title="Descer bloco"><ArrowDown className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input value={block.title || ""} onChange={event => patchBlock(block.id, { title: event.target.value })} placeholder="Titulo" className="admin-input" />
                <input value={block.subtitle || ""} onChange={event => patchBlock(block.id, { subtitle: event.target.value })} placeholder="Subtitulo" className="admin-input" />
                <input value={block.imageUrl || ""} onChange={event => patchBlock(block.id, { imageUrl: event.target.value })} placeholder="URL da imagem" className="admin-input" />
                <input value={block.videoUrl || ""} onChange={event => patchBlock(block.id, { videoUrl: event.target.value })} placeholder="URL do video" className="admin-input" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onSave} className="premium-button rounded-xl px-5 py-3"><Save className="h-4 w-4" /> Salvar</button>
          <button type="button" onClick={onPublish} className="premium-button rounded-xl px-5 py-3"><Send className="h-4 w-4" /> Publicar</button>
        </div>
      </div>

      <div className="premium-card p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase text-emerald-200"><Eye className="h-4 w-4" /> Preview</div>
        <div className="overflow-hidden rounded-2xl border border-white/10" style={{ background: colors.background || "#050807" }}>
          {blocks.filter(block => block.enabled !== false).slice(0, 7).map(block => (
            <section key={block.id} className="border-b border-white/10 p-4">
              <p className="text-xs font-black uppercase" style={{ color: colors.primary || "#00d66b" }}>{blockLabels[block.id] || block.id}</p>
              <h3 className="mt-1 text-lg font-black text-white">{block.title || blockLabels[block.id]}</h3>
              <p className="mt-1 text-sm text-slate-300">{block.subtitle || "Conteudo configuravel do tenant."}</p>
              {block.imageUrl && <div className="mt-3 h-24 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url(${block.imageUrl})` }} />}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
