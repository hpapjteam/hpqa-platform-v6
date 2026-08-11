import React, { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { savePreLoginRedirectUrl, executePostLoginRedirect } from "@/lib/url-redirect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, AlertCircle, Zap, ShieldCheck, UserCheck, Shield, User } from "lucide-react";

export function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [quickLoginEnabled, setQuickLoginEnabled] = useState(true);
  const [quickUsers, setQuickUsers] = useState<any[]>([]);

  const dbConfigured = isSupabaseConfigured();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectParam = params.get("redirect") || params.get("next");
    if (redirectParam) {
      savePreLoginRedirectUrl(decodeURIComponent(redirectParam));
    }

    const isEnabled = localStorage.getItem("quick_login_enabled") !== "false";
    setQuickLoginEnabled(isEnabled);

    const loadQuickUsers = async () => {
      let dbUsers: any[] = [];
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('app_users').select('*').neq('status', 'banned');
          if (!error && data) {
            dbUsers = data;
          }
        } catch (e) {
          console.error("Error loading quick users from DB:", e);
        }
      }

      let localUsers: any[] = [];
      const cached = localStorage.getItem("local_app_users");
      if (cached) {
        try { localUsers = JSON.parse(cached); } catch (e) {}
      } else {
        // Default initial users if cache is clean
        localUsers = [
          { id: "u1", name: "Admin User", email: "cbogineni@zetaglobal.com", role: "admin", team: "HP-APJ", status: "active", quick_login_enabled: true },
          { id: "u2", name: "QA User", email: "hpapjteam@gmail.com", role: "user", team: "HP-APJ", status: "active", quick_login_enabled: true }
        ];
        localStorage.setItem("local_app_users", JSON.stringify(localUsers));
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
          
          // If local has explicit quick_login_enabled property, respect local user preference, else use combined
          const isQuick = local.hasOwnProperty('quick_login_enabled') ? localQuick : (localQuick || dbQuick);

          userMap.set(key, {
            ...local,
            ...u,
            email: key,
            quick_login_enabled: isQuick
          });
        }
      }

      const sourceList = Array.from(userMap.values());
      const filtered = sourceList.filter((u: any) => 
        (u.quick_login_enabled === true || u.quick_login_enabled === 'true' || u.quick_login_enabled === 1) && 
        u.status !== 'banned'
      );

      setQuickUsers(filtered);
    };

    loadQuickUsers();
  }, []);

  const completeLoginSession = async (userEmail: string, userRole?: string, userName?: string) => {
    const cleanEmail = userEmail.trim().toLowerCase();
    
    let finalRole = userRole;
    let finalName = userName;

    if (!finalRole || !finalName) {
      try {
        const { data: dbUser } = await supabase.from('app_users').select('*').eq('email', cleanEmail).maybeSingle();
        if (dbUser) {
          if (dbUser.status === 'banned') {
            throw new Error("This account has been suspended or banned. Please contact an administrator.");
          }
          finalRole = dbUser.role || finalRole;
          finalName = dbUser.name || finalName;
        }
      } catch (err: any) {
        if (err.message?.includes("suspended") || err.message?.includes("banned")) throw err;
      }
    }

    if (!finalRole) {
      finalRole = cleanEmail.includes("admin") || cleanEmail.includes("cbogineni") ? "admin" : "user";
    }
    if (!finalName) {
      finalName = cleanEmail.split('@')[0];
    }

    const sessionObj = {
      email: cleanEmail,
      role: finalRole,
      name: finalName,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem("active_app_session", JSON.stringify(sessionObj));

    try {
      await supabase.from('app_users').update({
        last_login: new Date().toISOString()
      }).eq('email', cleanEmail);
    } catch (e) {}

    window.dispatchEvent(new Event("app_auth_changed"));
    if (onLogin) onLogin();
    executePostLoginRedirect();
  };

  const handleQuickLogin = async (quickEmail: string, role?: string, name?: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: dbUser } = await supabase.from('app_users').select('*').eq('email', quickEmail).maybeSingle();
      if (dbUser && dbUser.status === 'banned') {
        setError("This account has been suspended or banned.");
        setLoading(false);
        return;
      }

      await completeLoginSession(quickEmail, role || dbUser?.role, name || dbUser?.name);
    } catch (err: any) {
      setError(err.message || "An error occurred during quick login.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      // Check if user exists in DB first
      const { data: dbUser } = await supabase.from('app_users').select('*').eq('email', cleanEmail).maybeSingle();

      if (!dbUser) {
        setError("User not found. Please contact admin for password reset.");
        setLoading(false);
        return;
      }

      if (dbUser.status === 'banned') {
        setError("This account has been suspended or banned. Please contact an administrator.");
        setLoading(false);
        return;
      }

      const resetUrl = `${window.location.origin}/reset-password?email=${encodeURIComponent(cleanEmail)}`;
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, resetUrl })
      });
      if (!response.ok) throw new Error("Failed to send reset email");
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || "Error sending reset email");
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const { data: dbUser } = await supabase.from('app_users').select('*').eq('email', cleanEmail).maybeSingle();

      if (dbUser && dbUser.status === 'banned') {
        setError("This account has been suspended or banned. Please contact an administrator.");
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (!signInError) {
        await completeLoginSession(cleanEmail, dbUser?.role, dbUser?.name);
        setLoading(false);
        return;
      }

      // Check matching stored user password
      const isUserPassMatch = dbUser && (password === dbUser.password_hash || password === dbUser.password);

      if (isUserPassMatch) {
        await supabase.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: { name: dbUser?.name || cleanEmail.split('@')[0], role: dbUser?.role || "user" }
          }
        }).catch(() => {});

        await completeLoginSession(cleanEmail, dbUser?.role || "user", dbUser?.name);
        setLoading(false);
        return;
      }

      setError("Invalid email or password.");
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen font-sans bg-white">
      {/* Left Column - Form */}
      <div className="w-full lg:w-[450px] xl:w-[500px] flex flex-col justify-between p-8 lg:p-12 shrink-0 bg-white z-10 relative">
        
        {/* Login Form */}
        <div className="w-full max-w-sm mx-auto flex flex-col justify-center flex-1 my-auto">
          <div className="flex justify-center mb-6">
            <img 
              src="https://zetaglobal.com/wp-content/uploads/2023/02/zeta_logoPrimary.svg" 
              alt="Zeta Global" 
              className="h-10"
            />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            {isForgotPassword ? "Reset Password" : "Welcome"}
          </h1>

          {quickLoginEnabled && !isForgotPassword && quickUsers.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                  One-Click Quick Login
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
                  Real Auth
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickUsers.map((qu) => {
                  const isAdmin = qu.role === "admin";
                  return (
                    <div
                      key={qu.id || qu.email}
                      className="p-3 bg-white border border-blue-200 rounded-lg text-left shadow-2xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 text-[11px] truncate" title={qu.email}>
                          {qu.email}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-bold border inline-flex items-center gap-1",
                            isAdmin ? "bg-purple-100 text-purple-800 border-purple-200" : "bg-blue-100 text-blue-800 border-blue-200"
                          )}>
                            {isAdmin ? (
                              <>
                                <Shield className="w-2.5 h-2.5 text-purple-600" />
                                <span>Admin</span>
                              </>
                            ) : (
                              <>
                                <User className="w-2.5 h-2.5 text-blue-600" />
                                <span>User</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid="quick-login-button"
                        onClick={() => handleQuickLogin(qu.email, qu.role || "user", qu.name)}
                        className="px-3 py-1.5 bg-[#2b61d6] hover:bg-blue-700 text-white font-bold text-xs rounded-md transition-all cursor-pointer shrink-0 shadow-2xs"
                      >
                        Log in
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!dbConfigured && !quickLoginEnabled && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-slate-900 block mb-0.5">Running in Local Storage Mode</strong>
                  Supabase database environment variables are not configured.
                </div>
              </div>
            </div>
          )}
          
          {isForgotPassword ? (
            resetSent ? (
              <div className="text-center space-y-4">
                <div className="p-4 bg-green-50 text-green-700 rounded-lg text-sm">
                  Password reset link has been sent to your email.
                </div>
                <Button variant="outline" className="w-full" onClick={() => { setIsForgotPassword(false); setResetSent(false); }}>
                  Return to Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-6">
                {error && (
                  <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive font-medium text-center border border-destructive/20">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-blue-50 border-slate-200 text-slate-900 focus-visible:ring-[#2b61d6] shadow-none h-11"
                  />
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <Button type="submit" className="bg-[#2b61d6] hover:bg-blue-700 text-white w-full h-10 shadow-sm" disabled={loading || !email}>
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setIsForgotPassword(false)}>
                    Back to Login
                  </Button>
                </div>
              </form>
            )
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div data-testid="login-error-alert" className="p-3 text-sm rounded-md bg-destructive/10 text-destructive font-medium text-center border border-destructive/20">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email</Label>
                <Input
                  id="email"
                  data-testid="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-blue-50 border-slate-200 text-slate-900 focus-visible:ring-[#2b61d6] shadow-none h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    data-testid="login-password-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-blue-50 border-slate-200 text-slate-900 focus-visible:ring-[#2b61d6] shadow-none pr-10 h-11"
                  />
                  <button 
                    type="button" 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={() => setIsForgotPassword(true)} className="text-sm text-[#2b61d6] hover:underline font-medium">
                  Forgot password?
                </button>
                <Button type="submit" data-testid="login-submit-button" className="bg-[#2b61d6] hover:bg-blue-700 text-white px-8 h-10 shadow-sm cursor-pointer" disabled={loading || !email || !password}>
                  {loading ? "Logging in..." : "Log in"}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Footer text */}
        <div className="text-xs text-slate-500 text-center">
          © 2001 - 2026 ZETA. All rights reserved | <a href="https://zetaglobal.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-[#2b61d6] hover:underline font-medium">Privacy Policy</a>
        </div>
      </div>

      {/* Right Column - Graphic */}
      <div className="hidden lg:block flex-1 relative bg-slate-900 overflow-hidden">
         <div className="absolute inset-0 " style={{
           backgroundImage: `url('https://zetaglobal.com/wp-content/uploads/2025/07/life-at-zeta-hero.png')`,
           backgroundSize: 'cover',
           backgroundPosition: 'center',
         }}></div>
         
         <div className="absolute inset-0 flex flex-col justify-end p-16 pb-24">
            <div className="text-white text-left max-w-lg z-10 drop-shadow-md">
               <h2 className="text-4xl font-bold mb-4">Empower your QA Workflow</h2>
               <p className="text-lg text-blue-100">Automate validations, streamline approvals, and launch campaigns with absolute confidence.</p>
            </div>
         </div>
      </div>
    </div>
  );
}

