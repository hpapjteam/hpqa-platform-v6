import React, { useState, useEffect } from "react";
import * as Sentry from '@sentry/react';
import { Link, useNavigate } from "react-router-dom";
import { getAllCampaigns, CampaignRecord, isSupabaseConfigured } from "@/lib/campaign-storage";
import { 
  PlusCircle, 
  Mail, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Globe, 
  FileText, 
  MoreVertical, 
  ArrowRight,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

import { supabase } from "@/lib/supabase";

interface DashboardProps {
  userEmail?: string;
  userRole?: string;
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-2xs relative overflow-hidden">
            <div className="flex justify-between items-start mb-3">
              <div className="h-4 w-24 bg-slate-200 rounded-md animate-pulse"></div>
              <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse"></div>
            </div>
            <div className="h-8 w-16 bg-slate-200 rounded-md animate-pulse mt-2"></div>
            <div className="h-3 w-32 bg-slate-100 rounded-md animate-pulse mt-4"></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex flex-col justify-between h-[280px]">
          <div className="h-5 w-36 bg-slate-200 rounded-md animate-pulse mb-6"></div>
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-8">
            <div className="w-40 h-40 rounded-full bg-slate-100 animate-pulse shrink-0"></div>
            <div className="flex-1 space-y-4 w-full">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200 animate-pulse"></div>
                    <div className="h-4 w-20 bg-slate-200 rounded-md animate-pulse"></div>
                  </div>
                  <div className="h-4 w-12 bg-slate-200 rounded-md animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex flex-col justify-between h-[280px]">
          <div className="flex justify-between items-center mb-6">
            <div className="h-5 w-40 bg-slate-200 rounded-md animate-pulse"></div>
            <div className="h-4 w-16 bg-slate-100 rounded-md animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-slate-200 animate-pulse"></div>
                    <div className="h-4 w-16 bg-slate-200 rounded-md animate-pulse"></div>
                  </div>
                  <div className="h-4 w-8 bg-slate-200 rounded-md animate-pulse"></div>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden flex flex-col relative">
        <div className="p-5 border-b border-slate-200/80 flex items-center justify-between">
          <div className="h-5 w-32 bg-slate-200 rounded-md animate-pulse"></div>
          <div className="flex gap-2">
            <div className="h-8 w-24 bg-slate-100 rounded-lg animate-pulse"></div>
            <div className="h-8 w-24 bg-slate-100 rounded-lg animate-pulse"></div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div className="flex flex-col gap-2 w-1/3">
                <div className="h-4 w-48 bg-slate-200 rounded-md animate-pulse"></div>
                <div className="h-3 w-32 bg-slate-100 rounded-md animate-pulse"></div>
              </div>
              <div className="h-6 w-24 bg-slate-100 rounded-full animate-pulse"></div>
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full bg-slate-200 animate-pulse"></div>
                <div className="w-6 h-6 rounded-full bg-slate-200 animate-pulse"></div>
                <div className="w-6 h-6 rounded-full bg-slate-200 animate-pulse"></div>
              </div>
              <div className="h-4 w-20 bg-slate-200 rounded-md animate-pulse"></div>
              <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function Dashboard({ userEmail, userRole }: DashboardProps) {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("7");
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserName = async () => {
      if (userEmail && import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co') {
        const { data } = await supabase.from('app_users').select('name').eq('email', userEmail).single();
        if (data && data.name) {
          setUserName(data.name.split(' ')[0]);
        }
      }
    };
    fetchUserName();
  }, [userEmail]);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getAllCampaigns();
        const active = data.filter(c => !c.is_deleted);
        setCampaigns(active);
      } catch (err) {
        console.error("[Dashboard] Error loading campaign data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();

    const handleSynced = () => {
      loadData();
    };

    window.addEventListener("database-synced", handleSynced);
    window.addEventListener("focus", loadData);
    window.addEventListener("storage", handleSynced);
    const pollInterval = setInterval(loadData, 10000);

    let realtimeChannel: any = null;
    if (isSupabaseConfigured()) {
      try {
        realtimeChannel = supabase
          .channel("dashboard-realtime-changes")
          .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, () => {
            console.log("[Dashboard] Supabase realtime change detected, refreshing dashboard...");
            loadData();
          })
          .subscribe();
      } catch (err) {
        console.warn("[Dashboard] Could not subscribe to Supabase Realtime:", err);
      }
    }

    return () => {
      window.removeEventListener("database-synced", handleSynced);
      window.removeEventListener("focus", loadData);
      window.removeEventListener("storage", handleSynced);
      clearInterval(pollInterval);
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, []);

  // Time-based greeting logic
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const getDisplayName = () => {
    if (userName) return userName;
    if (!userEmail) return "Admin";
    if (userEmail.includes("hpapjteam")) return "Admin";
    const namePart = userEmail.split("@")[0];
    const firstPart = namePart.split(/[._-]/)[0];
    return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
  };

  // Metrics calculation
  const total = campaigns.length;
  const pending = campaigns.filter(c => c.status === "QA Pending" || c.status === "Review Pending" || c.status === "Pending").length;
  const completed = campaigns.filter(c => c.status === "Completed" || c.status === "Approved").length;
  const failed = campaigns.filter(c => c.status === "Failed").length;
  const inProgress = campaigns.filter(c => c.status === "In Progress" || c.status === "Draft" || c.status === "Automating").length;

  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Status breakdown for Donut Chart
  const pendingPercent = total > 0 ? Math.round((pending / total) * 100) : 0;
  const completedPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const failedPercent = total > 0 ? Math.round((failed / total) * 100) : 0;
  const inProgressPercent = total > 0 ? Math.round((inProgress / total) * 100) : 0;

  // Country metrics
  const countryCounts: Record<string, number> = {};
  campaigns.forEach(c => {
    const code = (c.country || "IN").toUpperCase();
    countryCounts[code] = (countryCounts[code] || 0) + 1;
  });

  const countryConfig: { code: string; label: string; color: string; barColor: string }[] = [
    { code: "IN", label: "India", color: "text-blue-600", barColor: "bg-blue-600" },
    { code: "AU", label: "Australia", color: "text-purple-600", barColor: "bg-purple-600" },
    { code: "NZ", label: "New Zealand", color: "text-emerald-600", barColor: "bg-emerald-600" },
    { code: "SG", label: "Singapore", color: "text-amber-500", barColor: "bg-amber-500" },
    { code: "MY", label: "Malaysia", color: "text-violet-500", barColor: "bg-violet-500" },
    { code: "OTHERS", label: "Others", color: "text-slate-500", barColor: "bg-slate-400" },
  ];

  // Calculate others count
  const knownCodes = ["IN", "AU", "NZ", "SG", "MY"];
  const othersCount = Object.keys(countryCounts)
    .filter(k => !knownCodes.includes(k))
    .reduce((acc, k) => acc + countryCounts[k], 0);

  const getCountryCount = (code: string) => {
    if (code === "OTHERS") return othersCount;
    return countryCounts[code] || 0;
  };

  const maxCountryCount = Math.max(1, ...countryConfig.map(c => getCountryCount(c.code)));

  // Filter recent campaigns
  const filteredCampaigns = campaigns.filter(c => {
    if (selectedCountry !== "all" && c.country.toUpperCase() !== selectedCountry.toUpperCase()) {
      return false;
    }
    if (selectedTimeframe !== "all") {
      const days = parseInt(selectedTimeframe, 10);
      const createdTime = new Date(c.created_at || c.updated_at || Date.now()).getTime();
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      if (createdTime < cutoff) return false;
    }
    return true;
  }).slice(0, 7);

  const formatDate = (isoString?: string) => {
    if (!isoString) return "Recent";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Recent";
    const dateStr = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    return `${dateStr} ${timeStr}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completed":
      case "Approved":
        return {
          label: "Completed",
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          progress: 100,
          progressColor: "bg-emerald-500"
        };
      case "QA Pending":
      case "Review Pending":
        return {
          label: "QA Pending",
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          progress: 0,
          progressColor: "bg-slate-200"
        };
      case "In Progress":
      case "Automating":
        return {
          label: "In Progress",
          bg: "bg-amber-50 text-amber-700 border-amber-200",
          progress: 45,
          progressColor: "bg-amber-500"
        };
      case "Failed":
        return {
          label: "Failed",
          bg: "bg-rose-50 text-rose-700 border-rose-200",
          progress: 100,
          progressColor: "bg-rose-500"
        };
      case "Draft":
        return {
          label: "Draft",
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          progress: 0,
          progressColor: "bg-slate-300"
        };
      default:
        return {
          label: status || "Draft",
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          progress: 0,
          progressColor: "bg-slate-300"
        };
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/70">
      {/* Top Header Bar */}
      <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-2xs sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            {getGreeting()}, {getDisplayName()}
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Welcome to HP QA Platform
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/campaigns/new"
            className="px-4 py-2 bg-[#2b61d6] hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            New Campaign
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full flex-1">
        {isLoading ? <DashboardSkeleton /> : (
          <>
            {/* Top 4 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Campaigns */}
          <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-semibold text-slate-500">Total Campaigns</span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-[#2b61d6] shadow-2xs">
                <Mail className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{total}</span>
              {/* Mini Sparkline SVG */}
              <svg className="w-16 h-8 text-blue-500" viewBox="0 0 60 25" fill="none">
                <path d="M2 20 L 15 14 L 30 18 L 45 8 L 58 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-[11px] font-semibold text-emerald-600 mt-2 flex items-center gap-1">
              <span>↑ 18%</span>
              <span className="text-slate-400 font-normal">from last month</span>
            </p>
          </div>

          {/* Pending QA */}
          <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-semibold text-slate-500">Pending QA</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shadow-2xs">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{pending}</span>
              {/* Mini Sparkline SVG */}
              <svg className="w-16 h-8 text-amber-500" viewBox="0 0 60 25" fill="none">
                <path d="M2 18 L 18 18 L 32 10 L 48 14 L 58 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-[11px] font-bold text-amber-600 mt-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              High Priority
            </p>
          </div>

          {/* Completed QA */}
          <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-semibold text-slate-500">Completed QA</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 shadow-2xs">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{completed}</span>
              {/* Mini Sparkline SVG */}
              <svg className="w-16 h-8 text-emerald-500" viewBox="0 0 60 25" fill="none">
                <path d="M2 20 L 15 15 L 28 22 L 42 10 L 58 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-[11px] font-semibold text-emerald-600 mt-2">
              {successRate}% <span className="text-slate-400 font-normal">Success rate</span>
            </p>
          </div>

          {/* Failed QA */}
          <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-semibold text-slate-500">Failed QA</span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 shadow-2xs">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{failed}</span>
              {/* Mini Sparkline SVG */}
              <svg className="w-16 h-8 text-rose-500" viewBox="0 0 60 25" fill="none">
                <path d="M2 12 L 15 18 L 28 12 L 42 22 L 58 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-[11px] font-semibold text-rose-600 mt-2">
              Needs attention
            </p>
          </div>
        </div>

        {/* Middle Section: Overview & Countries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QA Status Overview Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">QA Status Overview</h3>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
              {/* Custom SVG Donut Chart */}
              <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background Circle */}
                  <circle cx="50" cy="50" r="38" stroke="#f1f5f9" strokeWidth="12" fill="none" />

                  {/* Arcs calculation */}
                  {total > 0 ? (
                    (() => {
                      const circumference = 2 * Math.PI * 38; // ~238.76
                      let offset = 0;

                      const cStroke = (completed / total) * circumference;
                      const pStroke = (pending / total) * circumference;
                      const fStroke = (failed / total) * circumference;
                      const iStroke = (inProgress / total) * circumference;

                      const segments = [
                        { stroke: cStroke, color: "#10b981" }, // Completed (Green)
                        { stroke: pStroke, color: "#f59e0b" }, // Pending (Amber)
                        { stroke: fStroke, color: "#ef4444" }, // Failed (Red)
                        { stroke: iStroke, color: "#2563eb" }, // In Progress (Blue)
                      ];

                      return segments.map((seg, idx) => {
                        const dashArray = `${seg.stroke} ${circumference - seg.stroke}`;
                        const currentOffset = offset;
                        offset += seg.stroke;
                        return (
                          <circle
                            key={idx}
                            cx="50"
                            cy="50"
                            r="38"
                            stroke={seg.color}
                            strokeWidth="12"
                            strokeDasharray={dashArray}
                            strokeDashoffset={-currentOffset}
                            fill="none"
                            className="transition-all duration-500"
                          />
                        );
                      });
                    })()
                  ) : (
                    <circle cx="50" cy="50" r="38" stroke="#cbd5e1" strokeWidth="12" fill="none" />
                  )}
                </svg>

                {/* Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{total}</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total</span>
                </div>
              </div>

              {/* Legend List */}
              <div className="flex-1 space-y-3 w-full">
                <div className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="font-semibold text-slate-700">Completed</span>
                  </div>
                  <span className="font-bold text-slate-900">{completed} <span className="text-slate-400 font-normal">({completedPercent}%)</span></span>
                </div>

                <div className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                    <span className="font-semibold text-slate-700">Pending</span>
                  </div>
                  <span className="font-bold text-slate-900">{pending} <span className="text-slate-400 font-normal">({pendingPercent}%)</span></span>
                </div>

                <div className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                    <span className="font-semibold text-slate-700">Failed</span>
                  </div>
                  <span className="font-bold text-slate-900">{failed} <span className="text-slate-400 font-normal">({failedPercent}%)</span></span>
                </div>

                <div className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"></span>
                    <span className="font-semibold text-slate-700">In Progress</span>
                  </div>
                  <span className="font-bold text-slate-900">{inProgress} <span className="text-slate-400 font-normal">({inProgressPercent}%)</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* Campaigns by Country Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Campaigns by Country</h3>
              </div>
              <Link to="/campaigns" className="text-xs font-semibold text-[#2b61d6] hover:underline flex items-center gap-1">
                View All
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 py-1">
              {countryConfig.map((item) => {
                const count = getCountryCount(item.code);
                const percent = Math.min(100, Math.round((count / maxCountryCount) * 100));

                return (
                  <div key={item.code} className="space-y-1.5 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">{item.code}</span>
                      <span className="font-bold text-slate-900">{count}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", item.barColor)}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Section: Recent Active Campaigns */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
          {/* Header & Filters */}
          <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#2b61d6] flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Recent Active Campaigns</h3>
            </div>

            <div className="flex items-center gap-3">
              {/* Country Select */}
              <div className="relative">
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="appearance-none bg-white border border-slate-300 rounded-lg pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                >
                  <option value="all">All Countries</option>
                  <option value="IN">India (IN)</option>
                  <option value="AU">Australia (AU)</option>
                  <option value="NZ">New Zealand (NZ)</option>
                  <option value="SG">Singapore (SG)</option>
                  <option value="MY">Malaysia (MY)</option>
                </select>
                <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Date Select */}
              <div className="relative">
                <select
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value)}
                  className="appearance-none bg-white border border-slate-300 rounded-lg pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                >
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="all">All Time</option>
                </select>
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/80 border-b border-slate-200">
                  <th className="px-6 py-3">Campaign Name</th>
                  <th className="px-6 py-3">Country</th>
                  <th className="px-6 py-3">Created By</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Progress</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      Loading dynamic campaign metrics...
                    </td>
                  </tr>
                ) : filteredCampaigns.length > 0 ? (
                  filteredCampaigns.map((campaign) => {
                    const badge = getStatusBadge(campaign.status);

                    return (
                      <tr key={campaign.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Name */}
                        <td className="px-6 py-4 font-bold text-slate-900">
                          <button
                            onClick={() => navigate(`/campaigns/new?id=${campaign.id}`)}
                            className="hover:text-[#2b61d6] hover:underline text-left line-clamp-1"
                          >
                            {campaign.name}
                          </button>
                        </td>

                        {/* Country */}
                        <td className="px-6 py-4 font-bold text-slate-800">
                          <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200 text-[11px] font-semibold text-slate-700">
                            <Globe className="w-3 h-3 text-slate-500" />
                            <span>{campaign.country || "IN"}</span>
                          </span>
                        </td>

                        {/* Created By */}
                        <td className="px-6 py-4 text-slate-600 font-medium">
                          {campaign.createdBy || campaign.userEmail?.split("@")[0] || "Admin User"}
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4 text-slate-500 font-medium">
                          {formatDate(campaign.created_at || campaign.updated_at)}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border", badge.bg)}>
                            {badge.label}
                          </span>
                        </td>

                        {/* Progress */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5 w-32">
                            <span className="text-[11px] font-bold text-slate-700 w-8">{badge.progress}%</span>
                            <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all duration-300", badge.progressColor)}
                                style={{ width: `${badge.progress}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="px-6 py-4 text-right relative">
                          <button
                            onClick={() => setActionMenuOpenId(actionMenuOpenId === campaign.id ? null : campaign.id)}
                            className="p-1 hover:bg-slate-200/80 rounded-md text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {actionMenuOpenId === campaign.id && (
                            <div className="absolute right-6 top-10 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1.5 w-40 text-left animate-in fade-in zoom-in-95">
                              <button
                                onClick={() => {
                                  setActionMenuOpenId(null);
                                  navigate(`/campaigns/new?id=${campaign.id}`);
                                }}
                                className="w-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                              >
                                Edit Campaign
                              </button>
                              <button
                                onClick={() => {
                                  setActionMenuOpenId(null);
                                  navigate(`/campaigns`);
                                }}
                                className="w-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                              >
                                Manage Folders
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-slate-500 text-xs">
                      No matching active campaigns found for the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer view all */}
          <div className="p-4 bg-slate-50/50 border-t border-slate-200/80 flex justify-center">
            <Link
              to="/campaigns"
              className="text-xs font-bold text-[#2b61d6] hover:text-indigo-800 flex items-center gap-1.5 hover:underline"
            >
              <span>View all campaigns</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
