import { supabase } from "./supabase";

export async function logAction(userEmail: string, actionType: string, details: string, campaignId?: string) {
  const email = userEmail || 'unknown@example.com';
  const timestamp = new Date().toISOString();

  // Write to LocalStorage for instant fallback
  try {
    const existing = localStorage.getItem('local_activity_logs');
    const logs = existing ? JSON.parse(existing) : [];
    logs.unshift({
      id: Date.now().toString(),
      user_email: email,
      action_type: actionType,
      details: details,
      campaign_id: campaignId,
      created_at: timestamp
    });
    localStorage.setItem('local_activity_logs', JSON.stringify(logs.slice(0, 200)));
  } catch (e) {
    console.error("LocalStorage logging failed:", e);
  }

  // Write to Supabase
  try {
    await supabase.from('activity_logs').insert([{
      user_email: email,
      action_type: actionType,
      details: details,
      campaign_id: campaignId || null
    }]);
  } catch (err) {
    console.error("Failed to log action to Supabase:", err);
  }
}

export async function getCampaignLogs(campaignId?: string, campaignName?: string): Promise<any[]> {
  let combined: any[] = [];

  // 1. Fetch from Supabase
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      combined = [...data];
    }
  } catch (e) {
    console.error("Error fetching activity_logs from Supabase:", e);
  }

  // 2. Fetch from LocalStorage
  try {
    const localRaw = localStorage.getItem('local_activity_logs');
    if (localRaw) {
      const localLogs: any[] = JSON.parse(localRaw);
      localLogs.forEach(log => {
        if (!combined.some(c => c.id === log.id)) {
          combined.push(log);
        }
      });
    }
  } catch (e) {
    console.error("Error fetching local_activity_logs:", e);
  }

  // Filter logs relevant to campaign if campaignId or campaignName provided
  if (campaignId || campaignName) {
    const idStr = String(campaignId || "").toLowerCase();
    const nameStr = String(campaignName || "").toLowerCase();

    combined = combined.filter(log => {
      const details = String(log.details || "").toLowerCase();
      const type = String(log.action_type || "").toLowerCase();
      const logCampId = String(log.campaign_id || "").toLowerCase();

      if (idStr && (logCampId === idStr || details.includes(idStr))) return true;
      if (nameStr && details.includes(nameStr)) return true;
      return false;
    });
  }

  // Sort by created_at descending
  combined.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return combined;
}

