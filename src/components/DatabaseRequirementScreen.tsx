import React, { useState } from "react";
import { Database, AlertTriangle, RefreshCw, Server, ExternalLink, Key } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";

export function DatabaseRequirementScreen({ onRetry }: { onRetry?: () => void }) {
  const [checking, setChecking] = useState(false);

  const handleRefresh = () => {
    setChecking(true);
    setTimeout(() => {
      if (onRetry) {
        onRetry();
      } else {
        window.location.reload();
      }
      setChecking(false);
    }, 600);
  };

  const isConfigured = isSupabaseConfigured();

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 md:p-8 font-sans text-slate-100">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-amber-500/20 border-b border-amber-500/30 p-6 md:p-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Database Connection Required
              </span>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                Connect Supabase Database
              </h1>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 space-y-6 text-slate-300 text-sm">
          <p className="leading-relaxed text-slate-300">
            This QA platform strictly operates with a real <strong className="text-white font-semibold">Supabase PostgreSQL database</strong>. Local memory storage and mock credential bypasses have been disabled to guarantee data safety across deployments.
          </p>

          {/* Current Connection Status */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
            <Server className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-white text-sm">Status: No Database Connected</div>
              <div className="text-xs text-slate-400">
                Environment variables <code className="text-amber-300 bg-amber-950/50 px-1.5 py-0.5 rounded font-mono">VITE_SUPABASE_URL</code> and <code className="text-amber-300 bg-amber-950/50 px-1.5 py-0.5 rounded font-mono">VITE_SUPABASE_ANON_KEY</code> are missing or set to placeholder values.
              </div>
            </div>
          </div>

          {/* Configuration Guide */}
          <div className="space-y-4">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-400" />
              How to Connect Database (Vercel & Local)
            </h3>

            {/* Vercel Steps */}
            <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-3">
              <div className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                Vercel Deployment Setup
              </div>
              <ol className="list-decimal pl-7 space-y-2 text-xs text-slate-300 leading-relaxed">
                <li>Go to your project dashboard on <strong>Vercel.com</strong> → <strong>Settings</strong> → <strong>Environment Variables</strong>.</li>
                <li>Add the following keys from your Supabase project settings (<a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-0.5">Supabase Dashboard <ExternalLink className="w-3 h-3" /></a>):
                  <div className="mt-2 bg-slate-900 border border-slate-800 p-3 rounded-xl font-mono text-[11px] space-y-1 text-slate-200">
                    <div><span className="text-blue-400 font-bold">VITE_SUPABASE_URL</span> = https://your-project.supabase.co</div>
                    <div><span className="text-blue-400 font-bold">VITE_SUPABASE_ANON_KEY</span> = eyJhbGciOiJIUzI1Ni...</div>
                  </div>
                </li>
                <li>Click <strong>Deployments</strong> → Select latest deployment → Click <strong>Redeploy</strong>.</li>
              </ol>
            </div>

            {/* Local .env Steps */}
            <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-3">
              <div className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                Local Development (.env)
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Create a <code className="text-emerald-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono">.env</code> file in the project root directory with your Supabase credentials, then restart the server.
              </p>
            </div>

            {/* SQL Setup Steps */}
            <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-3">
              <div className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                Create Supabase Database Tables
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Open <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Supabase SQL Editor</a>, copy and paste the contents of <code className="text-purple-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono">supabase_schema.sql</code>, and click <strong>Run</strong> to generate all tables (<code className="text-slate-400 font-mono">campaigns</code>, <code className="text-slate-400 font-mono">app_users</code>, <code className="text-slate-400 font-mono">teams</code>, <code className="text-slate-400 font-mono">countries</code>, <code className="text-slate-400 font-mono">activity_logs</code>).
              </p>
            </div>
          </div>

          {/* Refresh / Check Connection Button */}
          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={handleRefresh}
              disabled={checking}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
              {checking ? "Checking..." : "Check Connection & Reload"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
