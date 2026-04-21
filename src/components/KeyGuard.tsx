import { useEffect, useState, useRef } from "react";
import { getDeviceFingerprint, clearAuthSession, getAuthSession } from "@/lib/auth";


export default function KeyGuard({ children }: { children: React.ReactNode }) {
    const [isVerified, setIsVerified] = useState(false);
    const failCountRef = useRef(0);

    useEffect(() => {
        // Anti-DevTools / Anti-Right Click Protection
        const blockDevTools = (e: KeyboardEvent) => {
            if (
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
                (e.ctrlKey && e.key === 'U')
            ) {
                e.preventDefault();
                return false;
            }
        };
        const blockContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            return false;
        };

        window.addEventListener('keydown', blockDevTools);
        window.addEventListener('contextmenu', blockContextMenu);

        let mounted = true;

        const checkKey = async () => {
            const session = getAuthSession();
            if (!session) {
                clearAuthSession();
                if (window.location.pathname !== "/") {
                    window.location.replace("/");
                }
                return;
            }

            try {
                const currentFingerprint = session.deviceFingerprint || getDeviceFingerprint();

                const res = await fetch("/api/check-key-status", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ key: session.key, deviceFingerprint: currentFingerprint }),
                    signal: AbortSignal.timeout(15000)
                });

                const data = await res.json().catch(() => ({}));

                if (!mounted) return;

                if (res.ok && data.valid === true) {
                    setIsVerified(true);
                } else {
                    // Key revoked/expired/invalid — logout immediately
                    console.log("[KeyGuard] Key rejected — logging out immediately");
                    clearAuthSession();
                    window.location.replace("/");
                }
            } catch (err) {
                // Network error - stay logged in if already verified, otherwise we wait
                console.log("[KeyGuard] Network or Server error.", err);
                if (mounted && !isVerified) {
                    // Fallback local check if server is unreachable and we've never verified
                    // We shouldn't let them in if we haven't explicitly verified.
                    // But if it's just a network error, maybe wait?
                    // Actually, if we don't verify, we don't render. Period.
                }
            }
        };

        checkKey();

        // Check every 30s
        const interval = setInterval(checkKey, 30000);

        return () => {
            mounted = false;
            clearInterval(interval);
            window.removeEventListener('keydown', blockDevTools);
            window.removeEventListener('contextmenu', blockContextMenu);
        };
    }, []);

    if (!isVerified) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-black/95 z-[9999]" onContextMenu={(e) => e.preventDefault()}>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-white/60 text-xs font-medium tracking-wide">Validating your access...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}