import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  getAllCampaigns, 
  getFolders, 
  fetchFolders,
  createFolder, 
  renameFolder,
  deleteFolder,
  softDeleteCampaign, 
  restoreCampaign, 
  restoreAllCampaigns,
  permanentlyDeleteCampaign, 
  moveCampaignToFolder,
  syncAllCampaignsToDatabase,
  auditAndSyncCampaigns,
  isUUID,
  ensureUuid,
  SyncAuditResult,
  CampaignRecord, 
  FolderItem 
} from "@/lib/campaign-storage";
import { getCampaignCheckpointProgress } from "@/lib/checklist-utils";
import { logAction } from "@/lib/logger";
import { supabase, isSupabaseConfigured, ensureSupabaseInitialized } from "@/lib/supabase";
import { 
  PlusCircle, 
  Search, 
  Filter, 
  LayoutGrid, 
  List, 
  CheckCircle2, 
  XCircle, 
  History, 
  Trash2, 
  RotateCcw, 
  FolderPlus, 
  Folder, 
  FolderOpen, 
  Calendar, 
  Clock, 
  User, 
  MoveRight, 
  AlertTriangle,
  GripVertical,
  ChevronDown,
  RefreshCw,
  Database,
  ChevronRight,
  Home,
  ArrowLeft,
  X,
  Globe,
  ShieldCheck,
  Check,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  MoreVertical,
  Edit3,
  FolderInput,
  Lock,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminAuditLogModal } from "@/src/components/AdminAuditLogModal";

const TABS = [
  { id: "all", label: "All Campaigns" },
  { id: "inprogress", label: "In Progress" },
  { id: "approved", label: "Approved" },
  { id: "failed", label: "Failed" },
  { id: "recycle_bin", label: "Recycle Bin / Trash" }
];

export function Campaigns({ userEmail = "admin@example.com", userRole = "admin" }: { userEmail?: string; userRole?: string }) {
  const isAdmin = userRole === "admin";
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [isFolderSidebarCollapsed, setIsFolderSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<"all" | "current">("all");

  const toggleFolderCollapse = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };
  
  // Folder Creation Modal
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

  // Delete Folder Modal
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);

  // Rename Folder Modal
  const [folderToRename, setFolderToRename] = useState<FolderItem | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Drag and Drop state
  const [draggedCampaignId, setDraggedCampaignId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);
  const [isSyncingDb, setIsSyncingDb] = useState<boolean>(false);
  const [syncAuditResult, setSyncAuditResult] = useState<SyncAuditResult | null>(null);
  const [showSyncAuditModal, setShowSyncAuditModal] = useState<boolean>(false);
  const [showAdminAuditModal, setShowAdminAuditModal] = useState<boolean>(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setOpenActionMenuId(null);
    if (openActionMenuId) {
      window.addEventListener("click", handleClickOutside);
    }
    return () => window.removeEventListener("click", handleClickOutside);
  }, [openActionMenuId]);

  const handleRunSyncAudit = async () => {
    setIsSyncingDb(true);
    try {
      const result = await auditAndSyncCampaigns();
      setSyncAuditResult(result);
      setShowSyncAuditModal(true);
      await loadData();

      if (result.status === 'success') {
        setToastNotice(`Supabase Sync & Verification Complete! ${result.syncedCount} campaign(s) verified in remote database.`);
      } else if (result.status === 'partial') {
        setToastNotice(`Sync Partial: ${result.syncedCount} synced, ${result.failedCount + result.invalidCount} issue(s) flagged.`);
      } else {
        setToastNotice(`Sync Failed: ${result.transmissionErrors.length + result.validationErrors.length} error(s). Click "Retry Sync" to view audit.`);
      }
      setTimeout(() => setToastNotice(null), 5000);
    } catch (err) {
      console.error("[Campaigns] Manual sync audit error:", err);
      setToastNotice("Database sync failed. Check your network or Supabase connection.");
      setTimeout(() => setToastNotice(null), 5000);
    } finally {
      setIsSyncingDb(false);
    }
  };

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<CampaignRecord | null>(null);
  const [isPermanentDelete, setIsPermanentDelete] = useState(false);

  // Move Folder Modal
  const [moveTarget, setMoveTarget] = useState<CampaignRecord | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string>("");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const folderParam = searchParams.get("folderId") || searchParams.get("folder");
    const tabParam = searchParams.get("tab");
    const searchParam = searchParams.get("search") || searchParams.get("q") || searchParams.get("id");

    if (folderParam) setSelectedFolderId(folderParam);
    if (tabParam) setActiveTab(tabParam);
    if (searchParam) setSearchQuery(searchParam);
  }, [searchParams]);

  const loadData = async () => {
    console.log("[Campaigns Page] Refreshing campaigns & folders data...");
    const folderList = await fetchFolders();
    setFolders(folderList);

    const campaignList = await getAllCampaigns();
    setCampaigns(campaignList);
  };

  useEffect(() => {
    let realtimeChannel: any = null;

    const initAndLoad = async () => {
      await ensureSupabaseInitialized();
      await loadData();

      if (isSupabaseConfigured()) {
        try {
          realtimeChannel = supabase
            .channel("campaigns-realtime-changes")
            .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, () => {
              console.log("[Campaigns] Supabase realtime change detected, refreshing campaigns...");
              loadData();
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "folders" }, () => {
              console.log("[Campaigns] Supabase folders realtime change detected, refreshing folders...");
              loadData();
            })
            .subscribe();
        } catch (err) {
          console.warn("[Campaigns] Could not subscribe to Supabase Realtime:", err);
        }
      }
    };

    initAndLoad();

    const handleSynced = () => {
      loadData();
    };

    window.addEventListener("database-synced", handleSynced);
    window.addEventListener("focus", loadData);
    window.addEventListener("storage", handleSynced);
    const pollInterval = setInterval(loadData, 10000);

    return () => {
      window.removeEventListener("database-synced", handleSynced);
      window.removeEventListener("focus", loadData);
      window.removeEventListener("storage", handleSynced);
      clearInterval(pollInterval);
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [userEmail]);

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    createFolder(newFolderName.trim(), newFolderParentId);
    setNewFolderName("");
    setShowFolderModal(false);
    loadData();
  };

  const handleConfirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    await deleteFolder(folderToDelete.id, userEmail);
    if (selectedFolderId === folderToDelete.id) {
      setSelectedFolderId("all");
    }
    setFolderToDelete(null);
    loadData();
  };

  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderToRename || !renameValue.trim()) return;
    await renameFolder(folderToRename.id, renameValue.trim());
    setFolderToRename(null);
    setRenameValue("");
    loadData();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const targetId = String(deleteTarget.id);
    const targetUuid = ensureUuid(targetId);
    const targetName = deleteTarget.name;
    const permanent = isPermanentDelete;

    // OPTIMISTIC UI UPDATE: Instantly remove/soft-delete in state for immediate exit animation
    setCampaigns(prev => prev.map(c => {
      if (String(c.id) === targetId || ensureUuid(String(c.id)) === targetUuid) {
        return { ...c, is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: userEmail };
      }
      return c;
    }).filter(c => permanent ? (String(c.id) !== targetId && ensureUuid(String(c.id)) !== targetUuid) : true));

    setToastNotice(permanent ? `Permanently deleted "${targetName}"` : `Moved "${targetName}" to Recycle Bin`);
    setTimeout(() => setToastNotice(null), 3500);

    setDeleteTarget(null);
    setIsPermanentDelete(false);

    try {
      if (permanent) {
        await permanentlyDeleteCampaign(targetId, userEmail);
      } else {
        await softDeleteCampaign(targetId, userEmail);
      }
    } catch (e) {
      console.error("[Campaigns] Delete error:", e);
      loadData();
    }
  };

  const handleRestore = async (campaign: CampaignRecord) => {
    const targetId = String(campaign.id);
    const targetUuid = ensureUuid(targetId);

    // OPTIMISTIC UI UPDATE: Instantly restore in state
    setCampaigns(prev => prev.map(c => {
      if (String(c.id) === targetId || ensureUuid(String(c.id)) === targetUuid) {
        return { ...c, is_deleted: false, deleted_at: undefined, deleted_by: undefined };
      }
      return c;
    }));

    setToastNotice(`Restored "${campaign.name}" back to active view!`);
    setTimeout(() => setToastNotice(null), 3000);

    try {
      await restoreCampaign(campaign.id, userEmail);
    } catch (e) {
      console.error("[Campaigns] Restore error:", e);
      loadData();
    }
  };

  const handleRestoreAll = async () => {
    const count = await restoreAllCampaigns(userEmail);
    setToastNotice(`Successfully restored ${count} campaign(s) back to active view!`);
    setActiveTab("all");
    loadData();
    setTimeout(() => setToastNotice(null), 5000);
  };

  const handleMoveFolder = async () => {
    if (!moveTarget || !targetFolderId) return;
    await moveCampaignToFolder(moveTarget.id, targetFolderId, userEmail);
    setMoveTarget(null);
    loadData();
  };

  // Drag & Drop event handlers
  const handleDragStart = (e: React.DragEvent, campaign: CampaignRecord) => {
    setDraggedCampaignId(campaign.id);
    e.dataTransfer.setData("text/plain", campaign.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedCampaignId(null);
    setDragOverFolderId(null);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverFolderId !== folderId) {
      setDragOverFolderId(folderId);
    }
  };

  const handleDragLeave = (folderId: string) => {
    if (dragOverFolderId === folderId) {
      setDragOverFolderId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    const cId = e.dataTransfer.getData("text/plain") || draggedCampaignId;
    if (cId) {
      const campaign = campaigns.find(c => String(c.id) === String(cId));
      await moveCampaignToFolder(cId, targetFolderId, userEmail);
      const targetName = targetFolderId === "all" ? "All Folders" : getFolderName(targetFolderId);
      setToastNotice(`Moved "${campaign?.name || "Campaign"}" to ${targetName}`);
      setTimeout(() => setToastNotice(null), 3500);
      loadData();
    }
    setDragOverFolderId(null);
    setDraggedCampaignId(null);
  };

  const handleUpdateCampaignStatus = async (id: string, newStatus: "Approved" | "Failed") => {
    const target = campaigns.find(c => String(c.id) === String(id));
    const campaignName = target?.name || "Campaign";

    setCampaigns(prev => prev.map(c => {
      if (String(c.id) === String(id)) {
        return {
          ...c,
          status: newStatus,
          updated_at: new Date().toISOString(),
          lastEditedBy: userEmail
        };
      }
      return c;
    }));

    try {
      if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co') {
        const targetId = isUUID(String(id)) ? String(id) : ensureUuid(String(id));
        await supabase.from("campaigns").update({ 
          status: newStatus, 
          updated_at: new Date().toISOString() 
        }).eq("id", targetId);
      }
    } catch (err) {
      console.warn("Supabase status update skipped/failed:", err);
    }

    try {
      const localRaw = localStorage.getItem("local_campaigns");
      if (localRaw) {
        let localList: any[] = JSON.parse(localRaw);
        localList = localList.map((c: any) => String(c.id) === String(id) ? { ...c, status: newStatus, updated_at: new Date().toISOString(), lastEditedBy: userEmail } : c);
        localStorage.setItem("local_campaigns", JSON.stringify(localList));
      }
    } catch (e) {
      console.error("LocalStorage status update error:", e);
    }

    await logAction(
      userEmail, 
      newStatus === "Approved" ? "Approve Campaign" : "Fail Campaign", 
      `Campaign "${campaignName}" (ID: ${id}) marked as ${newStatus}`,
      String(id)
    );
  };

  const getBadgeStyle = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("draft")) return "bg-slate-100 text-slate-700 border-slate-300";
    if (s.includes("pending")) return "bg-amber-100 text-amber-800 border-amber-300";
    if (s.includes("in progress") || s.includes("automating")) return "bg-blue-100 text-blue-800 border-blue-300";
    if (s.includes("approved") || s.includes("completed")) return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (s.includes("rejected") || s.includes("failed")) return "bg-rose-100 text-rose-800 border-rose-300";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return "N/A";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }) + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "N/A";
    }
  };

  // Helper to construct breadcrumbs path
  const getBreadcrumbs = () => {
    const rootItem = {
      id: "all",
      name: "All Campaigns",
      isRoot: true,
      count: campaigns.filter(c => !c.is_deleted).length
    };

    if (selectedFolderId === "all") {
      return [rootItem];
    }

    const currentFolder = folders.find(f => f.id === selectedFolderId);
    if (!currentFolder) {
      return [rootItem];
    }

    const path: { id: string; name: string; isRoot?: boolean; count: number }[] = [rootItem];

    if (currentFolder.parentId) {
      const parentFolder = folders.find(f => f.id === currentFolder.parentId);
      if (parentFolder) {
        const parentCount = campaigns.filter(c => !c.is_deleted && (c.folder_id === parentFolder.id || folders.filter(sub => sub.parentId === parentFolder.id).some(s => s.id === c.folder_id))).length;
        path.push({ id: parentFolder.id, name: parentFolder.name, count: parentCount });
      }
    }

    const currentCount = campaigns.filter(c => !c.is_deleted && (c.folder_id === currentFolder.id || (!currentFolder.parentId && folders.filter(sub => sub.parentId === currentFolder.id).some(s => s.id === c.folder_id)))).length;
    path.push({ id: currentFolder.id, name: currentFolder.name, count: currentCount });

    return path;
  };

  // Filtering campaigns
  const filteredCampaigns = campaigns.filter(c => {
    // Search query filter (matches campaign ID, name, country, version, team, status, or folder name)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesId = String(c.id).toLowerCase().includes(q) || ensureUuid(String(c.id)).toLowerCase().includes(q);
      const matchesName = c.name.toLowerCase().includes(q);
      const matchesCountry = c.country?.toLowerCase().includes(q);
      const matchesVersion = (c.versionName || c.version_name)?.toLowerCase().includes(q);
      const matchesTeam = c.team?.toLowerCase().includes(q);
      const matchesStatus = c.status?.toLowerCase().includes(q);
      const matchesFolder = getFolderName(c.folder_id).toLowerCase().includes(q);
      const matchesSubject = c.outlookSubject?.toLowerCase().includes(q);
      if (!matchesId && !matchesName && !matchesCountry && !matchesVersion && !matchesTeam && !matchesStatus && !matchesFolder && !matchesSubject) {
        return false;
      }
    }

    // Folder filter: apply folder check ONLY if selectedFolderId is not 'all' and (no search query is active OR searchScope is 'current')
    if (selectedFolderId !== "all" && (!searchQuery || searchScope === "current")) {
      const campaignFolder = c.folder_id || "2026";
      
      // Direct match
      if (campaignFolder === selectedFolderId || c.folder_id === selectedFolderId) {
        // Match
      } else {
        // Check if campaign is in a subfolder of the selected folder
        const isChildFolder = folders.some(f => f.id === c.folder_id && f.parentId === selectedFolderId);
        // Root folder match (e.g. 2026 or default folder)
        const isRootFolderMatch = (selectedFolderId === "2026" || selectedFolderId === "default") && 
                                  (!c.folder_id || c.folder_id === "2026" || c.folder_id === "default" || c.folder_id === "folder_2026");
        
        if (!isChildFolder && !isRootFolderMatch) {
          return false;
        }
      }
    }

    // Recycle Bin tab handling
    if (activeTab === "recycle_bin") {
      return Boolean(c.is_deleted);
    }

    // Hide deleted campaigns from standard campaign views
    if (c.is_deleted) return false;

    const statusNorm = (c.status || "").toLowerCase().trim();
    if (activeTab === "all") return true;
    if (activeTab === "inprogress") return ["in progress", "qa pending", "review pending", "draft", "active", "pending", "in_progress"].includes(statusNorm);
    if (activeTab === "approved") return ["approved", "completed", "complete"].includes(statusNorm);
    if (activeTab === "failed") return ["failed", "rejected"].includes(statusNorm);

    return true;
  });

  const getFolderName = (folderId?: string | null) => {
    if (!folderId) return "Default / 2026";
    const found = folders.find(f => f.id === folderId);
    if (!found) return "2026";
    if (found.parentId) {
      const parent = folders.find(f => f.id === found.parentId);
      return `${parent?.name || found.year || "Folder"} / ${found.name}`;
    }
    return found.name;
  };

  // Top Stats calculation across non-deleted campaigns and deleted campaigns
  const nonDeletedCampaigns = campaigns.filter(c => !c.is_deleted);
  const deletedCampaignsList = campaigns.filter(c => c.is_deleted);
  const countAll = nonDeletedCampaigns.length;
  const countInProgress = nonDeletedCampaigns.filter(c => ["in progress", "qa pending", "review pending", "draft", "active", "pending", "in_progress"].includes((c.status || "").toLowerCase().trim())).length;
  const countApproved = nonDeletedCampaigns.filter(c => ["approved", "completed", "complete"].includes((c.status || "").toLowerCase().trim())).length;
  const countFailed = nonDeletedCampaigns.filter(c => ["failed", "rejected"].includes((c.status || "").toLowerCase().trim())).length;
  const countDeleted = deletedCampaignsList.length;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <header className="h-20 flex items-center justify-between px-8 border-b border-slate-200 bg-white shrink-0 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Campaigns & Folder Directory</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage, organize by year/folders, QA validate, and restore deleted campaigns</p>
        </div>
        <div className="flex items-center gap-2">
          {isSupabaseConfigured() && !isSyncingDb && syncAuditResult?.status === 'success' ? (
            <button
              onClick={handleRunSyncAudit}
              className="px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md text-xs font-bold transition-all inline-flex items-center gap-1.5 border border-emerald-200 shadow-xs cursor-pointer"
              title="Database synchronized & verified with Supabase. Click to re-audit."
            >
              <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3]" />
              <span>Synced</span>
            </button>
          ) : (
            <button
              onClick={handleRunSyncAudit}
              disabled={isSyncingDb}
              className="px-3.5 py-2 bg-blue-50 text-[#2b61d6] hover:bg-blue-100 rounded-md text-xs font-bold transition-colors inline-flex items-center gap-1.5 border border-blue-200 shadow-xs cursor-pointer disabled:opacity-50"
              title="Sync local records with Supabase database"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-[#2b61d6]", isSyncingDb && "animate-spin")} />
              {isSyncingDb ? "Syncing..." : "Sync Database"}
            </button>
          )}

          {syncAuditResult && (
            <button
              onClick={() => setShowSyncAuditModal(true)}
              className={cn(
                "px-2.5 py-2 rounded-md text-xs font-semibold inline-flex items-center gap-1 border transition-colors cursor-pointer",
                syncAuditResult.status === 'success' 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
              )}
              title="View last database sync audit report"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Audit Report</span>
            </button>
          )}
          <button
            onClick={() => setShowAdminAuditModal(true)}
            className="px-3.5 py-2 bg-slate-100 text-slate-800 hover:bg-slate-200 rounded-md text-xs font-bold transition-colors inline-flex items-center gap-1.5 border border-slate-300 shadow-xs cursor-pointer"
            title="View centralized audit logs for campaign deletions and updates"
          >
            <ShieldCheck className="h-4 w-4 text-[#2b61d6]" />
            <span>Audit Logs</span>
          </button>

          <button
            onClick={() => setShowFolderModal(true)}
            className="px-3.5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md text-xs font-semibold transition-colors inline-flex items-center gap-1.5 border border-slate-300 shadow-xs cursor-pointer"
          >
            <FolderPlus className="h-4 w-4 text-[#2b61d6]" />
            New Folder
          </button>
          <Link
            to="/campaigns/new"
            className="px-4 py-2 bg-[#2b61d6] text-white rounded-md text-xs font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-2 shadow-xs"
          >
            <PlusCircle className="h-4 w-4" />
            New Campaign
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Folder Navigation */}
        <aside className={cn(
          "bg-white border-r border-slate-200 flex flex-col shrink-0 transition-all duration-200 overflow-y-auto",
          isFolderSidebarCollapsed ? "w-14 p-2 items-center" : "w-64 p-4"
        )}>
          {isFolderSidebarCollapsed ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setIsFolderSidebarCollapsed(false)}
                className="p-2 text-slate-500 hover:text-[#2b61d6] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Expand Folders Menu"
              >
                <PanelLeftOpen className="w-5 h-5 text-[#2b61d6]" />
              </button>
              <div className="w-full h-px bg-slate-200" />
              <button
                type="button"
                onClick={() => setSelectedFolderId("all")}
                className={cn(
                  "p-2 rounded-lg transition-colors cursor-pointer",
                  selectedFolderId === "all" ? "bg-blue-100 text-[#2b61d6]" : "text-slate-600 hover:bg-slate-100"
                )}
                title="All Folders & Files"
              >
                <FolderOpen className="w-5 h-5 text-blue-600" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-1.5">
                  <Folder className="w-4 h-4 text-[#2b61d6]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Folders Menu
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = folders.map(f => f.id);
                      const areAllCollapsed = allIds.length > 0 && allIds.every(id => collapsedFolders[id]);
                      if (areAllCollapsed) {
                        setCollapsedFolders({});
                      } else {
                        const newColl: Record<string, boolean> = {};
                        allIds.forEach(id => { newColl[id] = true; });
                        setCollapsedFolders(newColl);
                      }
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Toggle expand or collapse all folder trees"
                  >
                    {folders.length > 0 && folders.every(f => collapsedFolders[f.id]) ? (
                      <>
                        <ChevronRight className="w-3 h-3 text-[#2b61d6]" />
                        <span>Expand All</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3 text-[#2b61d6]" />
                        <span>Collapse All</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFolderModal(true)}
                    className="text-xs text-[#2b61d6] hover:underline font-semibold px-1"
                    title="Create new folder"
                  >
                    + Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFolderSidebarCollapsed(true)}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer ml-1"
                    title="Collapse sidebar panel"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <nav className="space-y-1">
                <button
                  onClick={() => setSelectedFolderId("all")}
                  onDragOver={(e) => handleDragOver(e, "all")}
                  onDragLeave={() => handleDragLeave("all")}
                  onDrop={(e) => handleDrop(e, "all")}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-all cursor-pointer",
                    dragOverFolderId === "all"
                      ? "bg-blue-100 border-2 border-dashed border-[#2b61d6] scale-[1.02] text-[#2b61d6] font-bold shadow-xs"
                      : selectedFolderId === "all"
                      ? "bg-blue-50 text-[#2b61d6] font-semibold"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-blue-600" />
                    All Folders & Files
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-semibold">
                    {campaigns.filter(c => !c.is_deleted).length}
                  </span>
                </button>

                {/* Render Top-Level / Year folders */}
                {folders.filter(f => !f.parentId || !folders.some(p => p.id === f.parentId)).map((yearFolder) => {
                  const childFolders = folders.filter(f => f.parentId === yearFolder.id);
                  const isSelected = selectedFolderId === yearFolder.id;
                  const yearCount = campaigns.filter(c => !c.is_deleted && (c.folder_id === yearFolder.id || childFolders.some(ch => ch.id === c.folder_id))).length;
                  const isDragOver = dragOverFolderId === yearFolder.id;
                  const isCollapsed = !!collapsedFolders[yearFolder.id];

                  return (
                    <div key={yearFolder.id} className="space-y-0.5">
                      <div
                        onClick={() => setSelectedFolderId(yearFolder.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setFolderToRename(yearFolder);
                          setRenameValue(yearFolder.name);
                        }}
                        onDragOver={(e) => handleDragOver(e, yearFolder.id)}
                        onDragLeave={() => handleDragLeave(yearFolder.id)}
                        onDrop={(e) => handleDrop(e, yearFolder.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all mt-1 cursor-pointer group/item",
                          isDragOver
                            ? "bg-blue-100 border-2 border-dashed border-[#2b61d6] scale-[1.02] text-[#2b61d6] font-bold shadow-xs"
                            : isSelected
                            ? "bg-blue-50 text-[#2b61d6]"
                            : "text-slate-800 hover:bg-slate-100"
                        )}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          {childFolders.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => toggleFolderCollapse(yearFolder.id, e)}
                              className="p-0.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900 transition-colors shrink-0"
                              title={isCollapsed ? "Expand subfolders" : "Collapse subfolders"}
                            >
                              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-[#2b61d6]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#2b61d6]" />}
                            </button>
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{yearFolder.name}</span>
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full border border-slate-200 font-semibold">
                            {yearCount}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolderToDelete(yearFolder);
                            }}
                            title={`Delete folder "${yearFolder.name}"`}
                            className="opacity-0 group-hover/item:opacity-100 p-0.5 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Subfolders (visible if not collapsed) */}
                      {!isCollapsed && childFolders.map((sub) => {
                        const subSelected = selectedFolderId === sub.id;
                        const subCount = campaigns.filter(c => !c.is_deleted && c.folder_id === sub.id).length;
                        const isSubDragOver = dragOverFolderId === sub.id;

                        return (
                          <div
                            key={sub.id}
                            onClick={() => setSelectedFolderId(sub.id)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setFolderToRename(sub);
                              setRenameValue(sub.name);
                            }}
                            onDragOver={(e) => handleDragOver(e, sub.id)}
                            onDragLeave={() => handleDragLeave(sub.id)}
                            onDrop={(e) => handleDrop(e, sub.id)}
                            className={cn(
                              "w-full text-left pl-8 pr-3 py-1 rounded-md text-[11px] font-medium flex items-center justify-between transition-all cursor-pointer group/subitem",
                              isSubDragOver
                                ? "bg-blue-100 border-2 border-dashed border-[#2b61d6] scale-[1.02] text-[#2b61d6] font-bold shadow-xs"
                                : subSelected
                                ? "bg-blue-100 text-[#2b61d6] font-semibold"
                                : "text-slate-600 hover:bg-slate-100"
                            )}
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <Folder className="w-3 h-3 text-slate-400" />
                              {sub.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-slate-500 font-normal">
                                {subCount}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFolderToDelete(sub);
                                }}
                                title={`Delete folder "${sub.name}"`}
                                className="opacity-0 group-hover/subitem:opacity-100 p-0.5 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded transition-opacity"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </nav>
            </>
          )}
        </aside>

        {/* Main Directory Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Summary Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-8 pt-5 pb-3 bg-white border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between shadow-2xs group",
                activeTab === "all"
                  ? "bg-blue-50/90 border-[#2b61d6] ring-1 ring-[#2b61d6]"
                  : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/80"
              )}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">All Campaigns</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-0.5">{countAll}</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-[#2b61d6] flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("inprogress")}
              className={cn(
                "p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between shadow-2xs group",
                activeTab === "inprogress"
                  ? "bg-amber-50/90 border-amber-500 ring-1 ring-amber-500"
                  : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/80"
              )}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">In Progress</span>
                <div className="text-2xl font-extrabold text-amber-950 mt-0.5">{countInProgress}</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("approved")}
              className={cn(
                "p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between shadow-2xs group",
                activeTab === "approved"
                  ? "bg-emerald-50/90 border-emerald-500 ring-1 ring-emerald-500"
                  : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/80"
              )}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Approved</span>
                <div className="text-2xl font-extrabold text-emerald-950 mt-0.5">{countApproved}</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("failed")}
              className={cn(
                "p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between shadow-2xs group",
                activeTab === "failed"
                  ? "bg-rose-50/90 border-rose-500 ring-1 ring-rose-500"
                  : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/80"
              )}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Failed</span>
                <div className="text-2xl font-extrabold text-rose-950 mt-0.5">{countFailed}</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                <XCircle className="w-5 h-5" />
              </div>
            </button>
          </div>

          {/* Tabs Header Navigation */}
          <div className="px-8 pt-3 bg-white border-b border-slate-200 shrink-0">
            <nav className="flex space-x-6">
              {TABS.map((tab) => {
                const count = tab.id === "all" ? countAll
                  : tab.id === "inprogress" ? countInProgress
                  : tab.id === "approved" ? countApproved
                  : tab.id === "failed" ? countFailed
                  : tab.id === "recycle_bin" ? countDeleted
                  : 0;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "pb-2.5 text-xs font-semibold transition-colors relative flex items-center gap-1.5 cursor-pointer",
                      activeTab === tab.id ? "text-[#2b61d6]" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {tab.label}
                    <span className={cn(
                      "px-2 py-0.5 text-[10px] rounded-full font-bold",
                      activeTab === tab.id ? "bg-blue-100 text-[#2b61d6]" : "bg-slate-100 text-slate-600"
                    )}>
                      {count}
                    </span>
                    {activeTab === tab.id && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2b61d6] rounded-t-full" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Breadcrumb Navigation Bar */}
          <div className="bg-slate-50 border-b border-slate-200/80 px-8 py-2.5 flex items-center justify-between shrink-0 text-xs gap-3">
            <nav className="flex items-center flex-wrap gap-1.5 font-medium text-slate-600">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1">Location:</span>
              {getBreadcrumbs().map((crumb, index, arr) => {
                const isLast = index === arr.length - 1;
                return (
                  <React.Fragment key={crumb.id}>
                    {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    <button
                      onClick={() => setSelectedFolderId(crumb.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer",
                        isLast
                          ? "bg-white text-[#2b61d6] font-bold border border-slate-200 shadow-2xs"
                          : "hover:bg-slate-200/70 text-slate-700 hover:text-slate-900"
                      )}
                    >
                      {crumb.isRoot ? <Home className="w-3.5 h-3.5 text-[#2b61d6]" /> : <Folder className="w-3.5 h-3.5 text-amber-500" />}
                      <span>{crumb.name}</span>
                      <span className="text-[10px] bg-slate-200/80 text-slate-600 px-1.5 rounded-full font-semibold">
                        {crumb.count}
                      </span>
                    </button>
                  </React.Fragment>
                );
              })}
            </nav>

            {selectedFolderId !== "all" && (
              <button
                onClick={() => {
                  const currentFolder = folders.find(f => f.id === selectedFolderId);
                  if (currentFolder?.parentId) {
                    setSelectedFolderId(currentFolder.parentId);
                  } else {
                    setSelectedFolderId("all");
                  }
                }}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#2b61d6] bg-white border border-slate-200 hover:border-slate-300 px-2.5 py-1 rounded-md transition-colors cursor-pointer shadow-2xs shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Up Level
              </button>
            )}
          </div>

          {/* Search & View Mode Toolbar */}
          <div className="px-8 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between shrink-0 relative gap-3">
            {toastNotice && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-emerald-700 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 animate-bounce z-20">
                <span>{toastNotice}</span>
              </div>
            )}

            <div className="flex items-center gap-3 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search campaigns across folders, country, or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-9 pr-8 rounded-md border border-slate-300 bg-slate-50/50 text-xs focus:outline-none focus:ring-1 focus:ring-[#2b61d6]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Search Scope Toggle */}
              <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200 shrink-0 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setSearchScope("all")}
                  className={cn(
                    "px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1",
                    searchScope === "all" ? "bg-white text-[#2b61d6] shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                  )}
                  title="Search across all folders"
                >
                  <Globe className="w-3 h-3 text-[#2b61d6]" />
                  All Folders
                </button>
                <button
                  type="button"
                  onClick={() => setSearchScope("current")}
                  className={cn(
                    "px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1",
                    searchScope === "current" ? "bg-white text-[#2b61d6] shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                  )}
                  title="Search only within current folder"
                >
                  <Folder className="w-3 h-3 text-amber-500" />
                  Current Folder
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {countDeleted > 0 && (
                <button
                  type="button"
                  onClick={handleRestoreAll}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                  title="Restore all soft-deleted campaigns back to active view"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore All ({countDeleted})</span>
                </button>
              )}

              {searchQuery && (
                <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md font-semibold">
                  Found {filteredCampaigns.length} campaign{filteredCampaigns.length === 1 ? "" : "s"}
                </span>
              )}

              <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200">
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-1 rounded transition-colors cursor-pointer",
                    viewMode === "list" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-700"
                  )}
                  title="List View"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-1 rounded transition-colors cursor-pointer",
                    viewMode === "grid" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-700"
                  )}
                  title="Grid View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Table / List View Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-slate-100/60">
            {filteredCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-3 border border-slate-200 shadow-xs">
                  {activeTab === "recycle_bin" ? (
                    <Trash2 className="h-7 w-7 text-slate-300" />
                  ) : (
                    <Folder className="h-7 w-7 text-slate-300" />
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-600">
                  {activeTab === "recycle_bin" ? "Recycle Bin is Empty" : "No campaigns found in this view"}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {activeTab === "recycle_bin" ? "Deleted campaigns will appear here before permanent removal." : "Create a new campaign or choose a different folder."}
                </p>
              </div>
            ) : viewMode === "list" ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-visible relative shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200">
                      <th className="px-5 py-3 rounded-tl-xl">Campaign Name</th>
                      <th className="px-5 py-3">Country & Version</th>
                      <th className="px-5 py-3">Folder Path</th>
                      <th className="px-5 py-3">QA Checkpoints Progress</th>
                      <th className="px-5 py-3">Created Date & Time</th>
                      <th className="px-5 py-3">Last Modified</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right rounded-tr-xl">Actions & Decision</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {filteredCampaigns.map((campaign, idx) => {
                        const prog = getCampaignCheckpointProgress(campaign);
                        return (
                        <motion.tr 
                          key={campaign.id} 
                          layout
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -30, scale: 0.96, transition: { duration: 0.22, ease: "easeInOut" } }}
                          draggable={!campaign.is_deleted}
                          onDragStart={(e: any) => handleDragStart(e, campaign)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "hover:bg-slate-50/80 transition-colors group cursor-grab active:cursor-grabbing",
                            draggedCampaignId === campaign.id && "opacity-40 bg-blue-50 border-2 border-dashed border-blue-400"
                          )}
                        >
                        <td className="px-5 py-3.5 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 cursor-grab active:cursor-grabbing" title="Drag to move to a folder" />
                            <button
                              onClick={() => navigate(`/campaigns/new?id=${campaign.id}`)}
                              className="text-left font-bold text-slate-900 hover:text-[#2b61d6] hover:underline flex items-center gap-1.5"
                            >
                              {campaign.name}
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          <span className="font-semibold text-slate-800">{campaign.country}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5">({campaign.versionName || "Standard"})</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFolderId(campaign.folder_id || "all");
                            }}
                            className="bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-900 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-200 hover:border-amber-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title={`Jump to folder "${getFolderName(campaign.folder_id)}"`}
                          >
                            <Folder className="w-3 h-3 text-amber-500" />
                            <span>{getFolderName(campaign.folder_id)}</span>
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          <div className="flex flex-col gap-1 w-36">
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span className={prog.isFullyCompleted ? "text-emerald-700" : prog.completed > 0 ? "text-[#2b61d6]" : "text-slate-500"}>
                                {prog.completed}/{prog.total} Done
                              </span>
                              <span className="text-slate-500 text-[10px]">{prog.percent}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                              <div 
                                className={cn(
                                  "h-full transition-all duration-500",
                                  prog.isFullyCompleted ? "bg-emerald-500" : prog.completed > 0 ? "bg-[#2b61d6]" : "bg-slate-300"
                                )} 
                                style={{ width: `${prog.percent}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                              <span className="text-emerald-600 font-semibold">{prog.checked} Checked</span>
                              <span>•</span>
                              <span className="text-slate-500">{prog.na} N/A</span>
                              {prog.pending > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-600 font-semibold">{prog.pending} Left</span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          <div className="flex flex-col">
                            <span className="text-slate-700 font-medium">{formatDateTime(campaign.created_at)}</span>
                            <span className="text-[10px] text-slate-400">By {campaign.createdBy || campaign.userEmail}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          <div className="flex flex-col">
                            <span className="text-slate-700 font-medium">{formatDateTime(campaign.updated_at)}</span>
                            <span className="text-[10px] text-slate-400">By {campaign.lastEditedBy || campaign.createdBy || "User"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border", getBadgeStyle(campaign.status))}>
                            {campaign.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {activeTab === "recycle_bin" ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleRestore(campaign)}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded text-xs font-semibold inline-flex items-center gap-1 shadow-xs"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restore
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteTarget(campaign);
                                  setIsPermanentDelete(true);
                                }}
                                className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300 rounded text-xs font-semibold inline-flex items-center gap-1 shadow-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Forever
                              </button>
                            </div>
                          ) : (
                            <div className="relative flex items-center justify-end">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionMenuId(openActionMenuId === campaign.id ? null : campaign.id);
                                }}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Campaign Actions"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {openActionMenuId === campaign.id && (
                                <div 
                                  className={cn(
                                    "absolute right-0 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-[200] animate-in fade-in zoom-in-95 text-left",
                                    idx >= Math.max(1, filteredCampaigns.length - 2)
                                      ? "bottom-full mb-1"
                                      : "top-full mt-1"
                                  )}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {isAdmin && (
                                    <button
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        navigate(`/campaigns/new?id=${campaign.id}`);
                                      }}
                                      className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#2b61d6] flex items-center gap-2 cursor-pointer transition-colors"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 text-[#2b61d6]" />
                                      <span>Edit</span>
                                    </button>
                                  )}

                                  <button
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      navigate(`/campaigns/new?id=${campaign.id}`);
                                    }}
                                    className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#2b61d6] flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Open</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setMoveTarget(campaign);
                                      setTargetFolderId(campaign.folder_id || "2026");
                                    }}
                                    className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <FolderInput className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Move</span>
                                  </button>

                                  <div className="my-1 border-t border-slate-100" />

                                  {!isAdmin && (campaign.status === "Approved" || campaign.status === "Completed") ? (
                                    <button
                                      disabled
                                      className="w-full px-3.5 py-2 text-xs font-medium text-slate-400 bg-slate-50 cursor-not-allowed flex items-center justify-between"
                                      title="Approved campaigns cannot be deleted by standard users"
                                    >
                                      <span className="flex items-center gap-2">
                                        <Trash2 className="w-3.5 h-3.5 text-slate-300" />
                                        Delete
                                      </span>
                                      <Lock className="w-3 h-3 text-amber-500" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setDeleteTarget(campaign);
                                        setIsPermanentDelete(false);
                                      }}
                                      className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                      <span>Delete</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <AnimatePresence mode="popLayout" initial={false}>
                  {filteredCampaigns.map((campaign) => {
                    const prog = getCampaignCheckpointProgress(campaign);
                    return (
                    <motion.div 
                      key={campaign.id} 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.88, y: 15, transition: { duration: 0.22, ease: "easeInOut" } }}
                      draggable={!campaign.is_deleted}
                      onDragStart={(e: any) => handleDragStart(e, campaign)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "bg-white border border-slate-200 rounded-xl overflow-visible relative shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-grab active:cursor-grabbing group",
                        draggedCampaignId === campaign.id && "opacity-40 border-2 border-dashed border-blue-400 scale-95"
                      )}
                    >
                    <div>
                      <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 mt-0.5 cursor-grab active:cursor-grabbing" title="Drag to move to a folder" />
                          <div>
                            <button
                              onClick={() => navigate(`/campaigns/new?id=${campaign.id}`)}
                              className="font-bold text-sm text-slate-900 hover:text-[#2b61d6] text-left line-clamp-1"
                            >
                              {campaign.name}
                            </button>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {campaign.country} ({campaign.versionName || "Standard"})
                            </p>
                          </div>
                        </div>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0", getBadgeStyle(campaign.status))}>
                          {campaign.status}
                        </span>
                      </div>

                      <div className="p-4 space-y-2.5 text-xs">
                        {/* Progress Bar in Grid View */}
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="text-slate-600">QA Checkpoints</span>
                            <span className={prog.isFullyCompleted ? "text-emerald-700" : prog.completed > 0 ? "text-[#2b61d6]" : "text-slate-500"}>
                              {prog.completed}/{prog.total} ({prog.percent}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                            <div 
                              className={cn(
                                "h-full transition-all duration-500",
                                prog.isFullyCompleted ? "bg-emerald-500" : prog.completed > 0 ? "bg-[#2b61d6]" : "bg-slate-300"
                              )} 
                              style={{ width: `${prog.percent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                            <span>Checked: <strong className="text-emerald-700">{prog.checked}</strong></span>
                            <span>N/A: <strong className="text-slate-700">{prog.na}</strong></span>
                            <span>Left: <strong className="text-amber-700">{prog.pending}</strong></span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400 flex items-center gap-1"><Folder className="w-3 h-3 text-amber-500" /> Folder:</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFolderId(campaign.folder_id || "all");
                            }}
                            className="font-semibold text-slate-700 hover:text-[#2b61d6] hover:underline cursor-pointer truncate max-w-[160px] text-right"
                            title={`Jump to folder "${getFolderName(campaign.folder_id)}"`}
                          >
                            {getFolderName(campaign.folder_id)}
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Created:</span>
                          <span className="font-medium text-slate-700">{formatDateTime(campaign.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400 flex items-center gap-1"><User className="w-3 h-3" /> Modified:</span>
                          <span className="font-medium text-slate-700">{formatDateTime(campaign.updated_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
                      {activeTab === "recycle_bin" ? (
                        <div className="flex items-center justify-between w-full">
                          <button
                            onClick={() => handleRestore(campaign)}
                            className="px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Restore
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTarget(campaign);
                              setIsPermanentDelete(true);
                            }}
                            className="px-3 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300 rounded text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full relative">
                          <button
                            onClick={() => navigate(`/campaigns/new?id=${campaign.id}`)}
                            className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-[#2b61d6]" /> Open
                          </button>

                          <div className="relative ml-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionMenuId(openActionMenuId === campaign.id ? null : campaign.id);
                              }}
                              className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg shadow-xs transition-colors cursor-pointer"
                              title="More Options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openActionMenuId === campaign.id && (
                              <div 
                                className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-200/90 py-1.5 z-[200] animate-in fade-in zoom-in-95 text-left"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isAdmin && (
                                  <button
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      navigate(`/campaigns/new?id=${campaign.id}`);
                                    }}
                                    className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#2b61d6] flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-[#2b61d6]" />
                                    <span>Edit</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    navigate(`/campaigns/new?id=${campaign.id}`);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#2b61d6] flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Open</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    setMoveTarget(campaign);
                                    setTargetFolderId(campaign.folder_id || "2026");
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <FolderInput className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Move</span>
                                </button>

                                <div className="my-1 border-t border-slate-100" />

                                {!isAdmin && (campaign.status === "Approved" || campaign.status === "Completed") ? (
                                  <button
                                    disabled
                                    className="w-full px-3.5 py-2 text-xs font-medium text-slate-400 bg-slate-50 cursor-not-allowed flex items-center justify-between"
                                    title="Approved campaigns cannot be deleted by standard users"
                                  >
                                    <span className="flex items-center gap-2">
                                      <Trash2 className="w-3.5 h-3.5 text-slate-300" />
                                      Delete
                                    </span>
                                    <Lock className="w-3 h-3 text-amber-500" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setDeleteTarget(campaign);
                                      setIsPermanentDelete(false);
                                    }}
                                    className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE FOLDER MODAL */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Create New Folder</h3>
            <p className="text-xs text-slate-500 mb-4">Create a Year folder or subfolder to organize your campaigns.</p>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Folder Name</label>
                <input
                  type="text"
                  placeholder="e.g. 2027 or Q4 Promotions"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-300 text-xs focus:ring-2 focus:ring-[#2b61d6] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Parent Directory (Optional)</label>
                <select
                  value={newFolderParentId || ""}
                  onChange={(e) => setNewFolderParentId(e.target.value ? e.target.value : null)}
                  className="w-full h-9 px-3 rounded-md border border-slate-300 text-xs bg-white"
                >
                  <option value="">Top Level (New Year Directory)</option>
                  {folders.filter(f => f.parentId === null).map((f) => (
                    <option key={f.id} value={f.id}>
                      Year: {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-[#2b61d6] text-white text-xs font-semibold hover:bg-blue-700"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOVE FOLDER MODAL */}
      {moveTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Move Campaign</h3>
            <p className="text-xs text-slate-500 mb-4">Select target folder for "{moveTarget.name}".</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Destination Folder</label>
                <select
                  value={targetFolderId}
                  onChange={(e) => setTargetFolderId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-300 text-xs bg-white"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.parentId ? `└ ${f.name} (${folders.find(p => p.id === f.parentId)?.name})` : `Year: ${f.name}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMoveTarget(null)}
                  className="px-4 py-2 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMoveFolder}
                  className="px-4 py-2 rounded-md bg-[#2b61d6] text-white text-xs font-semibold hover:bg-blue-700"
                >
                  Move Campaign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE FOLDER MODAL */}
      {folderToDelete && (() => {
        const childFolderIds = folders.filter(f => f.parentId === folderToDelete.id).map(f => f.id);
        const idsToCheck = [folderToDelete.id, ...childFolderIds];
        const activeCampaignsInFolder = campaigns.filter(c => !c.is_deleted && idsToCheck.includes(c.folder_id || ""));
        const count = activeCampaignsInFolder.length;

        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-lg font-bold text-slate-900">
                  {count > 0 ? "Cannot Delete Folder" : "Delete Empty Folder?"}
                </h3>
              </div>

              {count > 0 ? (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg space-y-2">
                  <p className="text-xs text-rose-900 font-bold leading-relaxed">
                    Folder <strong className="text-rose-950 font-black">"{folderToDelete.name}"</strong> contains {count} campaign(s).
                  </p>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    Folders with campaigns cannot be deleted to prevent data loss. Only empty folders can be deleted. Please move or delete the campaign(s) inside this folder first.
                  </p>
                  <div className="text-[11px] font-mono text-rose-900 bg-white/80 p-2 rounded border border-rose-200/80 max-h-24 overflow-y-auto space-y-1">
                    {activeCampaignsInFolder.map(c => (
                      <div key={c.id} className="truncate flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                        <span className="font-semibold">{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to delete empty folder <strong className="text-slate-900">"{folderToDelete.name}"</strong>?
                  This folder currently has no campaigns.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFolderToDelete(null)}
                  className="px-4 py-2 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  {count > 0 ? "Understood / Close" : "Cancel"}
                </button>
                {count === 0 && (
                  <button
                    type="button"
                    onClick={handleConfirmDeleteFolder}
                    className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs"
                  >
                    Delete Folder
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* RENAME FOLDER MODAL */}
      {folderToRename && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Rename Folder</h3>
            <p className="text-xs text-slate-500 mb-4">Update the name for this folder.</p>
            <form onSubmit={handleRenameFolder} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Folder Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. 2026-q4"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFolderToRename(null)}
                  className="px-4 py-2 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameValue.trim() || renameValue.trim() === folderToRename.name}
                  className="px-4 py-2 rounded-md bg-[#2b61d6] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-slate-900">
                {isPermanentDelete ? "Permanently Delete Campaign?" : "Move to Recycle Bin?"}
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              {isPermanentDelete
                ? `Are you sure you want to PERMANENTLY delete "${deleteTarget.name}"? This action cannot be undone.`
                : `Are you sure you want to move "${deleteTarget.name}" to the Recycle Bin? You can restore it anytime.`}
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setIsPermanentDelete(false);
                }}
                className="px-4 py-2 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className={cn(
                  "px-4 py-2 rounded-md text-white text-xs font-semibold shadow-xs",
                  isPermanentDelete ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                {isPermanentDelete ? "Delete Forever" : "Move to Recycle Bin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DATABASE SYNCHRONIZATION AUDIT & RETRY MODAL */}
      {showSyncAuditModal && syncAuditResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2.5 rounded-lg shrink-0",
                  syncAuditResult.status === 'success' ? "bg-emerald-100 text-emerald-700" :
                  syncAuditResult.status === 'partial' ? "bg-amber-100 text-amber-700" :
                  "bg-rose-100 text-rose-700"
                )}>
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    Database Sync & Validation Audit
                    <span className={cn(
                      "text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border font-bold",
                      syncAuditResult.status === 'success' ? "bg-emerald-50 text-emerald-800 border-emerald-300" :
                      syncAuditResult.status === 'partial' ? "bg-amber-50 text-amber-800 border-amber-300" :
                      "bg-rose-50 text-rose-800 border-rose-300"
                    )}>
                      {syncAuditResult.status === 'success' ? '100% Synced & Verified' :
                       syncAuditResult.status === 'partial' ? 'Partial Sync / Warnings' : 'Sync Failed'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Audit timestamp: {new Date(syncAuditResult.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncAuditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metric Cards Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Examined</div>
                <div className="text-xl font-bold text-slate-800 mt-0.5">{syncAuditResult.totalExamined}</div>
                <div className="text-[10px] text-slate-400">Total campaigns</div>
              </div>
              <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-lg">
                <div className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">Field Validated</div>
                <div className="text-xl font-bold text-blue-900 mt-0.5">{syncAuditResult.validatedCount}</div>
                <div className="text-[10px] text-blue-600">Critical fields present</div>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-lg">
                <div className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">Remote Verified</div>
                <div className="text-xl font-bold text-emerald-900 mt-0.5">{syncAuditResult.verifiedCount}</div>
                <div className="text-[10px] text-emerald-600">Confirmed in Supabase</div>
              </div>
              <div className={cn(
                "border p-3 rounded-lg",
                (syncAuditResult.invalidCount + syncAuditResult.failedCount) > 0 
                  ? "bg-rose-50/80 border-rose-200" 
                  : "bg-slate-50 border-slate-200"
              )}>
                <div className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  (syncAuditResult.invalidCount + syncAuditResult.failedCount) > 0 ? "text-rose-700" : "text-slate-500"
                )}>
                  Sync Issues
                </div>
                <div className={cn(
                  "text-xl font-bold mt-0.5",
                  (syncAuditResult.invalidCount + syncAuditResult.failedCount) > 0 ? "text-rose-900" : "text-slate-800"
                )}>
                  {syncAuditResult.invalidCount + syncAuditResult.failedCount}
                </div>
                <div className="text-[10px] text-slate-500">Validation / Net errors</div>
              </div>
            </div>

            {/* Validation Errors Section */}
            {syncAuditResult.validationErrors.length > 0 && (
              <div className="mb-4 bg-amber-50/90 border border-amber-200 rounded-lg p-3">
                <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Validation Failures ({syncAuditResult.validationErrors.length})
                </h4>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {syncAuditResult.validationErrors.map((v, idx) => (
                    <div key={idx} className="text-xs bg-white/80 p-2 rounded border border-amber-200/80 text-slate-800">
                      <div className="font-semibold text-amber-900">{v.name} <span className="text-[10px] font-mono text-slate-400">({v.campaignId})</span></div>
                      <ul className="list-disc list-inside text-[11px] text-amber-800 mt-0.5 pl-1 space-y-0.5">
                        {v.errors.map((err, eIdx) => (
                          <li key={eIdx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transmission Errors Section */}
            {syncAuditResult.transmissionErrors.length > 0 && (
              <div className="mb-4 bg-rose-50/90 border border-rose-200 rounded-lg p-3">
                <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5 mb-2">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  Transmission / Supabase Write Failures ({syncAuditResult.transmissionErrors.length})
                </h4>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {syncAuditResult.transmissionErrors.map((t, idx) => (
                    <div key={idx} className="text-xs bg-white/80 p-2 rounded border border-rose-200/80 text-slate-800">
                      <div className="font-semibold text-rose-900">{t.name} <span className="text-[10px] font-mono text-slate-400">({t.campaignId})</span></div>
                      <p className="text-[11px] font-mono text-rose-800 mt-0.5">{t.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unverified In Remote Database Section */}
            {syncAuditResult.unverifiedCampaigns.length > 0 && (
              <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-4 h-4 text-slate-600" />
                  Unverified In Remote Database ({syncAuditResult.unverifiedCampaigns.length})
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                  {syncAuditResult.unverifiedCampaigns.map((u, idx) => (
                    <div key={idx} className="text-xs bg-white p-2 rounded border border-slate-200 text-slate-800">
                      <div className="font-semibold">{u.name}</div>
                      <p className="text-[11px] text-slate-500">{u.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verified Status Banner */}
            {syncAuditResult.status === 'success' && (
              <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold">All campaign records and folder structures verified in Supabase.</p>
                  <p className="text-[11px] text-emerald-700">Critical fields (id, name, country, status) match remote database state.</p>
                </div>
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-[11px] text-slate-500 font-mono">
                {syncAuditResult.syncedFolderCount} folder(s) synced
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSyncAuditModal(false)}
                  className="px-4 py-2 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleRunSyncAudit}
                  disabled={isSyncingDb}
                  className="px-4 py-2 rounded-md bg-[#2b61d6] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isSyncingDb && "animate-spin")} />
                  <span>{isSyncingDb ? "Retrying Sync..." : "Retry Sync Now"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ADMIN AUDIT LOG MODAL */}
      <AdminAuditLogModal
        isOpen={showAdminAuditModal}
        onClose={() => setShowAdminAuditModal(false)}
        userRole={userRole}
      />
    </div>
  );
}
