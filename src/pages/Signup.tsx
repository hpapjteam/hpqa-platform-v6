import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Lock, User, Shield, CheckCircle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export function Signup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const email = searchParams.get("email") || "";
  const name = searchParams.get("name") || "";
  const team = searchParams.get("team") || "";
  const role = searchParams.get("role") || "user";
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!email) {
      setError("Invalid invitation link. No email provided.");
    }
  }, [email]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    if (!isSupabaseConfigured()) {
      setError("Database is not connected. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            team,
            role,
          }
        }
      });

      if (signUpError) throw signUpError;

      // Create app_users row in database
      await supabase.from('app_users').insert([{
        name,
        email,
        role,
        team,
        status: 'active',
        last_login: new Date().toISOString()
      }]);

      setSuccess(true);
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };


  if (success) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Account Created!</h2>
          <p className="text-slate-500 mb-6">Your account has been successfully set up.</p>
          <p className="text-sm text-slate-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Complete Setup</h2>
          <p className="mt-2 text-sm text-slate-500">Welcome to HP-QA Platform, {name}!</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email Address (from invite)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full flex h-10 rounded-md border border-slate-300 bg-slate-100 pl-10 px-3 py-2 text-sm text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Assigned Team</label>
                <div className="w-full flex h-10 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500 items-center">
                  {team || "N/A"}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Role</label>
                <div className="w-full flex h-10 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500 items-center capitalize">
                  {role}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Create Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full flex h-10 rounded-md border border-slate-300 bg-white pl-10 px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                  placeholder="••••••••"
                  required
                  disabled={!email}
                  minLength={6}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <Shield className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full flex h-10 rounded-md border border-slate-300 bg-white pl-10 px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                  placeholder="••••••••"
                  required
                  disabled={!email}
                  minLength={6}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full flex items-center justify-center h-10 rounded-md bg-[#2b61d6] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Setting up account..." : "Complete Setup"}
          </button>
        </form>
        
        <div className="text-center text-sm text-slate-500">
          Already have an account? <Link to="/" className="text-[#2b61d6] hover:underline font-medium">Log in</Link>
        </div>
        <div className="text-xs text-slate-400 text-center pt-2">
          © 2001 - 2026 ZETA. All rights reserved | <a href="https://zetaglobal.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-[#2b61d6] hover:underline font-medium">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
