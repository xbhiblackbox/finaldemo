import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchInstagramData,
  setConnectedUsername,
  getConnectedUsername,
  disconnectInstagram,
  clearInstagramCache,
} from "@/lib/instagramApi";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected: (username: string) => void;
}

export default function ConnectInstagramModal({ open, onClose, onConnected }: Props) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentConnected, setCurrentConnected] = useState("");

  useEffect(() => {
    if (open) {
      setCurrentConnected(getConnectedUsername());
      setUsername(getConnectedUsername());
    }
  }, [open]);

  const handleConnect = async () => {
    const clean = username.trim().replace(/^@/, "");
    if (!clean) {
      toast.error("Please enter your Instagram username");
      return;
    }
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(clean)) {
      toast.error("Invalid username format");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchInstagramData(clean, "profile");
      if (!res.profileOk && !res.profile?.username) {
        toast.error("Could not find this Instagram account. Check the username.");
        setLoading(false);
        return;
      }
      setConnectedUsername(clean);
      toast.success(`Connected to @${clean}`);
      onConnected(clean);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Failed to connect");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    const prev = getConnectedUsername();
    disconnectInstagram();
    if (prev) clearInstagramCache(prev);
    setCurrentConnected("");
    setUsername("");
    toast.success("Disconnected");
    onConnected("");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center font-mono"
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-black text-emerald-400 border-t border-emerald-500/40 sm:border sm:border-emerald-500/40 sm:rounded-md p-5 shadow-[0_0_40px_-10px_rgba(16,185,129,0.45)] relative overflow-hidden"
          >
            {/* faint scanline overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, #34d399 2px, #34d399 3px)",
              }}
            />

            {/* terminal title bar */}
            <div className="flex items-center justify-between mb-4 border-b border-emerald-500/25 pb-2.5">
              <div className="flex items-center gap-2 text-[11px] tracking-wider">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                </div>
                <span className="text-emerald-500/70 ml-2">~/instagram/connect.sh</span>
              </div>
              <button
                onClick={onClose}
                className="text-emerald-500/60 hover:text-emerald-300 active:opacity-60 p-0.5"
                aria-label="close"
              >
                <X size={16} strokeWidth={2.4} />
              </button>
            </div>

            {/* shell prompt header */}
            <div className="text-[12px] leading-relaxed mb-4">
              <div>
                <span className="text-emerald-500/60">root@extips</span>
                <span className="text-emerald-500/40">:</span>
                <span className="text-cyan-400/80">~</span>
                <span className="text-emerald-500/40">$ </span>
                <span className="text-emerald-300">./connect --instagram</span>
              </div>
              <div className="text-emerald-500/50 text-[11px] mt-1 pl-2">
                {"// pull live insights from your account"}
              </div>
            </div>

            {/* connected status */}
            {currentConnected && (
              <div className="mb-4 px-3 py-2 border border-emerald-500/30 bg-emerald-500/5 text-[12px] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 animate-pulse">●</span>
                  <span className="text-emerald-300/90">
                    SESSION_ACTIVE → <span className="text-emerald-200 font-bold">@{currentConnected}</span>
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="text-[11px] text-rose-400 hover:text-rose-300 tracking-wider"
                  data-testid="button-disconnect-instagram"
                >
                  [kill]
                </button>
              </div>
            )}

            {/* input */}
            <label className="block text-[11px] text-emerald-500/70 mb-1.5 tracking-wider uppercase">
              <span className="text-emerald-500/40">{">"}</span> instagram_handle
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-500/60 text-[13px] select-none">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/^@/, ""))}
                placeholder="your_username"
                autoComplete="off"
                spellCheck={false}
                disabled={loading}
                data-testid="input-instagram-username"
                className="w-full pl-7 pr-3 py-2.5 bg-emerald-500/5 border border-emerald-500/30 text-emerald-200 text-[13px] outline-none focus:border-emerald-400 focus:bg-emerald-500/10 transition placeholder:text-emerald-500/30 caret-emerald-400"
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              />
            </div>

            <div className="text-[10.5px] text-emerald-500/55 mt-2 leading-relaxed">
              <span className="text-emerald-500/40">{"#"}</span> public accounts only · cache=10m · re-run to refresh
            </div>

            {/* execute button */}
            <button
              onClick={handleConnect}
              disabled={loading || !username.trim()}
              data-testid="button-connect-instagram"
              className="mt-5 w-full py-2.5 border border-emerald-400 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400 hover:text-black hover:shadow-[0_0_18px_rgba(16,185,129,0.55)] transition-all text-[13px] tracking-widest uppercase font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-400/10 disabled:hover:text-emerald-200 disabled:hover:shadow-none active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>verifying...</span>
                </>
              ) : (
                <>
                  <span className="text-emerald-500/70">{">"}</span>
                  <span>{currentConnected ? "exec update" : "exec connect"}</span>
                  <span className="text-emerald-500/70 animate-pulse">_</span>
                </>
              )}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
