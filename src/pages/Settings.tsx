import React, { useState, useEffect, useRef } from "react";
import { User, Globe, Save, Plus, Pencil, Trash2, Users, Upload, AlertTriangle, Settings as SettingsIcon, Database, CloudUpload, Server, CheckCircle2, AlertCircle, RefreshCw, Zap, Lock, KeyRound, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { logAction } from "@/lib/logger";
import { Image as ImageIcon } from "lucide-react";
import { getAllCampaigns, syncAllCampaignsToDatabase, processOfflineSyncQueue } from "@/lib/campaign-storage";

const defaultCountries: any[] = [];
const defaultTeams: any[] = [];

export function Settings({ role, userEmail }: { role: string; userEmail?: string }) {

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile State
  const [profile, setProfile] = useState({
    name: role === "admin" ? "Admin User" : "QA User",
    email: userEmail || (role === "admin" ? "admin@hp.com" : "hpapjteam@gmail.com"),
    team: "HP-APJ",
    avatar: ""
  });
  
  // All users for quick login management and team members
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Password Change State
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordStatusMsg, setPasswordStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatusMsg(null);

    if (passwordForm.newPassword.length < 6) {
      setPasswordStatusMsg({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatusMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.from('app_users').update({
        password_hash: passwordForm.newPassword,
        updated_at: new Date().toISOString()
      }).eq('email', profile.email);

      try {
        await supabase.auth.updateUser({ password: passwordForm.newPassword });
      } catch (e) {}

      await logAction(profile.email, "Change Password", "User changed account password");
      setPasswordStatusMsg({ type: 'success', text: 'Password updated successfully!' });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      setPasswordStatusMsg({ type: 'error', text: 'Error changing password: ' + (err.message || 'Unknown error') });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Countries State
  const [countries, setCountries] = useState(defaultCountries);
  const [isEditingCountry, setIsEditingCountry] = useState<string | null>(null);
  const [isCreatingNewCountry, setIsCreatingNewCountry] = useState(false);
  const [countryForm, setCountryForm] = useState({ name: "", code: "", url: "" });

  // Teams State
  const [teams, setTeams] = useState(defaultTeams);
  const [logs, setLogs] = useState<any[]>([]);
  const [teamForm, setTeamForm] = useState({ name: "" });
  const [logos, setLogos] = useState({ expanded: "https://zetaglobal.com/wp-content/uploads/2023/02/zeta_logoPrimary.svg", collapsed: "https://companieslogo.com/img/orig/ZETA-424536bc.png" });
  const [activeTab, setActiveTab] = useState("profile");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>("All");

  const [isMigratingDb, setIsMigratingDb] = useState(false);
  const [migrationStatusMsg, setMigrationStatusMsg] = useState<string | null>(null);

  const [quickLoginEnabled, setQuickLoginEnabled] = useState(() => {
    return localStorage.getItem("quick_login_enabled") !== "false";
  });

  const toggleQuickLogin = (enabled: boolean) => {
    setQuickLoginEnabled(enabled);
    localStorage.setItem("quick_login_enabled", String(enabled));
    logAction(profile.email || "cbogineni@zetaglobal.com", "Toggle Quick Login", `One-Click Quick Login ${enabled ? "Enabled" : "Disabled"}`);
  };

  const toggleUserQuickLogin = async (userId: string) => {
    const updated = allUsers.map(u => {
      if (u.id === userId || u.email === userId) {
        const currentlyEnabled = u.quick_login_enabled === true || u.quick_login_enabled === 'true';
        return { ...u, quick_login_enabled: !currentlyEnabled };
      }
      return u;
    });
    setAllUsers(updated);
    localStorage.setItem("local_app_users", JSON.stringify(updated));

    const targetUser = updated.find(u => u.id === userId || u.email === userId);
    if (targetUser) {
      if (isSupabaseConfigured()) {
        try {
          const { error } = await supabase.from('app_users').upsert({
            email: targetUser.email.trim().toLowerCase(),
            name: targetUser.name || targetUser.email.split('@')[0],
            role: targetUser.role || 'user',
            team: targetUser.team || 'HP-APJ',
            status: targetUser.status || 'active',
            quick_login_enabled: targetUser.quick_login_enabled
          }, { onConflict: 'email' });

          if (error && (error.message?.includes('quick_login_enabled') || error.message?.includes('schema cache'))) {
            await supabase.from('app_users').upsert({
              email: targetUser.email.trim().toLowerCase(),
              name: targetUser.name || targetUser.email.split('@')[0],
              role: targetUser.role || 'user',
              team: targetUser.team || 'HP-APJ',
              status: targetUser.status || 'active'
            }, { onConflict: 'email' });
          }
        } catch (e) {
          console.warn("Supabase update error:", e);
        }
      }
      await logAction(profile.email || "admin@hp.com", "Toggle User Quick Login", `Quick Login for ${targetUser.email} set to ${targetUser.quick_login_enabled ? 'Enabled' : 'Disabled'}`);
    }
  };

  const isRealSupabase = Boolean(
    import.meta.env.VITE_SUPABASE_URL && 
    import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co'
  );

  const handleFullDataMigration = async () => {
    setIsMigratingDb(true);
    setMigrationStatusMsg("Gathering all local campaign records...");
    try {
      const campaigns = await getAllCampaigns();
      setMigrationStatusMsg(`Syncing ${campaigns.length} campaign(s) to Supabase database...`);
      const count = await syncAllCampaignsToDatabase(campaigns);
      await processOfflineSyncQueue();
      setMigrationStatusMsg(`Successfully synced ${count} campaign(s) to Supabase database!`);
    } catch (err: any) {
      setMigrationStatusMsg(`Migration error: ${err.message || err}`);
    } finally {
      setIsMigratingDb(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      const key = userEmail ? "settings_profile_" + userEmail : "settings_profile_" + role;
      const savedProfile = localStorage.getItem(key) || localStorage.getItem("settings_profile_" + role);
      if (savedProfile) {
        try {
          setProfile(JSON.parse(savedProfile));
        } catch (e) {}
      }
      
      const { data: cData } = await supabase.from('countries').select('*').order('created_at', { ascending: true });
      if (cData) setCountries(cData);
      
      const { data: tData } = await supabase.from('teams').select('*').order('created_at', { ascending: true });
      if (tData) setTeams(tData);

      const { data: sData } = await supabase.from('app_settings').select('*').limit(1).single();

      const { data: lData } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50);
      if (lData) setLogs(lData);

      if (sData) {
        setLogos({ expanded: sData.expanded_logo_url || "", collapsed: sData.collapsed_logo_url || "" });
      }

      // Load Users for Quick Login & Team overview
      let dbUsers: any[] = [];
      if (isSupabaseConfigured()) {
        try {
          const { data: uData } = await supabase.from('app_users').select('*').neq('status', 'banned');
          if (uData) dbUsers = uData;
        } catch (e) {}
      }

      let localUsers: any[] = [];
      const cachedUsers = localStorage.getItem("local_app_users");
      if (cachedUsers) {
        try { localUsers = JSON.parse(cachedUsers); } catch (e) {}
      }

      const userMap = new Map<string, any>();
      for (const u of localUsers) {
        if (u.email) {
          const key = u.email.trim().toLowerCase();
          userMap.set(key, { ...u, email: key });
        }
      }
      for (const u of dbUsers) {
        if (u.email) {
          const key = u.email.trim().toLowerCase();
          const local = userMap.get(key) || {};
          const localQuick = local.quick_login_enabled === true || local.quick_login_enabled === 'true' || local.quick_login_enabled === 1;
          const dbQuick = u.quick_login_enabled === true || u.quick_login_enabled === 'true' || u.quick_login_enabled === 1;
          const isQuick = local.hasOwnProperty('quick_login_enabled') ? localQuick : (localQuick || dbQuick);
          userMap.set(key, { ...local, ...u, email: key, quick_login_enabled: isQuick });
        }
      }

      const combined = Array.from(userMap.values());
      setAllUsers(combined);
    }
    loadData();
  }, [role, userEmail]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newAvatar = reader.result as string;
        const updatedProfile = { ...profile, avatar: newAvatar };
        setProfile(updatedProfile);
        
        // Auto-save picture immediately
        const key = userEmail ? "settings_profile_" + userEmail : "settings_profile_" + role;
        localStorage.setItem(key, JSON.stringify(updatedProfile));
        localStorage.setItem("settings_profile_" + role, JSON.stringify(updatedProfile));
        window.dispatchEvent(new Event("profile_updated"));
        setSavedSuccessMsg("Profile picture uploaded and updated successfully!");
        setTimeout(() => setSavedSuccessMsg(null), 3000);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const key = userEmail ? "settings_profile_" + userEmail : "settings_profile_" + role;
    localStorage.setItem(key, JSON.stringify(profile));
    localStorage.setItem("settings_profile_" + role, JSON.stringify(profile));

    // Update local_app_users array
    const cachedUsers = localStorage.getItem("local_app_users");
    if (cachedUsers) {
      try {
        const parsed = JSON.parse(cachedUsers);
        const updated = parsed.map((u: any) => {
          if (u.email === profile.email || u.email === userEmail) {
            return { ...u, name: profile.name, team: profile.team, avatar: profile.avatar };
          }
          return u;
        });
        localStorage.setItem("local_app_users", JSON.stringify(updated));
      } catch (err) {}
    }

    window.dispatchEvent(new Event("profile_updated"));
    setSavedSuccessMsg("Profile & Team preferences saved successfully!");
    setTimeout(() => setSavedSuccessMsg(null), 3000);
  };

  const [countryFormError, setCountryFormError] = useState<string | null>(null);
  
  const handleCountrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Duplicate check
    const duplicate = countries.find(c => 
      c.id !== isEditingCountry && 
      (
        (c.name.toLowerCase() === countryForm.name.toLowerCase() && c.code.toLowerCase() === countryForm.code.toLowerCase()) ||
        c.url.toLowerCase() === countryForm.url.toLowerCase()
      )
    );

    if (duplicate) {
      if (duplicate.name.toLowerCase() === countryForm.name.toLowerCase() && duplicate.code.toLowerCase() === countryForm.code.toLowerCase()) {
         setCountryFormError(`Version '${duplicate.code}' is already added for '${duplicate.name}'.`);
      } else {
         setCountryFormError(`URL '${duplicate.url}' is already used by '${duplicate.name}' - Version '${duplicate.code}'.`);
      }
      return;
    }
    setCountryFormError(null);

    if (isEditingCountry) {
      const { data, error } = await supabase.from('countries').update({
        name: countryForm.name,
        code: countryForm.code,
        url: countryForm.url
      }).eq('id', isEditingCountry).select();
      if (!error && data) {
        setCountries(countries.map(c => c.id === isEditingCountry ? data[0] : c));
        setIsEditingCountry(null);
        await logAction(profile.email || role === "admin" ? "admin@example.com" : "qa@example.com", "Update Country", `Updated country: ${countryForm.name}`);
        setCountryForm({ name: "", code: "", url: "" });
      }
    } else {
      const { data, error } = await supabase.from('countries').insert([
        { name: countryForm.name, code: countryForm.code, url: countryForm.url }
      ]).select();
      if (!error && data) {
        setCountries([...countries, data[0]]);
        await logAction(profile.email || role === "admin" ? "admin@example.com" : "qa@example.com", "Add Country", `Added country: ${countryForm.name} (${countryForm.code})`);
        setCountryForm({ name: "", code: "", url: "" });
      }
    }
  };

  const deleteCountry = async (id: string) => {
    const { error } = await supabase.from('countries').delete().eq('id', id);
    if (!error) {
      setCountries(countries.filter(c => c.id !== id));
      await logAction(profile.email || role === "admin" ? "admin@example.com" : "qa@example.com", "Delete Country", `Deleted country`);
    }
  };

  const editCountry = (c: any) => {
    setIsEditingCountry(c.id);
    setCountryForm({ name: c.name, code: c.code, url: c.url });
    setActiveTab("countries");
  };

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from('teams').insert([{ name: teamForm.name }]).select();
    if (!error && data) {
      setTeams([...teams, data[0]]);
      await logAction(profile.email || (role === "admin" ? "admin@example.com" : "qa@example.com"), "Add Team", `Added team: ${teamForm.name}`);
      setTeamForm({ name: "" });
    } else if (error) {
      alert("Error adding team: " + error.message);
    }
  };

  const deleteTeam = async (id: string) => {
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (!error) {
      setTeams(teams.filter(t => t.id !== id));
      await logAction(profile.email || role === "admin" ? "admin@example.com" : "qa@example.com", "Delete Team", `Deleted team`);
    }
  };


  const handleLogosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Assuming a single row exists or we upsert
    const { data: sData } = await supabase.from('app_settings').select('id').limit(1).single();
    if (sData) {
      await supabase.from('app_settings').update({
        expanded_logo_url: logos.expanded,
        collapsed_logo_url: logos.collapsed
      }).eq('id', sData.id);
    } else {
      await supabase.from('app_settings').insert([{
        expanded_logo_url: logos.expanded,
        collapsed_logo_url: logos.collapsed
      }]);
    }
    await logAction(profile.email || role === "admin" ? "admin@example.com" : "qa@example.com", "Update Logos", "Updated application logos");
    alert("Logos saved successfully");
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/60">
      <header className="h-20 flex items-center justify-between px-8 bg-white border-b border-slate-200 shrink-0 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-[#2b61d6]" />
            Platform Settings & Configuration
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-0.5">Manage user profile, regional URLs, teams, logos, and audit logs</p>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 py-6">
          <nav className="flex-1 px-4 space-y-1.5">
            <button
              onClick={() => setActiveTab("profile")}
              className={cn(
                "w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-bold cursor-pointer",
                activeTab === "profile" 
                  ? "bg-blue-50 text-[#2b61d6] shadow-2xs border border-blue-200" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <User className="h-4 w-4 text-blue-600" />
              <span>My Profile</span>
            </button>
            <button
              onClick={() => setActiveTab("database")}
              className={cn(
                "w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-bold cursor-pointer",
                activeTab === "database" 
                  ? "bg-cyan-50 text-cyan-800 shadow-2xs border border-cyan-200" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Database className="h-4 w-4 text-cyan-600" />
              <span>Database & Storage</span>
            </button>
            <button
              onClick={() => setActiveTab("countries")}
              className={cn(
                "w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-bold cursor-pointer",
                activeTab === "countries" 
                  ? "bg-amber-50 text-amber-800 shadow-2xs border border-amber-200" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Globe className="h-4 w-4 text-amber-600" />
              <span>Countries & Version URLs</span>
            </button>
            {role === "admin" && (
              <button
                onClick={() => setActiveTab("quicklogin")}
                className={cn(
                  "w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-bold cursor-pointer",
                  activeTab === "quicklogin" 
                    ? "bg-amber-50 text-amber-900 shadow-2xs border border-amber-200" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                <span>One-Click Quick Login</span>
              </button>
            )}
            {role === "admin" && (
              <button 
                onClick={() => setActiveTab("logs")}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  activeTab === "logs" 
                    ? "bg-emerald-50 text-emerald-800 shadow-2xs border border-emerald-200" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <div className="h-4 w-4 flex items-center justify-center text-emerald-600"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
                <span>Activity Audit Logs</span>
              </button>
            )}
            {role === "admin" && (
              <button 
                onClick={() => setActiveTab("logos")}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  activeTab === "logos" 
                    ? "bg-purple-50 text-purple-800 shadow-2xs border border-purple-200" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <ImageIcon className="h-4 w-4 text-purple-600" />
                <span>Platform Logos</span>
              </button>
            )}
            {role === "admin" && (
              <button
                onClick={() => setActiveTab("teams")}
                className={cn(
                  "w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-bold cursor-pointer",
                  activeTab === "teams" 
                    ? "bg-indigo-50 text-indigo-800 shadow-2xs border border-indigo-200" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Users className="h-4 w-4 text-indigo-600" />
                <span>Teams</span>
              </button>
            )}
          </nav>
        </aside>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="w-full">
            {activeTab === "database" && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <Database className="w-5 h-5 text-cyan-600" />
                        Database Connection & Persistence
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        Connect your Supabase database to ensure all campaigns and settings are stored safely in the cloud across deployments.
                      </p>
                    </div>
                    <div>
                      {isRealSupabase ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Database Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          Local Storage Mode
                        </span>
                      )}
                    </div>
                  </div>

                  {!isRealSupabase && (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-4 text-xs text-amber-900 space-y-2 mb-6">
                      <p className="font-semibold text-sm flex items-center gap-1.5 text-amber-950">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        No database environment variables detected!
                      </p>
                      <p>
                        Your application is currently running in <strong>Local Storage Mode</strong>. Campaigns created now are saved in your browser's local cache. When deploying to Vercel or migrating devices, you must add your database keys to persist all data permanently.
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-slate-800">Required Environment Variables (.env / Vercel Settings)</h4>
                    <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs space-y-2 overflow-x-auto border border-slate-800">
                      <div><span className="text-slate-500"># Supabase Project URL</span></div>
                      <div><span className="text-cyan-400">VITE_SUPABASE_URL</span>=https://your-project.supabase.co</div>
                      <div className="pt-2"><span className="text-slate-500"># Supabase Anon API Key</span></div>
                      <div><span className="text-cyan-400">VITE_SUPABASE_ANON_KEY</span>=your-anon-key-here</div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                    <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <CloudUpload className="w-4 h-4 text-blue-600" />
                      Bulk Data Migration & Sync
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      If you created campaigns while offline or in Local Storage Mode before adding your database connection, click below to migrate and sync all local campaign records into your database without losing anything.
                    </p>

                    {migrationStatusMsg && (
                      <div className="p-3 bg-slate-100 border border-slate-200 rounded-md text-xs font-mono text-slate-700 flex items-center gap-2">
                        {isMigratingDb && <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />}
                        {migrationStatusMsg}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={handleFullDataMigration}
                        disabled={isMigratingDb}
                        className="flex items-center gap-2 px-4 py-2 bg-[#2b61d6] text-white rounded-md text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                      >
                        {isMigratingDb ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Migrating Data...
                          </>
                        ) : (
                          <>
                            <Server className="w-4 h-4" />
                            Migrate & Sync All Local Data to Database
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "profile" && (
              <div className="space-y-6">
                {savedSuccessMsg && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{savedSuccessMsg}</span>
                  </div>
                )}

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-xl flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">My Profile Settings</h3>
                      <p className="text-sm text-slate-500">Update your personal account details, team assignment, and profile photo.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border inline-flex items-center gap-1.5",
                        role === "admin" ? "bg-purple-100 text-purple-800 border-purple-200" : "bg-blue-100 text-blue-800 border-blue-200"
                      )}>
                        {role === "admin" ? (
                          <>
                            <Shield className="w-3.5 h-3.5 text-purple-600" />
                            <span>Admin Access</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3.5 h-3.5 text-blue-600" />
                            <span>Standard User</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <form onSubmit={saveProfile} className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Profile Picture</label>
                        <div className="flex items-center gap-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                          <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white text-xl overflow-hidden border-2 border-white shadow-md shrink-0">
                            {profile.avatar ? (
                              <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                            ) : (
                              profile.name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 space-y-1">
                            <input 
                              type="file" 
                              accept="image/*"
                              ref={fileInputRef}
                              className="hidden"
                              onChange={handleImageUpload}
                            />
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                              >
                                <Upload className="h-4 w-4 text-[#2b61d6]" />
                                Upload Profile Photo
                              </button>
                              {profile.avatar && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...profile, avatar: "" };
                                    setProfile(updated);
                                    const key = userEmail ? "settings_profile_" + userEmail : "settings_profile_" + role;
                                    localStorage.setItem(key, JSON.stringify(updated));
                                    window.dispatchEvent(new Event("profile_updated"));
                                  }}
                                  className="text-xs text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                                >
                                  Remove Photo
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">Supports JPG, PNG, WEBP formats. Image updates instantly across sidebar and headers.</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700">Full Name</label>
                          <input 
                            type="text" 
                            value={profile.name}
                            onChange={(e) => setProfile({...profile, name: e.target.value})}
                            className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700">Email Address</label>
                          <input 
                            type="email" 
                            value={profile.email}
                            onChange={(e) => setProfile({...profile, email: e.target.value})}
                            className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Team Assignment</label>
                        <select 
                          value={profile.team}
                          onChange={(e) => setProfile({...profile, team: e.target.value})}
                          className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                        >
                          {teams.map(t => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex justify-end pt-2 border-t border-slate-100">
                        <button type="submit" className="flex items-center gap-2 px-5 py-2.5 bg-[#2b61d6] text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer">
                          <Save className="h-4 w-4" />
                          Save Profile & Team Changes
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Account Security & Password Change */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-[#2b61d6]" />
                        Account Security & Change Password
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Update your login password to keep your account secure</p>
                    </div>
                  </div>
                  <div className="p-6">
                    {passwordStatusMsg && (
                      <div className={cn(
                        "p-4 rounded-xl text-xs font-semibold mb-4 flex items-center gap-2",
                        passwordStatusMsg.type === 'success' ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                      )}>
                        {passwordStatusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                        <span>{passwordStatusMsg.text}</span>
                      </div>
                    )}

                    <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">New Password</label>
                        <input 
                          type="password" 
                          placeholder="At least 6 characters..."
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                          className="w-full flex h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Confirm New Password</label>
                        <input 
                          type="password" 
                          placeholder="Re-enter new password..."
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                          className="w-full flex h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                          required
                        />
                      </div>

                      <div className="pt-2">
                        <button 
                          type="submit" 
                          disabled={isChangingPassword || !passwordForm.newPassword}
                          className="flex items-center gap-2 px-5 py-2.5 bg-[#2b61d6] text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                        >
                          <Lock className="h-4 w-4" />
                          {isChangingPassword ? "Updating Password..." : "Update Password"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* My Team Overview */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        My Team: <span className="text-blue-600">{profile.team || "HP-APJ"}</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Teammates assigned to the {profile.team || "HP-APJ"} Quality Assurance team</p>
                    </div>
                    <span className="text-xs font-bold text-blue-700 bg-blue-100 border border-blue-200 px-3 py-1 rounded-full">
                      {allUsers.filter(u => (u.team || "HP-APJ") === (profile.team || "HP-APJ")).length} Members
                    </span>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allUsers
                        .filter(u => (u.team || "HP-APJ") === (profile.team || "HP-APJ"))
                        .map((member) => (
                          <div key={member.id || member.email} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center gap-3.5 hover:border-blue-300 transition-all">
                            <div className="w-10 h-10 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden shadow-xs">
                              {member.avatar ? (
                                <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                              ) : (
                                (member.name || member.email).substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="overflow-hidden flex-1">
                              <h4 className="font-bold text-slate-900 text-sm truncate">{member.name || "Team Member"}</h4>
                              <p className="text-xs text-slate-500 truncate">{member.email}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                                  member.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                                )}>
                                  {member.role === "admin" ? "Admin" : "QA User"}
                                </span>
                                <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-medium">Active</span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "countries" && (
              <div className="space-y-8">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                    <h3 className="text-lg font-semibold text-slate-900">{isEditingCountry ? "Edit Country" : "Add New Country"}</h3>
                    <p className="text-sm text-slate-500">Configure regional settings for campaigns.</p>
                  </div>
                  <div className="p-6">
                    <form onSubmit={handleCountrySubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Country</label>
                          <div className="flex gap-2">
                            {isCreatingNewCountry || countries.length === 0 ? (
                              <input 
                                type="text" 
                                placeholder="e.g. Australia"
                                value={countryForm.name}
                                onChange={(e) => setCountryForm({...countryForm, name: e.target.value})}
                                className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                                required
                              />
                            ) : (
                              <select
                                value={countryForm.name}
                                onChange={(e) => {
                                  if (e.target.value === "__NEW__") {
                                    setIsCreatingNewCountry(true);
                                    setCountryForm({...countryForm, name: ""});
                                  } else {
                                    setCountryForm({...countryForm, name: e.target.value});
                                  }
                                }}
                                className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                                required
                              >
                                <option value="" disabled>Select a Country</option>
                                {Array.from(new Set(countries.map(c => c.name))).map(name => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                                <option value="__NEW__">+ Add New Country...</option>
                              </select>
                            )}
                            {isCreatingNewCountry && countries.length > 0 && (
                              <button type="button" onClick={() => { setIsCreatingNewCountry(false); setCountryFormError(null); }} className="px-3 h-10 border border-slate-300 rounded-md text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Version</label>
                          <input 
                            type="text" 
                            placeholder="e.g. PUB"
                            value={countryForm.code}
                            onChange={(e) => setCountryForm({...countryForm, code: e.target.value})}
                            className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Version URL</label>
                        <input 
                          type="url" 
                          placeholder="https://www.hp.com/au-en/shop/"
                          value={countryForm.url}
                          onChange={(e) => setCountryForm({...countryForm, url: e.target.value})}
                          className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        {countryFormError && (
                          <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-md text-sm flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            {countryFormError}
                          </div>
                        )}
                        <div className="flex justify-end pt-2 gap-3">
                        {isEditingCountry && (
                          <button 
                            type="button" 
                            onClick={() => { setIsEditingCountry(null); setCountryForm({ name: "", code: "", url: "" }); }}
                            className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                          >
                            Cancel
                          </button>
                        )}
                        <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-[#2b61d6] text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                          {isEditingCountry ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          {isEditingCountry ? "Update Country" : "Add Country"}
                        </button>
                      </div>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Configured Countries & Versions</h3>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-600">Filter by Country:</label>
                      <select 
                        value={selectedCountryFilter} 
                        onChange={(e) => setSelectedCountryFilter(e.target.value)}
                        className="h-9 px-3 rounded-md border border-slate-300 bg-white text-sm"
                      >
                        <option value="All">All Countries</option>
                        {Array.from(new Set(countries.map(c => c.name))).map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200 text-left">
                        <th className="px-6 py-3">Country</th>
                        <th className="px-6 py-3">Version</th>
                        <th className="px-6 py-3">Version URL</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                      {countries.filter(c => selectedCountryFilter === "All" || c.name === selectedCountryFilter).map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">{c.name}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200">{c.code}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">{c.url}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => editCountry(c)} className="p-1.5 text-slate-400 hover:text-[#2b61d6] hover:bg-blue-50 rounded-md transition-colors">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button onClick={() => deleteCountry(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {countries.filter(c => selectedCountryFilter === "All" || c.name === selectedCountryFilter).length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No versions found.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "logos" && role === "admin" && (
              <div className="space-y-8">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                    <h3 className="text-lg font-semibold text-slate-900">Logo Settings</h3>
                    <p className="text-sm text-slate-500">Configure application logos for the sidebar.</p>
                  </div>
                  <div className="p-6">
                    <form onSubmit={handleLogosSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Expanded Logo URL</label>
                        <input 
                          type="url" 
                          placeholder="e.g. https://zetaglobal.com/wp-content/uploads/2023/02/zeta_logoPrimary.svg"
                          value={logos.expanded}
                          onChange={(e) => setLogos({...logos, expanded: e.target.value})}
                          className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Collapsed Logo URL</label>
                        <input 
                          type="url" 
                          placeholder="e.g. https://companieslogo.com/img/orig/ZETA-424536bc.png"
                          value={logos.collapsed}
                          onChange={(e) => setLogos({...logos, collapsed: e.target.value})}
                          className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                        />
                      </div>
                      <div className="flex justify-end pt-2">
                        <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-[#2b61d6] text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                          <Save className="h-4 w-4" />
                          Save Logos
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
            {activeTab === "logs" && role === "admin" && (
              <div className="space-y-8">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg font-semibold text-slate-900">Platform Activity Logs</h3>
                    <p className="text-sm text-slate-500">View recent activity and actions across the platform.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200 text-left">
                          <th className="px-6 py-3">Timestamp</th>
                          <th className="px-6 py-3">User</th>
                          <th className="px-6 py-3">Action</th>
                          <th className="px-6 py-3">Details</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm divide-y divide-slate-100">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="px-6 py-4 font-medium text-slate-900">{log.user_email}</td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium text-xs border border-slate-200">
                                {log.action_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {logs.length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No activity logs available.
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === "teams" && role === "admin" && (
              <div className="space-y-8">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                    <h3 className="text-lg font-semibold text-slate-900">Add New Team</h3>
                    <p className="text-sm text-slate-500">Create new teams for user assignment.</p>
                  </div>
                  <div className="p-6">
                    <form onSubmit={handleTeamSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Team Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. HP-AMERICAS"
                          value={teamForm.name}
                          onChange={(e) => setTeamForm({...teamForm, name: e.target.value})}
                          className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                          required
                        />
                      </div>
                      <div className="flex justify-end pt-2">
                        <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-[#2b61d6] text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                          <Plus className="h-4 w-4" />
                          Add Team
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg font-semibold text-slate-900">Configured Teams</h3>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200 text-left">
                        <th className="px-6 py-3">Team Name</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                      {teams.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">{t.name}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => deleteTeam(t.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {teams.length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No teams configured.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "quicklogin" && role === "admin" && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                        One-Click Quick Login Settings
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        Control global quick login visibility and selectively enable or disable specific users for One-Click Quick Login on the login screen.
                      </p>
                    </div>
                    <div>
                      {quickLoginEnabled ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Global Quick Login Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <AlertCircle className="w-4 h-4 text-slate-400" />
                          Global Quick Login Disabled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Global Toggle */}
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Enable One-Click Quick Login Feature</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        When enabled, quick login cards for enabled users will be visible on the main login screen.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleQuickLogin(!quickLoginEnabled)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        quickLoginEnabled ? "bg-[#2b61d6]" : "bg-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                          quickLoginEnabled ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {/* Per-User Quick Login Access Controls */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          Manage User Access for One-Click Quick Login
                        </h4>
                        <p className="text-xs text-slate-500">Toggle quick login access on or off for individual user accounts.</p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-md">
                        {allUsers.filter(u => u.quick_login_enabled === true).length} of {allUsers.length} Users Enabled
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                          <tr>
                            <th className="px-5 py-3">User</th>
                            <th className="px-5 py-3">Role</th>
                            <th className="px-5 py-3">Team</th>
                            <th className="px-5 py-3 text-right">Quick Login Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {allUsers.map((u) => {
                            const isEnabled = u.quick_login_enabled === true;
                            return (
                              <tr key={u.id || u.email} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs overflow-hidden shrink-0">
                                      {u.avatar ? (
                                        <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                                      ) : (
                                        (u.name || u.email).substring(0, 2).toUpperCase()
                                      )}
                                    </div>
                                    <div>
                                      <div className="font-bold text-slate-900 text-xs">{u.name || "User"}</div>
                                      <div className="text-[11px] text-slate-500">{u.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                    u.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                                  )}>
                                    {u.role || "User"}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 font-medium text-slate-800">
                                  {u.team || "HP-APJ"}
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => toggleUserQuickLogin(u.id)}
                                    className={cn(
                                      "px-3 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs",
                                      isEnabled 
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100" 
                                        : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
                                    )}
                                  >
                                    <Zap className={cn("w-3.5 h-3.5", isEnabled ? "text-amber-500 fill-amber-500" : "text-slate-400")} />
                                    <span>{isEnabled ? "Quick Login Enabled" : "Off"}</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 text-xs text-blue-900 space-y-1 mt-4">
                      <strong className="font-bold block flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-[#2b61d6]" />
                        Admin Note:
                      </strong>
                      <p className="text-blue-800">
                        Enabling a user for Quick Login allows them to log into the QA platform directly with one click from the sign-in screen using preconfigured QA test credentials.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
