import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, FileText, BarChart2, Users, Settings, LogOut, ChevronLeft, ChevronRight, Trash2, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { clearPostLoginRedirectUrl } from "@/lib/url-redirect";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Campaigns", href: "/campaigns", icon: FileText },
  { name: "Recycle Bin", href: "/recycle-bin", icon: Trash2 },
  { name: "Reports", href: "/reports", icon: BarChart2 },
  { name: "Checklists", href: "/checklists", icon: CheckSquare, adminOnly: true },
  
  { name: "User Management", href: "/users", icon: Users, adminOnly: true },
  { name: "My Profile & Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ role, userEmail }: { role: string; userEmail?: string }) {
  const location = useLocation();
  const isAdmin = role === "admin";
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [logos, setLogos] = useState({ expanded: "https://zetaglobal.com/wp-content/uploads/2023/02/zeta_logoPrimary.svg", collapsed: "https://companieslogo.com/img/orig/ZETA-424536bc.png" });
  const [profile, setProfile] = useState({
    name: isAdmin ? "Admin User" : "QA User",
    team: "HP-APJ",
    avatar: ""
  });

  // Auto-collapse sidebar on campaign setup page or small screen for focused workspace
  useEffect(() => {
    const isSetupPage = location.pathname.startsWith("/campaigns/new");
    if (isSetupPage || window.innerWidth < 1024) {
      setIsCollapsed(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    async function fetchLogos() {
      const { data } = await supabase.from('app_settings').select('*').limit(1).single();
      if (data) {
        if (data.expanded_logo_url) setLogos(prev => ({ ...prev, expanded: data.expanded_logo_url }));
        if (data.collapsed_logo_url) setLogos(prev => ({ ...prev, collapsed: data.collapsed_logo_url }));
      }
    }
    fetchLogos();
  }, []);

  const loadProfileData = () => {
    const key = userEmail ? "settings_profile_" + userEmail : "settings_profile_" + role;
    const saved = localStorage.getItem(key) || localStorage.getItem("settings_profile_" + role);
    if (saved) {
      try {
        setProfile(JSON.parse(saved));
      } catch (e) {}
    } else {
      // Check local_app_users
      const cachedUsers = localStorage.getItem("local_app_users");
      if (cachedUsers) {
        try {
          const parsed = JSON.parse(cachedUsers);
          const found = parsed.find((u: any) => u.email === userEmail);
          if (found) {
            setProfile({
              name: found.name || (isAdmin ? "Admin User" : "QA User"),
              team: found.team || "HP-APJ",
              avatar: found.avatar || ""
            });
          }
        } catch (e) {}
      }
    }
  };

  useEffect(() => {
    loadProfileData();
    window.addEventListener("profile_updated", loadProfileData);
    return () => window.removeEventListener("profile_updated", loadProfileData);
  }, [role, userEmail]);

  const handleLogout = async () => {
    clearPostLoginRedirectUrl();
    localStorage.removeItem("active_app_session");
    localStorage.removeItem("mockAuth");
    localStorage.removeItem("campaign_form_autosave");
    localStorage.removeItem("campaign_draft");
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    window.history.replaceState({}, '', '/');
    window.dispatchEvent(new Event("app_auth_changed"));
    window.location.href = "/";
  };

  // Determine effective display state
  const effectivelyExpanded = isHovered;

  return (
    <div className="flex-shrink-0 relative transition-all duration-300 w-20">
      <aside 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "bg-white text-slate-800 flex flex-col z-[100] transition-all duration-300 absolute left-0 top-0 bottom-0 border-r border-slate-200 shadow-xl overflow-hidden",
          effectivelyExpanded ? "w-64 shadow-2xl" : "w-20"
        )}
      >
        
        <div className={cn("p-6 pb-4 overflow-hidden whitespace-nowrap border-b border-black/10 shrink-0", !effectivelyExpanded ? "px-4" : "")}>
          <img 
            src={!effectivelyExpanded ? logos.collapsed : logos.expanded} 
            alt="Zeta Logo" 
            className={cn("transition-all object-contain mb-2", !effectivelyExpanded ? "h-6 w-full" : "h-8")}
          />
          {effectivelyExpanded && <h1 className="text-[11px] font-bold text-white uppercase tracking-widest mt-1">HP-QA Platform</h1>}
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 overflow-x-hidden">
          <nav className={cn("flex-1 space-y-1.5", !effectivelyExpanded ? "px-2" : "px-4")}>
            {NAV_ITEMS.map((item) => {
              if (item.adminOnly && !isAdmin) return null;
              
              const isActive = location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  title={!effectivelyExpanded ? item.name : undefined}
                  className={cn(
                    "flex items-center rounded-xl transition-all text-sm font-semibold",
                    !effectivelyExpanded ? "justify-center p-3" : "px-3.5 py-2.5 space-x-3",
                    isActive 
                      ? "bg-slate-900 text-white shadow-md shadow-slate-900/20" 
                      : "text-slate-800 hover:bg-black/10 hover:text-black"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-white" : "text-slate-700")} />
                  {effectivelyExpanded && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className={cn("p-4 flex flex-col gap-2 border-t border-black/10 bg-white/40 shrink-0", !effectivelyExpanded ? "items-center px-2" : "")}>
          <div className={cn("flex items-center rounded-xl bg-white/60 p-2 border border-black/5", !effectivelyExpanded ? "justify-center border-none bg-transparent p-0" : "space-x-3")}>
            <div className="w-9 h-9 shrink-0 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white text-xs overflow-hidden shadow-xs">
              {profile.avatar ? (
                <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                profile.name.substring(0, 2).toUpperCase()
              )}
            </div>
            {effectivelyExpanded && (
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-slate-900 leading-none mb-1 truncate">{profile.name}</p>
                
              </div>
            )}
          </div>
          
          <button 
            data-testid="logout-button"
            onClick={handleLogout}
            title={!effectivelyExpanded ? "Logout" : undefined}
            className={cn(
              "flex items-center rounded-lg font-semibold text-slate-700 transition-all hover:bg-rose-500/10 hover:text-rose-600 cursor-pointer",
              !effectivelyExpanded ? "justify-center p-3 mt-2" : "w-full gap-2 px-3 py-2 text-xs mt-1"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0 text-rose-500" />
            {effectivelyExpanded && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </div>
  );
}
