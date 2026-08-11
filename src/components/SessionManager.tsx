import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { clearPostLoginRedirectUrl } from '@/lib/url-redirect';
import { AlertCircle } from 'lucide-react';

export function SessionManager() {
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);

  // For testing, let's make it shorter if needed, but standard is 15 mins.
  // 14 mins until warning, 1 min warning.
  const TIMEOUT_MS = 15 * 60 * 1000; 
  const WARNING_MS = 60 * 1000; 

  const timeoutTimer = useRef<NodeJS.Timeout | null>(null);
  const warningTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = async () => {
    clearPostLoginRedirectUrl();
    localStorage.removeItem("active_app_session");
    localStorage.removeItem("mockAuth");
    localStorage.removeItem("campaign_form_autosave");
    localStorage.removeItem("campaign_draft");
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co') {
      try {
        await supabase.auth.signOut();
      } catch (e) {}
    }
    window.history.replaceState({}, '', '/');
    window.dispatchEvent(new Event("app_auth_changed"));
    window.location.href = "/";
  };

  const resetTimers = useCallback(() => {
    if (showWarning) return; 
    
    if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);

    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
      setTimeLeft(WARNING_MS / 1000);
      
      countdownTimer.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (countdownTimer.current) clearInterval(countdownTimer.current);
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, TIMEOUT_MS - WARNING_MS);

  }, [showWarning]);

  const handleExtend = async () => {
    setShowWarning(false);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co') {
      await supabase.auth.refreshSession();
    }
    resetTimers();
  };

  useEffect(() => {
    resetTimers();

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    const handleActivity = () => resetTimers();

    events.forEach(event => window.addEventListener(event, handleActivity));

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, [resetTimers]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-200">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Session Expiring Soon</h3>
            <p className="text-sm text-slate-500 mt-1">You will be logged out due to inactivity.</p>
          </div>
        </div>
        
        <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-100 text-center">
          <p className="text-3xl font-mono font-bold text-slate-800">
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </p>
          <p className="text-xs text-slate-500 mt-1">Remaining until automatic logout</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleLogout} className="flex-1 px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-md font-semibold text-sm">
            Log Out Now
          </button>
          <button onClick={handleExtend} className="flex-1 px-4 py-2 bg-[#2b61d6] hover:bg-blue-700 text-white rounded-md font-semibold text-sm">
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}
