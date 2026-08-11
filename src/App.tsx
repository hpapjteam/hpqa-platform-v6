import { useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { CampaignSetup } from "./pages/CampaignSetup";
import { Campaigns } from "./pages/Campaigns";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { savePreLoginRedirectUrl } from "@/lib/url-redirect";
import { Settings } from "./pages/Settings";
import { UsersList } from "./pages/Users";
import { Checklists } from "./pages/Checklists";
import { Reports } from "./pages/Reports";
import { RecycleBin } from "./pages/RecycleBin";
import { DatabaseRequirementScreen } from "./components/DatabaseRequirementScreen";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>("user");
  const [userEmail, setUserEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const sessionCheckSeq = useRef(0);

  const dbConnected = isSupabaseConfigured();

  const checkAuthSession = useCallback(async () => {
    const currentSeq = ++sessionCheckSeq.current;

    // 1. Check local app session first (for fast switch / impersonation / custom login)
    const localSessStr = localStorage.getItem("active_app_session");
    if (localSessStr) {
      try {
        const localSess = JSON.parse(localSessStr);
        if (localSess && localSess.email) {
          if (currentSeq === sessionCheckSeq.current) {
            setIsAuthenticated(true);
            setUserEmail(localSess.email.trim().toLowerCase());
            setUserRole(localSess.role || "user");
            setIsLoading(false);
          }
          return;
        }
      } catch (e) {}
    }

    // 2. Fallback to Supabase Auth session
    if (dbConnected) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user && currentSeq === sessionCheckSeq.current) {
          const email = (session.user.email || "").trim().toLowerCase();
          let role = session.user.user_metadata?.role;
          if (!role && email) {
            const { data: appUser } = await supabase.from('app_users').select('role').eq('email', email).maybeSingle();
            if (appUser?.role) role = appUser.role;
          }
          const finalRole = role || "admin";

          // Seamlessly sync active_app_session to localStorage
          localStorage.setItem("active_app_session", JSON.stringify({
            email,
            role: finalRole,
            name: session.user.user_metadata?.name || email.split('@')[0],
            timestamp: new Date().toISOString()
          }));

          setIsAuthenticated(true);
          setUserEmail(email);
          setUserRole(finalRole);
          setIsLoading(false);
          return;
        }
      } catch (e) {}
    }

    if (currentSeq === sessionCheckSeq.current) {
      setIsAuthenticated(false);
      setUserEmail("");
      setUserRole("user");
      setIsLoading(false);
    }
  }, [dbConnected]);

  useEffect(() => {
    // Clean up any legacy demo auth state
    localStorage.removeItem("demo_auth_active");
    localStorage.removeItem("demo_auth_role");
    localStorage.removeItem("demo_auth_email");
    localStorage.removeItem("mockAuth");
    localStorage.removeItem("mockAuthEmail");
    localStorage.removeItem("platform_users");

    if (!dbConnected) {
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    checkAuthSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && session.user) {
        const email = (session.user.email || "").trim().toLowerCase();
        const role = session.user.user_metadata?.role || "admin";
        
        localStorage.setItem("active_app_session", JSON.stringify({
          email,
          role,
          name: session.user.user_metadata?.name || email.split('@')[0],
          timestamp: new Date().toISOString()
        }));

        setIsAuthenticated(true);
        setUserEmail(email);
        setUserRole(role);
        setIsLoading(false);
      } else {
        checkAuthSession();
      }
    });

    const handleAuthEvent = () => {
      checkAuthSession();
    };

    window.addEventListener("app_auth_changed", handleAuthEvent);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("app_auth_changed", handleAuthEvent);
    };
  }, [dbConnected, checkAuthSession]);

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      const currentPath = window.location.pathname + window.location.search + window.location.hash;
      if (currentPath && currentPath !== "/" && !currentPath.startsWith("/login") && !currentPath.startsWith("/signup")) {
        savePreLoginRedirectUrl(currentPath);
      }
    }
  }, [isAuthenticated, isLoading]);

  if (!dbConnected) {
    return <DatabaseRequirementScreen />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white font-sans text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {!isAuthenticated ? (
          <>
            <Route path="/signup" element={<Signup />} />
            <Route path="*" element={<Login onLogin={() => checkAuthSession()} />} />
          </>
        ) : (
          <Route path="/" element={<AppLayout role={userRole} userEmail={userEmail} />}>
            <Route index element={<Dashboard userEmail={userEmail} userRole={userRole} />} />
            <Route path="campaigns/new" element={<CampaignSetup userEmail={userEmail} userRole={userRole} />} />
            <Route path="campaigns" element={<Campaigns userEmail={userEmail} userRole={userRole} />} />
            <Route path="campaign" element={<Navigate to="/campaigns" replace />} />
            <Route path="recycle-bin" element={<RecycleBin userEmail={userEmail} userRole={userRole} />} />
            <Route path="reports" element={<Reports />} />
            <Route path="users" element={userRole === "admin" ? <UsersList /> : <Navigate to="/" replace />} />
            <Route path="settings" element={<Settings role={userRole} userEmail={userEmail} />} />
            <Route path="checklists" element={userRole === "admin" ? <Checklists role={userRole} /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </Router>
  );
}

