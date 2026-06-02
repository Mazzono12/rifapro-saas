import React, { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, X, Check, PlaySquare } from "lucide-react";
import { ResponsiveMediaFrame } from "../../components/ResponsiveMediaFrame";
import { inferMediaType } from "../../utils/media";
import type { Story } from "../../types";
import { MediaPicker } from "../../components/admin/MediaPicker";

export function AdminStories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentStory, setCurrentStory] = useState<Partial<Story>>({});

  const loadStories = () => {
    fetch("/api/stories")
      .then(res => res.json())
      .then(setStories);
  };

  useEffect(() => {
    loadStories();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = currentStory.id ? "PUT" : "POST";
    const url = currentStory.id ? `/api/admin/stories/${currentStory.id}` : "/api/admin/stories";
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...currentStory,
        mediaType: currentStory.mediaUrl ? inferMediaType(currentStory.mediaUrl) : currentStory.mediaType,
        active: true,
        duration: currentStory.duration || 5,
      })
    });
    
    setIsEditing(false);
    setCurrentStory({});
    loadStories();
  };

  return (
    <div className="space-y-6 fade-in">
       <div className="flex justify-between items-center">
         <div>
            <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
               <PlaySquare className="w-8 h-8 text-neon-purple" /> Gerenciar Stories
            </h1>
         </div>
         <button 
           onClick={() => { setCurrentStory({}); setIsEditing(true); }}
           className="bg-neon-purple/20 hover:bg-neon-purple/30 text-neon-purple border border-neon-purple/50 px-4 py-2 rounded-lg font-mono text-xs tracking-wider flex items-center gap-2 transition-colors"
         >
           <Plus className="w-4 h-4" /> Novo Story
         </button>
       </div>

       {isEditing ? (
         <div className="glass-card p-6 rounded-2xl border border-neon-purple/30">
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
               <h2 className="text-xl font-bold">{currentStory.id ? 'Editar Story' : 'Criar Novo Story'}</h2>
               <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Título</label>
                    <input required type="text" className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-neon-purple/50" 
                           value={currentStory.title || ''} onChange={e => setCurrentStory({...currentStory, title: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <MediaPicker
                      label="Mídia do story"
                      mediaUsage="story"
                      value={currentStory.mediaUrl || ""}
                      mediaType={currentStory.mediaType}
                      required
                      onChange={(mediaUrl, mediaType) => setCurrentStory({ ...currentStory, mediaUrl, mediaType })}
                    />
                  </div>
               </div>
               <div className="flex justify-end pt-4">
                 <button type="submit" className="bg-neon-purple text-white px-6 py-3 rounded-lg font-bold font-mono tracking-wider flex items-center gap-2 hover:bg-white hover:text-black transition-colors">
                    <Check className="w-5 h-5" /> Salvar Story
                 </button>
               </div>
            </form>
         </div>
       ) : (
         <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {stories.map(s => (
               <div key={s.id} className="glass-card rounded-xl border border-white/5 overflow-hidden group">
                  <div className="aspect-[9/16] relative bg-cyber-900">
                     <ResponsiveMediaFrame src={s.mediaUrl} type={s.mediaType} alt={s.title} preferredFit="auto" aspectMode="story" className="h-full w-full rounded-none" autoPlay />
                     <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                     <div className="absolute bottom-0 inset-x-0 p-3">
                        <p className="text-xs font-bold text-white mb-2 truncate">{s.title}</p>
                        <div className="flex gap-2">
                           <button onClick={() => { setCurrentStory(s); setIsEditing(true); }} className="flex-1 bg-white/10 hover:bg-neon-purple/20 text-white rounded py-1 text-xs transition-colors flex justify-center"><Edit2 className="w-3 h-3" /></button>
                           <button onClick={async () => { await fetch(`/api/admin/stories/${s.id}`, {method: 'DELETE'}); loadStories(); }} className="p-1 bg-white/10 hover:bg-red-500/20 text-white rounded text-xs transition-colors"><Trash2 className="w-3 h-3" /></button>
                        </div>
                     </div>
                  </div>
               </div>
            ))}
         </div>
       )}
    </div>
  );
}
