import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface ChecklistItem {
  id: string;
  text: string;
  stage?: number;
  requiresInput?: boolean;
  inputPlaceholder?: string;
  description?: string;
}

export interface TeamChecklist {
  team: string;
  items: ChecklistItem[];
}

export const DEFAULT_PLATFORM_CHECKLISTS: TeamChecklist[] = [
  {
    team: "HP-APJ",
    items: [
      { id: "1", text: "Verify APJ specific legal compliance", stage: 0 },
      { id: "2", text: "Check translations for APAC regions", stage: 0 }
    ]
  },
  {
    team: "HP-EMEA",
    items: [
      { id: "3", text: "Ensure GDPR compliance points are met", stage: 0 },
      { id: "4", text: "Verify EMEA pricing formats", stage: 0 }
    ]
  },
  {
    team: "HP-AMS",
    items: [
      { id: "5", text: "Verify FTC and disclaimers for North America", stage: 0 },
      { id: "6", text: "Check French-Canadian translation if CA", stage: 0 }
    ]
  }
];

/**
 * Fetches platform master checklists across all teams.
 * Synchronizes between Supabase 'checklists' table and LocalStorage 'platform_checklists'.
 */
export async function fetchPlatformChecklists(): Promise<TeamChecklist[]> {
  const isDb = isSupabaseConfigured();

  if (isDb) {
    try {
      const { data, error } = await supabase.from('checklists').select('*');
      if (!error && data && data.length > 0) {
        const loaded: TeamChecklist[] = data.map((row: any) => ({
          team: row.team,
          items: Array.isArray(row.items) ? row.items : []
        }));

        // Merge with any offline items stored locally if available
        let localChecklists: TeamChecklist[] = [];
        try {
          const stored = localStorage.getItem("platform_checklists");
          if (stored) localChecklists = JSON.parse(stored);
        } catch (e) {}

        const finalMap = new Map<string, TeamChecklist>();
        // Add DB records first
        loaded.forEach(tc => finalMap.set(tc.team, tc));

        // If local storage has extra teams or items not in DB, merge and update DB
        let needsDbSync = false;
        for (const localTc of localChecklists) {
          if (!finalMap.has(localTc.team)) {
            finalMap.set(localTc.team, localTc);
            needsDbSync = true;
          } else {
            const dbTc = finalMap.get(localTc.team)!;
            // If local has more items or modified items, merge items by ID
            const itemMap = new Map<string, ChecklistItem>();
            dbTc.items.forEach(item => itemMap.set(item.id, item));
            localTc.items.forEach(item => {
              if (!itemMap.has(item.id)) {
                itemMap.set(item.id, item);
                needsDbSync = true;
              }
            });
            finalMap.set(localTc.team, {
              team: localTc.team,
              items: Array.from(itemMap.values())
            });
          }
        }

        const merged = Array.from(finalMap.values());
        localStorage.setItem("platform_checklists", JSON.stringify(merged));

        if (needsDbSync) {
          await savePlatformChecklists(merged);
        }

        return merged;
      }
    } catch (e) {
      console.warn("[ChecklistStorage] Error loading from Supabase:", e);
    }
  }

  // Fallback to local storage or defaults
  let result: TeamChecklist[] = DEFAULT_PLATFORM_CHECKLISTS;
  try {
    const stored = localStorage.getItem("platform_checklists");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        result = parsed;
      }
    }
  } catch (e) {
    console.error("[ChecklistStorage] Error parsing local platform_checklists:", e);
  }

  localStorage.setItem("platform_checklists", JSON.stringify(result));

  // If DB is configured but had no records, auto-seed DB with result
  if (isDb) {
    await savePlatformChecklists(result);
  }

  return result;
}

/**
 * Saves platform master checklists to LocalStorage and Supabase.
 */
export async function savePlatformChecklists(checklists: TeamChecklist[]): Promise<void> {
  try {
    localStorage.setItem("platform_checklists", JSON.stringify(checklists));
  } catch (e) {}

  if (isSupabaseConfigured()) {
    try {
      for (const teamObj of checklists) {
        await supabase.from('checklists').upsert({
          id: teamObj.team,
          team: teamObj.team,
          title: `${teamObj.team} Checklist`,
          items: teamObj.items,
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error("[ChecklistStorage] Failed to save checklists to Supabase:", e);
    }
  }
}
