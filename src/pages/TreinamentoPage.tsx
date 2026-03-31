import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  video_url: string | null;
  video_uploaded_at: string | null;
  sort_order: number;
}

interface Rating {
  module_id: string;
  rating: number;
}

interface ProfileContact {
  id: string;
  name: string;
  cargo: string | null;
  facility_unit: string;
}

const TreinamentoPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [avgRatings, setAvgRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [editModule, setEditModule] = useState<TrainingModule | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [uploading, setUploading] = useState(false);
  const [playModule, setPlayModule] = useState<TrainingModule | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [contacts, setContacts] = useState<ProfileContact[]>([]);

  useEffect(() => {
    fetchModules();
    fetchContacts();
    if (user) {
      checkAdmin();
      fetchMyRatings();
    }
  }, [user]);

  const fetchContacts = async () => {
    const { data } = await supabase.from("profiles").select("id, name, cargo, facility_unit");
    if (data) setContacts(data as ProfileContact[]);
  };

  const checkAdmin = async () => {
    if (!user) return;
    const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    setIsAdmin(!!data);
  };

  const fetchModules = async () => {
    const { data } = await supabase
      .from("training_modules")
      .select("*")
      .order("sort_order");
    if (data) {
      setModules(data as TrainingModule[]);
      fetchAllRatings(data.map((m: any) => m.id));
    }
  };

  const fetchMyRatings = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("training_ratings")
      .select("module_id, rating")
      .eq("user_id", user.id);
    if (data) {
      const map: Record<string, number> = {};
      (data as Rating[]).forEach(r => { map[r.module_id] = r.rating; });
      setRatings(map);
    }
  };

  const fetchAllRatings = async (moduleIds: string[]) => {
    const { data } = await supabase
      .from("training_ratings")
      .select("module_id, rating");
    if (data) {
      const map: Record<string, { total: number; count: number }> = {};
      (data as Rating[]).forEach(r => {
        if (!map[r.module_id]) map[r.module_id] = { total: 0, count: 0 };
        map[r.module_id].total += r.rating;
        map[r.module_id].count += 1;
      });
      const avgMap: Record<string, { avg: number; count: number }> = {};
      Object.entries(map).forEach(([id, v]) => {
        avgMap[id] = { avg: v.total / v.count, count: v.count };
      });
      setAvgRatings(avgMap);
    }
  };

  const handleRate = async (moduleId: string, rating: number) => {
    if (!user) return;
    const existing = ratings[moduleId];
    if (existing) {
      await supabase
        .from("training_ratings")
        .update({ rating })
        .eq("module_id", moduleId)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("training_ratings")
        .insert({ module_id: moduleId, user_id: user.id, rating });
    }
    setRatings(prev => ({ ...prev, [moduleId]: rating }));
    fetchAllRatings(modules.map(m => m.id));
  };

  const openEdit = (mod: TrainingModule) => {
    setEditModule(mod);
    setEditTitle(mod.title);
    setEditDesc(mod.description);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editModule) return;
    await supabase
      .from("training_modules")
      .update({ title: editTitle, description: editDesc })
      .eq("id", editModule.id);
    toast.success("Módulo atualizado");
    setEditOpen(false);
    fetchModules();
  };

  const handleVideoUpload = async (moduleId: string, file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${moduleId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("training-videos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro ao enviar vídeo");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("training-videos")
      .getPublicUrl(path);

    await supabase
      .from("training_modules")
      .update({ video_url: urlData.publicUrl, video_uploaded_at: new Date().toISOString() } as any)
      .eq("id", moduleId);

    toast.success("Vídeo enviado com sucesso");
    setUploading(false);
    fetchModules();
    // Update edit module in modal
    if (editModule?.id === moduleId) {
      setEditModule(prev => prev ? { ...prev, video_url: urlData.publicUrl, video_uploaded_at: new Date().toISOString() } : null);
    }
  };

  const handleVideoDelete = async (moduleId: string) => {
    // Try to remove from storage (ignore errors if file doesn't exist)
    await supabase.storage.from("training-videos").remove([`${moduleId}.mp4`, `${moduleId}.webm`, `${moduleId}.mov`]);

    await supabase
      .from("training_modules")
      .update({ video_url: null, video_uploaded_at: null } as any)
      .eq("id", moduleId);

    toast.success("Vídeo removido");
    fetchModules();
    if (editModule?.id === moduleId) {
      setEditModule(prev => prev ? { ...prev, video_url: null, video_uploaded_at: null } : null);
    }
  };

  const HeartRating = ({ moduleId }: { moduleId: string }) => {
    const myRating = ratings[moduleId] || 0;
    const [hover, setHover] = useState(0);

    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => handleRate(moduleId, i)}
            className="transition-transform hover:scale-125"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="h-5 w-5 transition-colors"
              fill={(hover || myRating) >= i ? "hsl(var(--primary))" : "none"}
              stroke={(hover || myRating) >= i ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
              strokeWidth={2}
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
        ))}
        {avgRatings[moduleId] && (
          <span className="ml-2 text-[10px] text-muted-foreground">
            {avgRatings[moduleId].avg.toFixed(1)} ({avgRatings[moduleId].count})
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          ← Voltar
        </Button>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Treinamento do Sistema</h1>
            <p className="text-sm text-muted-foreground">Guia completo dos módulos — assista aos vídeos e avalie com corações</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Input
              placeholder="Buscar módulo ou pessoa..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchActive(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") setSearchActive(true); }}
              className="w-56"
            />
            {searchQuery ? (
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => { setSearchQuery(""); setSearchActive(false); }}>
                ✕
              </Button>
            ) : (
              <Button className="rounded-full" size="sm" onClick={() => setSearchActive(true)}>
                Buscar
              </Button>
            )}
          </div>
        </div>

        {/* Search results - contacts */}
        {searchActive && searchQuery.trim() && (() => {
          const q = searchQuery.trim().toLowerCase();
          const filteredModules = modules.filter(m => m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
          const noModuleMatch = filteredModules.length === 0;
          const matchedContacts = contacts.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.cargo?.toLowerCase().includes(q)) ||
            c.facility_unit.toLowerCase().includes(q)
          );

          if (!noModuleMatch) return null;

          return (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="kpi-card mb-6">
              <p className="text-sm font-medium text-foreground mb-1">Nenhum módulo encontrado para "{searchQuery}"</p>
              <p className="text-xs text-muted-foreground mb-3">Entre em contato com alguém da equipe para tirar dúvidas:</p>
              {matchedContacts.length > 0 ? (
                <div className="space-y-2">
                  {matchedContacts.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.cargo || "Sem cargo"} • {c.facility_unit}</p>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={`mailto:${c.name.toLowerCase().replace(/\s/g, ".")}@moss.org?subject=Dúvida sobre ${searchQuery}`}
                          className="px-3 py-1.5 text-xs rounded-full bg-primary text-primary-foreground hover:brightness-110 transition"
                        >
                          Email
                        </a>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`Olá ${c.name}, tenho uma dúvida sobre: ${searchQuery}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 text-xs rounded-full bg-[hsl(142_71%_45%)] text-white hover:brightness-110 transition"
                        >
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Nenhum contato encontrado. Veja todos os contatos disponíveis:</p>
                  {contacts.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.cargo || "Sem cargo"} • {c.facility_unit}</p>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={`mailto:${c.name.toLowerCase().replace(/\s/g, ".")}@moss.org?subject=Dúvida sobre ${searchQuery}`}
                          className="px-3 py-1.5 text-xs rounded-full bg-primary text-primary-foreground hover:brightness-110 transition"
                        >
                          Email
                        </a>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`Olá ${c.name}, tenho uma dúvida sobre: ${searchQuery}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 text-xs rounded-full bg-[hsl(142_71%_45%)] text-white hover:brightness-110 transition"
                        >
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(searchActive && searchQuery.trim()
            ? modules.filter(m => m.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) || m.description.toLowerCase().includes(searchQuery.trim().toLowerCase()))
            : modules
          ).map((mod, i) => (
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="kpi-card flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h2 className="text-sm font-bold text-foreground">{mod.title}</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">{mod.description}</p>
                </div>
                {isAdmin && (
                  <Button variant="outline" size="sm" className="rounded-full text-[10px] shrink-0" onClick={() => openEdit(mod)}>
                    Editar
                  </Button>
                )}
              </div>

              {/* Video area */}
              {mod.video_url ? (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setPlayModule(mod)}
                    className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center hover:bg-muted/70 transition-colors border border-border"
                  >
                    <span className="text-2xl">▶</span>
                  </button>
                  {mod.video_uploaded_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Enviado em {new Date(mod.video_uploaded_at).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
              ) : (
                <div className="w-full aspect-video bg-muted/50 rounded-lg flex items-center justify-center border border-dashed border-border">
                  <span className="text-xs text-muted-foreground">Sem vídeo</span>
                </div>
              )}

              {/* Heart rating */}
              <HeartRating moduleId={mod.id} />
            </motion.div>
          ))}
        </div>
      </main>

      {/* Edit modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Editar módulo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4} />
            </div>

            {/* Video management */}
            <div className="space-y-2">
              <Label>Vídeo</Label>
              {editModule?.video_url ? (
                <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-foreground font-medium">Vídeo anexado ✓</p>
                      {editModule.video_uploaded_at && (
                        <p className="text-[10px] text-muted-foreground">
                          Enviado em {new Date(editModule.video_uploaded_at).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-full text-[10px] h-7"
                      onClick={() => editModule && handleVideoDelete(editModule.id)}
                    >
                      Remover vídeo
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-muted/30 rounded-lg border border-dashed border-border">
                  <p className="text-xs text-muted-foreground mb-2">Nenhum vídeo anexado</p>
                  <label className="cursor-pointer">
                    <span className="px-3 py-1.5 text-xs rounded-full bg-primary text-primary-foreground hover:brightness-110 transition inline-block">
                      {uploading ? "Enviando..." : "Enviar vídeo"}
                    </span>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && editModule) handleVideoUpload(editModule.id, file);
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSaveEdit}>Salvar</Button>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video player modal */}
      <Dialog open={!!playModule} onOpenChange={() => setPlayModule(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="font-display">{playModule?.title}</DialogTitle>
          </DialogHeader>
          {playModule?.video_url && (
            <div className="p-4 pt-2">
              <video
                src={playModule.video_url}
                controls
                autoPlay
                className="w-full rounded-lg"
                style={{ maxHeight: "70vh" }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TreinamentoPage;
