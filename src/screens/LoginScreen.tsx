import { useState, useEffect } from "react";
import { ArrowRight, Smartphone, AlertTriangle, Shield, Zap, Lock, Eye, Users } from "lucide-react";
import { validateAndLogin, getDeviceFingerprint } from "@/lib/auth";

interface LoginScreenProps {
    onLoginSuccess: () => void;
}

const LoginScreen = ({ onLoginSuccess }: LoginScreenProps) => {
    const [key, setKey] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [deviceId, setDeviceId] = useState("");

    useEffect(() => {
        setDeviceId(getDeviceFingerprint());
    }, []);

    const handleKeyChange = (raw: string) => {
        setKey(raw);
        setError("");
    };

    const handleLogin = async () => {
        if (!key.trim()) {
            setError("Please enter your access key");
            return;
        }
        setLoading(true);
        setError("");
        await new Promise((r) => setTimeout(r, 800));
        const result = await validateAndLogin(key.trim());
        setLoading(false);
        if (result.success) {
            onLoginSuccess();
        } else {
            setError("error" in result ? result.error : "Login failed");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleLogin();
    };

    return (
        <div className="fixed inset-0 z-[99999] overflow-y-auto" style={{ background: "linear-gradient(160deg, #e0f2fe 0%, #f0f9ff 30%, #ffffff 60%, #e0f2fe 100%)" }}>
            {/* Decorative blobs */}
            <div className="hidden sm:block" style={{ position: "absolute", top: "-80px", right: "-60px", width: "220px", height: "220px", borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div className="hidden sm:block" style={{ position: "absolute", bottom: "60px", left: "-40px", width: "180px", height: "180px", borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

            <div className="min-h-full flex flex-col items-center px-3 sm:px-4 py-4 sm:py-6 pb-6 sm:pb-10 relative">

                {/* ── Logo ── */}
                <div className="flex flex-col items-center mb-3 sm:mb-5 mt-1 sm:mt-2">
                    <div className="w-14 h-14 sm:w-[72px] sm:h-[72px] rounded-[18px] sm:rounded-[22px] flex items-center justify-center mb-2 sm:mb-3 shadow-lg" style={{ background: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 50%, #0284c7 100%)" }}>
                        <svg className="w-7 h-7 sm:w-9 sm:h-9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="5" />
                            <circle cx="12" cy="12" r="5" />
                            <circle cx="17.5" cy="6.5" r="1.2" fill="white" stroke="none" />
                        </svg>
                    </div>
                    <h1 className="text-xl sm:text-[26px] font-extrabold tracking-tight" style={{ fontFamily: "'Segoe UI', -apple-system, sans-serif", color: "#0c4a6e" }}>
                        Real Insights
                    </h1>
                    <p className="text-[11px] sm:text-[13px] font-medium tracking-widest uppercase" style={{ color: "#7dd3fc", marginTop: "2px" }}>
                        Premium Insights Tool
                    </p>
                </div>

                {/* ── Features & Power ── */}
                <div className="w-full max-w-md mb-4 flex flex-col gap-3">
                    {/* Power Highlight */}
                    <div style={{
                        background: "linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)",
                        borderRadius: "16px",
                        padding: "16px",
                        color: "white",
                        boxShadow: "0 10px 25px rgba(14,165,233,0.25)"
                    }}>
                        <div className="flex items-center gap-3 mb-2">
                            <Zap className="w-5 h-5 text-yellow-300" fill="currentColor" />
                            <h3 className="text-sm sm:text-[15px] font-bold">Ultimate Data Cloning Power</h3>
                        </div>
                        <p className="text-[11px] sm:text-[12px] text-sky-100 leading-relaxed font-medium">
                            Anonymously access hidden insights, reels, engagement metrics, and completely clone public profile data in seconds. 100% private.
                        </p>
                    </div>

                    {/* How to use */}
                    <div className="grid grid-cols-2 gap-3">
                        <div style={{
                            background: "rgba(255,255,255,0.7)",
                            borderRadius: "14px",
                            padding: "12px",
                            border: "1px solid rgba(14,165,233,0.15)",
                            boxShadow: "0 4px 15px rgba(0,0,0,0.02)"
                        }}>
                            <Users className="w-4 h-4 text-sky-500 mb-1.5" />
                            <h4 className="text-[11px] sm:text-xs font-bold text-sky-900 mb-1">1. Enter Username</h4>
                            <p className="text-[10px] sm:text-[11px] text-slate-500 leading-snug">Just input the target profile username.</p>
                        </div>
                        <div style={{
                            background: "rgba(255,255,255,0.7)",
                            borderRadius: "14px",
                            padding: "12px",
                            border: "1px solid rgba(14,165,233,0.15)",
                            boxShadow: "0 4px 15px rgba(0,0,0,0.02)"
                        }}>
                            <Eye className="w-4 h-4 text-sky-500 mb-1.5" />
                            <h4 className="text-[11px] sm:text-xs font-bold text-sky-900 mb-1">2. Get Full Insight</h4>
                            <p className="text-[10px] sm:text-[11px] text-slate-500 leading-snug">Instantly view hidden metrics & analytics.</p>
                        </div>
                    </div>
                </div>

                {/* ── Access Key Card ── */}
                <div className="w-full max-w-md">
                    <div className="p-5 sm:p-[28px_22px_22px]" style={{
                        background: "rgba(255,255,255,0.85)",
                        backdropFilter: "blur(20px)",
                        border: "1px solid rgba(56,189,248,0.2)",
                        borderRadius: "18px",
                        boxShadow: "0 4px 24px rgba(14,165,233,0.08)",
                    }}>
                        {/* Title */}
                        <div className="text-center mb-4">
                            <div className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl mb-2" style={{ background: "linear-gradient(135deg, #e0f2fe, #bae6fd)" }}>
                                <Lock className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: "#0284c7" }} />
                            </div>
                            <h2 className="text-[15px] sm:text-[17px] font-bold mb-1" style={{ color: "#0c4a6e" }}>
                                Enter Access Key
                            </h2>
                            <p className="text-[11px] sm:text-xs" style={{ color: "#94a3b8" }}>
                                Each key is locked to one device
                            </p>
                        </div>

                        {/* Key Input */}
                        <div className="mb-3">
                            <input
                                type="text"
                                value={key}
                                onChange={(e) => handleKeyChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="XXXX – XXXX – XXXX"
                                autoComplete="off"
                                spellCheck={false}
                                autoFocus
                                className="w-full text-center text-sm sm:text-base"
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: "12px",
                                    border: "2px solid #e0f2fe",
                                    background: "#f0f9ff",
                                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                                    letterSpacing: "2px",
                                    color: "#0c4a6e",
                                    outline: "none",
                                    transition: "all 0.3s ease",
                                }}
                                onFocus={(e) => { e.target.style.borderColor = "#38bdf8"; e.target.style.boxShadow = "0 0 0 4px rgba(56,189,248,0.15)"; }}
                                onBlur={(e) => { e.target.style.borderColor = "#e0f2fe"; e.target.style.boxShadow = "none"; }}
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-start gap-2 p-2.5 rounded-xl mb-3 text-xs" style={{
                                background: "#fef2f2",
                                border: "1px solid #fecaca",
                                color: "#dc2626",
                            }}>
                                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Login Button */}
                        <button
                            onClick={handleLogin}
                            disabled={loading || !key.trim()}
                            className="w-full flex items-center justify-center gap-2 text-sm sm:text-[15px] font-bold"
                            style={{
                                padding: "12px",
                                borderRadius: "12px",
                                border: "none",
                                background: loading || !key.trim()
                                    ? "linear-gradient(135deg, rgba(56,189,248,0.3), rgba(14,165,233,0.3))"
                                    : "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
                                color: "#ffffff",
                                cursor: loading || !key.trim() ? "default" : "pointer",
                                transition: "all 0.3s ease",
                                boxShadow: loading || !key.trim() ? "none" : "0 4px 14px rgba(14,165,233,0.3)",
                            }}
                        >
                            {loading ? (
                                <div style={{
                                    width: "18px", height: "18px",
                                    border: "2.5px solid rgba(255,255,255,0.3)",
                                    borderTopColor: "white",
                                    borderRadius: "50%",
                                    animation: "spin 0.6s linear infinite"
                                }} />
                            ) : (
                                <>
                                    Log In
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>

                        {/* Divider */}
                        <div className="flex items-center gap-4 my-3 sm:my-4">
                            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, #bae6fd, transparent)" }} />
                            <span className="text-[10px] sm:text-[11px] font-semibold" style={{ color: "#94a3b8" }}>OR</span>
                            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, #bae6fd, transparent)" }} />
                        </div>

                        {/* Device ID */}
                        <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px]" style={{ color: "#94a3b8" }}>
                            <Smartphone size={11} />
                            <span>Device: {deviceId}</span>
                        </div>
                    </div>
                </div>

            </div>

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default LoginScreen;
