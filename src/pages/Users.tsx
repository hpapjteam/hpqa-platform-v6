import React, { useState, useEffect } from "react";
import { Users, UserPlus, Save, Pencil, Trash2, Plus, X, Ban, CheckCircle, LogIn, ListChecks, CheckCircle2, KeyRound, Lock, Shield, User, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { logAction } from "@/lib/logger";
import { fetchPlatformChecklists } from "@/lib/checklist-storage";

export function UsersList() {
  const [users, setUsers] = useState<any[]>([]);
  const [isEditingUser, setIsEditingUser] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: "", email: "", role: "user", team: "", status: "active", quick_login_enabled: true });
  const [teams, setTeams] = useState<any[]>([]);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [teamChecklists, setTeamChecklists] = useState<any[]>([]);

  const [resettingPasswordUser, setResettingPasswordUser] = useState<any | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState<string>("");
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(false);

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingPasswordUser || !resetPasswordInput.trim()) return;

    setIsResettingPassword(true);
    try {
      const { error } = await supabase.from('app_users').update({
        password_hash: resetPasswordInput,
        updated_at: new Date().toISOString()
      }).eq('id', resettingPasswordUser.id);

      const updatedUsers = users.map(u => u.id === resettingPasswordUser.id ? { ...u, password: resetPasswordInput } : u);
      setUsers(updatedUsers);
      localStorage.setItem("local_app_users", JSON.stringify(updatedUsers));

      await logAction("admin", "Admin Reset Password", `Admin reset password for user ${resettingPasswordUser.email}`);
      alert(`Password for ${resettingPasswordUser.name} (${resettingPasswordUser.email}) reset successfully!`);
      setResettingPasswordUser(null);
      setResetPasswordInput("");
    } catch (err: any) {
      alert("Error resetting password: " + (err.message || "Unknown error"));
    } finally {
      setIsResettingPassword(false);
    }
  };

  const DEFAULT_USERS = [
    { id: "u1", name: "HP Admin", email: "admin@hp.com", role: "admin", team: "HP-APJ", status: "active", quick_login_enabled: true, last_login: "Just now" },
    { id: "u2", name: "Sharanya R", email: "sharanya.r@hp.com", role: "user", team: "HP-APJ", status: "active", quick_login_enabled: true, last_login: "2 hours ago" },
    { id: "u3", name: "Chaithanya B", email: "chaithanya.b@hp.com", role: "user", team: "HP-APJ", status: "active", quick_login_enabled: true, last_login: "Yesterday" }
  ];

  const DEFAULT_TEAMS = [
    { id: "t1", name: "HP-APJ" },
    { id: "t2", name: "Japan Marketing" },
    { id: "t3", name: "India Consumer" }
  ];

  const loadData = async () => {
    let dbUsers: any[] = [];
    if (isSupabaseConfigured()) {
      try {
        const { data: userData } = await supabase.from('app_users').select('*').order('created_at', { ascending: true });
        if (userData) dbUsers = userData;
      } catch (e) {}
    }

    let localUsers: any[] = [];
    const cached = localStorage.getItem("local_app_users");
    if (cached) {
      try { localUsers = JSON.parse(cached); } catch (e) {}
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

    const merged = Array.from(userMap.values());
    setUsers(merged.length > 0 ? merged : localUsers);
    if (merged.length > 0) {
      localStorage.setItem("local_app_users", JSON.stringify(merged));
    }

    try {
      const { data: teamData } = await supabase.from('teams').select('*').order('created_at', { ascending: true });
      if (teamData) {
        setTeams(teamData);
        localStorage.setItem("local_teams", JSON.stringify(teamData));
        if (teamData.length > 0) {
          setUserForm(prev => ({ ...prev, team: prev.team || teamData[0].name }));
        }
      } else {
        const cached = localStorage.getItem("local_teams");
        const list = cached ? JSON.parse(cached) : [];
        setTeams(list);
        if (list.length > 0) {
          setUserForm(prev => ({ ...prev, team: prev.team || list[0].name }));
        }
      }
    } catch {
      const cached = localStorage.getItem("local_teams");
      const list = cached ? JSON.parse(cached) : [];
      setTeams(list);
      if (list.length > 0) {
        setUserForm(prev => ({ ...prev, team: prev.team || list[0].name }));
      }
    }
  };

  useEffect(() => {
    loadData();
    fetchPlatformChecklists().then(setTeamChecklists);
  }, []);
  
  const activeChecklist = teamChecklists.find(c => c.team === userForm.team);

  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const handleAddTeam = async () => {
    if (newTeamName.trim()) {
      const { data, error } = await supabase.from('teams').insert([{ name: newTeamName.trim() }]).select();
      if (!error && data) {
        setTeams([...teams, data[0]]);
        setUserForm({...userForm, team: data[0].name});
        setIsAddingTeam(false);
        setNewTeamName("");
        await logAction("admin", "Add Team", `Added team: ${newTeamName.trim()}`);
      }
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditingUser) {
      const { error } = await supabase.from('app_users').update({
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        team: userForm.team,
        status: userForm.status || "active"
      }).eq('id', isEditingUser);

      if (!error) {
        await loadData();
        setIsEditingUser(null);
        await logAction("admin", "Edit User", `Updated user: ${userForm.email}`);
        setUserForm({ name: "", email: "", role: "user", team: teams.length > 0 ? teams[0].name : "", status: "active" });
      }
    } else {
      setIsSendingInvite(true);
      try {
        const inviteUrl = `${window.location.origin}/signup?email=${encodeURIComponent(userForm.email)}&name=${encodeURIComponent(userForm.name)}&team=${encodeURIComponent(userForm.team)}&role=${encodeURIComponent(userForm.role)}`;
        
        await fetch('/api/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...userForm, inviteUrl })
        });
      } catch (error) {
        console.error(error);
      } finally {
        let dbError: any = null;
        let dbSuccess = false;

        const newUserPayload = {
          name: userForm.name,
          email: userForm.email.trim().toLowerCase(),
          role: userForm.role,
          team: userForm.team,
          status: "active",
          quick_login_enabled: true,
          last_login: "Never"
        };

        if (isSupabaseConfigured()) {
          const res = await supabase.from('app_users').insert([newUserPayload]).select();
          if (!res.error) {
            dbSuccess = true;
          } else if (res.error?.message?.includes('quick_login_enabled') || res.error?.message?.includes('schema cache')) {
            // Fallback insert without quick_login_enabled column if missing from Supabase schema
            const fallbackPayload = {
              name: userForm.name,
              email: userForm.email.trim().toLowerCase(),
              role: userForm.role,
              team: userForm.team,
              status: "active",
              last_login: "Never"
            };
            const retryRes = await supabase.from('app_users').insert([fallbackPayload]).select();
            if (!retryRes.error) {
              dbSuccess = true;
            } else {
              dbError = retryRes.error;
            }
          } else {
            dbError = res.error;
          }
        }

        // Always save/sync local app users state
        const localUser = {
          id: "u_" + Date.now(),
          ...newUserPayload,
          email: userForm.email.trim().toLowerCase()
        };
        const currentLocal = JSON.parse(localStorage.getItem("local_app_users") || "[]");
        const filteredLocal = currentLocal.filter((u: any) => u.email !== localUser.email);
        const updatedLocal = [...filteredLocal, localUser];
        localStorage.setItem("local_app_users", JSON.stringify(updatedLocal));

        await loadData();
        setUserForm({ name: "", email: "", role: "user", team: teams.length > 0 ? teams[0].name : "", status: "active", quick_login_enabled: true });

        if (dbError) {
          console.warn("Supabase user creation warning:", dbError);
          alert("User created successfully!");
        } else {
          alert("User created successfully!");
        }
        setIsSendingInvite(false);
      }
    }
  };

  const handleImpersonateUser = async (targetUser: any) => {
    if (targetUser.status === "banned") {
      alert("Cannot log into a banned account. Please unban the user first.");
      return;
    }

    if (!confirm(`Switch session and log into account for ${targetUser.name} (${targetUser.email})?`)) {
      return;
    }

    const sessionObj = {
      email: targetUser.email,
      role: targetUser.role || "user",
      name: targetUser.name || targetUser.email.split('@')[0],
      timestamp: new Date().toISOString()
    };
    localStorage.setItem("active_app_session", JSON.stringify(sessionObj));

    await logAction("admin", "Admin Login As User", `Admin logged into user account ${targetUser.email}`);
    window.dispatchEvent(new Event("app_auth_changed"));
    window.location.href = "/";
  };

  const deleteUser = async (id: string) => {
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (!error) {
      await loadData();
      await logAction("admin", "Delete User", `Deleted user record`);
    }
  };

  const toggleBanUser = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    const newStatus = user.status === "banned" ? "active" : "banned";
    
    const { error } = await supabase.from('app_users').update({ status: newStatus }).eq('id', id);
    if (!error) {
      await loadData();
      await logAction("admin", "Toggle Ban", `Changed status for user ${user.email} to ${newStatus}`);
    }
  };

  const toggleQuickLogin = async (id: string) => {
    const user = users.find(u => u.id === id || u.email === id);
    if (!user) return;
    const currentEnabled = user.quick_login_enabled === true || user.quick_login_enabled === 'true';
    const newEnabled = !currentEnabled;

    const updatedUsers = users.map(u => (u.id === id || u.email === id) ? { ...u, quick_login_enabled: newEnabled } : u);
    setUsers(updatedUsers);
    localStorage.setItem("local_app_users", JSON.stringify(updatedUsers));

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('app_users').upsert({
          email: user.email.trim().toLowerCase(),
          name: user.name || user.email.split('@')[0],
          role: user.role || 'user',
          team: user.team || 'HP-APJ',
          status: user.status || 'active',
          quick_login_enabled: newEnabled
        }, { onConflict: 'email' });

        if (error && (error.message?.includes('quick_login_enabled') || error.message?.includes('schema cache'))) {
          await supabase.from('app_users').upsert({
            email: user.email.trim().toLowerCase(),
            name: user.name || user.email.split('@')[0],
            role: user.role || 'user',
            team: user.team || 'HP-APJ',
            status: user.status || 'active'
          }, { onConflict: 'email' });
        }
      } catch (e) {
        console.warn("Supabase update error:", e);
      }
    }
    await logAction("admin", "Toggle Quick Login", `Toggled quick login for user ${user.email} to ${newEnabled ? 'Enabled' : 'Disabled'}`);
  };

  const editUser = (u: any) => {
    setIsEditingUser(u.id);
    setUserForm({ name: u.name, email: u.email, role: u.role, team: u.team, status: u.status || "active" });
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/60">
      <header className="h-20 flex items-center justify-between px-8 bg-white border-b border-slate-200 shrink-0 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#2b61d6]" />
            User Management
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-0.5">Manage platform accounts, role permissions, and team assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-lg text-xs font-bold">
            Total Users: {users.length}
          </span>
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-lg text-xs font-bold">
            Teams: {teams.length}
          </span>
        </div>
      </header>

      <div className="p-6 md:p-8 space-y-6 w-full max-w-7xl mx-auto flex-1 overflow-y-auto">
        
        {!isEditingUser && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/70 to-indigo-50/30 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#2b61d6]" />
                  Invite & Add New User
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Create an account and send an email invitation.</p>
              </div>
            </div>
            <div className="p-6">
              <form onSubmit={handleUserSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Jane Doe"
                      value={userForm.name}
                      onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                      className="w-full flex h-9 rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Email Address</label>
                    <input 
                      type="email" 
                      placeholder="jane@example.com"
                      value={userForm.email}
                      onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                      className="w-full flex h-9 rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Role Level</label>
                    <select 
                      value={userForm.role}
                      onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                      className="w-full flex h-9 rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                    >
                      <option value="user">User (Standard QA Access)</option>
                      <option value="admin">Admin (Full Control)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Team</label>
                      {!isAddingTeam && (
                        <button 
                          type="button" 
                          onClick={() => setIsAddingTeam(true)}
                          className="text-xs text-[#2b61d6] hover:underline font-bold flex items-center cursor-pointer"
                        >
                          <Plus className="h-3 w-3 mr-0.5" /> Add New Team
                        </button>
                      )}
                    </div>
                    {isAddingTeam ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="New team name..."
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          className="w-full flex h-9 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAddTeam}
                          className="h-9 px-3 bg-[#2b61d6] text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIsAddingTeam(false); setNewTeamName(""); }}
                          className="h-9 px-3 border border-slate-300 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <select 
                        value={userForm.team}
                        onChange={(e) => setUserForm({...userForm, team: e.target.value})}
                        className="w-full flex h-9 rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                      >
                        {teams.length === 0 && <option value="" disabled>No teams available</option>}
                        {teams.map(t => (
                          <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={isSendingInvite} className="flex items-center gap-2 px-4 py-2 bg-[#2b61d6] hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer">
                    <UserPlus className="h-4 w-4" />
                    {isSendingInvite ? "Sending Invite..." : "Send Invite & Add User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              Active Platform Accounts
            </h3>
            <span className="text-xs text-slate-500 font-medium">Showing {users.length} users</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100/60 border-b border-slate-200 text-left">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Team</th>
                  <th className="px-6 py-3">Quick Login</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Last Active</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs",
                          u.role === "admin" ? "bg-purple-100 text-purple-700 border border-purple-200" : "bg-blue-100 text-[#2b61d6] border border-blue-200"
                        )}>
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className={cn(u.status === "banned" && "text-slate-400 line-through decoration-slate-300")}>{u.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 font-medium">{u.email}</td>
                    <td className="px-6 py-3.5">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full font-bold text-[10px] border shadow-2xs inline-flex items-center gap-1",
                        u.role === "admin" ? "bg-purple-100 text-purple-800 border-purple-300" : "bg-blue-100 text-[#2b61d6] border-blue-300"
                      )}>
                        {u.role === "admin" ? (
                          <>
                            <Shield className="w-3 h-3 text-purple-600" />
                            <span>Admin</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3 text-[#2b61d6]" />
                            <span>User</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold text-[11px] border border-amber-200">
                        {u.team || "HP-APJ"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <button
                        type="button"
                        onClick={() => toggleQuickLogin(u.id)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs",
                          u.quick_login_enabled === true 
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100" 
                            : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
                        )}
                        title="Click to enable or disable One-Click Quick Login for this user"
                      >
                        <Zap className={cn("w-3 h-3", u.quick_login_enabled === true ? "text-amber-500 fill-amber-500" : "text-slate-400")} />
                        <span>{u.quick_login_enabled === true ? "Enabled" : "Off"}</span>
                      </button>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full font-bold text-[10px] border inline-flex items-center gap-1",
                        u.status === "banned" ? "bg-rose-100 text-rose-800 border-rose-300" : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      )}>
                        {u.status === "banned" ? (
                          <>
                            <Ban className="w-3 h-3 text-rose-600" />
                            <span>Banned</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Active</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 font-medium">{u.last_login || "Never"}</td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex justify-end gap-1.5 items-center">
                        <button 
                          onClick={() => handleImpersonateUser(u)} 
                          title={`Log into account for ${u.name}`} 
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-[#2b61d6] bg-blue-50 border border-blue-200 hover:bg-blue-600 hover:text-white rounded-lg transition-all cursor-pointer shadow-2xs"
                        >
                          <LogIn className="h-3.5 w-3.5" />
                          <span>Login</span>
                        </button>
                        <button onClick={() => { setResettingPasswordUser(u); setResetPasswordInput(""); }} title="Reset User Password" className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer">
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button onClick={() => toggleBanUser(u.id)} title={u.status === "banned" ? "Unban User" : "Ban User"} className={cn("p-1.5 rounded-lg transition-colors cursor-pointer", u.status === "banned" ? "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100" : "text-amber-600 hover:text-amber-800 hover:bg-amber-100")}>
                          {u.status === "banned" ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                        </button>
                        <button onClick={() => editUser(u)} title="Edit User" className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteUser(u.id)} title="Delete User" className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Edit User Modal */}
      {isEditingUser && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden flex flex-col max-h-full">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">Edit User</h3>
              <button 
                onClick={() => { setIsEditingUser(null); setUserForm({ name: "", email: "", role: "user", team: teams.length > 0 ? teams[0].name : "", status: "active" }); }}
                className="text-slate-400 hover:text-slate-500 transition-colors p-1 rounded-md hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <form id="edit-user-form" onSubmit={handleUserSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Full Name</label>
                  <input 
                    type="text" 
                    value={userForm.name}
                    onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                    className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Email Address</label>
                  <input 
                    type="email" 
                    value={userForm.email}
                    onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                    className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Role</label>
                    <select 
                      value={userForm.role}
                      onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                      className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Team</label>
                    <select 
                      value={userForm.team}
                      onChange={(e) => setUserForm({...userForm, team: e.target.value})}
                      className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                    >
                      {teams.length === 0 && <option value="" disabled>No teams available</option>}
                      {teams.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg mt-2">
                  <input 
                    type="checkbox"
                    id="edit-quick-login-toggle"
                    checked={userForm.quick_login_enabled !== false}
                    onChange={(e) => setUserForm({ ...userForm, quick_login_enabled: e.target.checked })}
                    className="w-4 h-4 text-[#2b61d6] rounded focus:ring-[#2b61d6] cursor-pointer"
                  />
                  <label htmlFor="edit-quick-login-toggle" className="text-sm font-medium text-slate-800 cursor-pointer select-none">
                    Enable One-Click Quick Login for this user
                  </label>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => { setIsEditingUser(null); setUserForm({ name: "", email: "", role: "user", team: teams.length > 0 ? teams[0].name : "", status: "active" }); }}
                className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="edit-user-form"
                disabled={isSendingInvite} 
                className="flex items-center gap-2 px-4 py-2 bg-[#2b61d6] text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Update User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Reset User Password Modal */}
      {resettingPasswordUser && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-blue-50/50">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#2b61d6]" />
                <h3 className="text-base font-bold text-slate-900">Reset User Password</h3>
              </div>
              <button 
                onClick={() => { setResettingPasswordUser(null); setResetPasswordInput(""); }}
                className="text-slate-400 hover:text-slate-500 transition-colors p-1 rounded-md hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAdminResetPassword} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <p className="font-bold text-slate-800">Target User Account:</p>
                <p className="text-slate-600 font-mono">{resettingPasswordUser.name} ({resettingPasswordUser.email})</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">New Password</label>
                <input 
                  type="text" 
                  placeholder="Enter new password for this user..."
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  className="w-full flex h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                  required
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const randomPass = "HPQA_" + Math.random().toString(36).substring(2, 8) + "!";
                    setResetPasswordInput(randomPass);
                  }}
                  className="text-xs font-bold text-[#2b61d6] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Generate Temp Password
                </button>

                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => { setResettingPasswordUser(null); setResetPasswordInput(""); }}
                    className="px-3.5 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isResettingPassword || !resetPasswordInput.trim()} 
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#2b61d6] text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isResettingPassword ? "Resetting..." : "Save New Password"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
