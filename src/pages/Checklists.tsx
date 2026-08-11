import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, CheckCircle2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { fetchPlatformChecklists, savePlatformChecklists, TeamChecklist, ChecklistItem } from "@/lib/checklist-storage";

export type { ChecklistItem, TeamChecklist };

export function Checklists({ role }: { role: string }) {
  const [checklists, setChecklists] = useState<TeamChecklist[]>([]);
  const [activeTeam, setActiveTeam] = useState<string>("HP-APJ");
  const [newItemText, setNewItemText] = useState("");
  const [newItemStage, setNewItemStage] = useState<number>(0);
  const [newItemRequiresInput, setNewItemRequiresInput] = useState(false);
  const [newItemPlaceholder, setNewItemPlaceholder] = useState("");
  const [teams, setTeams] = useState<string[]>(["HP-APJ", "HP-EMEA", "HP-AMS"]);

  useEffect(() => {
    const isDb = isSupabaseConfigured();

    const fetchTeams = async () => {
      if (isDb) {
        const { data } = await supabase.from('teams').select('*').order('created_at', { ascending: true });
        if (data && data.length > 0) {
          const teamNames = data.map(t => t.name);
          setTeams(teamNames);
          if (!teamNames.includes(activeTeam)) {
            setActiveTeam(teamNames[0]);
          }
        }
      }
    };
    fetchTeams();

    const loadChecklists = async () => {
      const data = await fetchPlatformChecklists();
      setChecklists(data);
    };

    loadChecklists();
  }, []);

  const saveChecklists = async (newChecklists: TeamChecklist[]) => {
    setChecklists(newChecklists);
    await savePlatformChecklists(newChecklists);
  };

  const activeChecklist = checklists.find(c => c.team === activeTeam) || { team: activeTeam, items: [] };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    
    const newItem = { id: Date.now().toString(), text: newItemText.trim(), stage: newItemStage, requiresInput: newItemRequiresInput, inputPlaceholder: newItemPlaceholder };
    const newChecklists = [...checklists];
    const teamIndex = newChecklists.findIndex(c => c.team === activeTeam);
    
    if (teamIndex >= 0) {
      newChecklists[teamIndex].items.push(newItem);
    } else {
      newChecklists.push({ team: activeTeam, items: [newItem] });
    }
    
    saveChecklists(newChecklists);
    setNewItemText("");
    setNewItemRequiresInput(false);
    setNewItemPlaceholder("");
  };

  
  const moveItemUp = (index: number) => {
    if (index === 0) return;
    const newChecklists = [...checklists];
    const teamIndex = newChecklists.findIndex(c => c.team === activeTeam);
    if (teamIndex >= 0) {
      const items = newChecklists[teamIndex].items;
      const temp = items[index - 1];
      items[index - 1] = items[index];
      items[index] = temp;
      saveChecklists(newChecklists);
    }
  };


  const moveItemDown = (index: number) => {
    const newChecklists = [...checklists];
    const teamIndex = newChecklists.findIndex(c => c.team === activeTeam);
    if (teamIndex >= 0) {
      const items = newChecklists[teamIndex].items;
      if (index === items.length - 1) return;
      const temp = items[index + 1];
      items[index + 1] = items[index];
      items[index] = temp;
      saveChecklists(newChecklists);
    }
  };

  
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const handleChangeStage = (id: string, newStage: number) => {
    const newChecklists = checklists.map(c => {
      if (c.team === activeTeam) {
        return { 
          ...c, 
          items: c.items.map(item => item.id === id ? { ...item, stage: newStage } : item) 
        };
      }
      return c;
    });
    saveChecklists(newChecklists);
  };

  const handleDeleteItem = (id: string) => {
    const newChecklists = checklists.map(c => {
      if (c.team === activeTeam) {
        return { ...c, items: c.items.filter(item => item.id !== id) };
      }
      return c;
    });
    saveChecklists(newChecklists);
    setDeletingItemId(null);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Checklists</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage campaign review checkpoints for different teams.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-64 flex flex-col gap-2">
          {teams.map(team => (
            <button
              key={team}
              onClick={() => setActiveTeam(team)}
              className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTeam === team ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {team} Checkpoints
            </button>
          ))}
        </div>

        <Card className="flex-1 shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle>{activeTeam} Checkpoints</CardTitle>
            <CardDescription>Points to verify during campaign review for {activeTeam}</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
                        <form onSubmit={handleAddItem} className="flex flex-col gap-3 border p-4 rounded-md border-slate-200">
              <div className="flex gap-3">
                <Input 
                  placeholder="New checkpoint text..." 
                  value={newItemText}
                  onChange={e => setNewItemText(e.target.value)}
                  className="flex-1"
                />
                <select
                  className="border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newItemStage}
                  onChange={e => setNewItemStage(Number(e.target.value))}
                >
                  <option value={0}>All Stages</option>
                  <option value={1}>Step 1: Details</option>
                  <option value={2}>Step 2: Comparison</option>
                  <option value={3}>Step 3: Tags</option>
                  <option value={4}>Step 4: Links</option>
                  <option value={5}>Step 5: Grammar</option>
                  <option value={6}>Step 6: Review</option>
                  <option value={7}>Step 7: Checklist (Final)</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={newItemRequiresInput} onChange={e => setNewItemRequiresInput(e.target.checked)} className="rounded text-indigo-600" />
                  Requires Text Input
                </label>
                {newItemRequiresInput && (
                  <Input 
                    placeholder="Input placeholder (e.g., Enter Campaign Name)" 
                    value={newItemPlaceholder}
                    onChange={e => setNewItemPlaceholder(e.target.value)}
                    className="flex-1"
                  />
                )}
                <Button type="submit" className="gap-2 ml-auto">
                  <Plus className="w-4 h-4" /> Add Point
                </Button>
              </div>
            </form>

            <div className="space-y-3">
              {activeChecklist.items.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  No checkpoints defined for {activeTeam}.
                </div>
              ) : (
                activeChecklist.items.map((item, index) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg group flex-col sm:flex-row">
                    <div className="flex flex-1 gap-3 items-start w-full">
                      <CheckCircle2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-1 flex-1">
                        <span className="text-sm text-slate-700 leading-relaxed">{item.text}</span>
                        <select
                          className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 border-none outline-none px-2 py-0.5 rounded-sm self-start cursor-pointer hover:bg-slate-200"
                          value={item.stage === undefined ? 0 : item.stage}
                          onChange={(e) => handleChangeStage(item.id, Number(e.target.value))}
                        >
                          <option value={0}>All Stages</option>
                          <option value={1}>Step 1: Details</option>
                          <option value={2}>Step 2: Comparison</option>
                          <option value={3}>Step 3: Tags</option>
                          <option value={4}>Step 4: Links</option>
                          <option value={5}>Step 5: Grammar</option>
                          <option value={6}>Step 6: Review</option>
                          <option value={7}>Step 7: Checklist</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-row items-center gap-1 self-end sm:self-auto">
                      {deletingItemId === item.id ? (
                        <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 p-1 rounded-md">
                          <span className="text-[11px] font-bold text-rose-700 px-1">Delete?</span>
                          <Button 
                            type="button" 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => handleDeleteItem(item.id)}
                            className="h-6 px-2 text-[11px] font-bold bg-rose-600 hover:bg-rose-700"
                          >
                            Confirm
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setDeletingItemId(null)}
                            className="h-6 px-2 text-[11px] font-semibold"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="icon" 
                            onClick={() => moveItemUp(index)}
                            disabled={index === 0}
                            className="h-7 w-7 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                            title="Move Up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="icon" 
                            onClick={() => moveItemDown(index)}
                            disabled={index === activeChecklist.items.length - 1}
                            className="h-7 w-7 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                            title="Move Down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDeletingItemId(item.id)}
                            className="h-7 w-7 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                            title="Delete Checkpoint"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
