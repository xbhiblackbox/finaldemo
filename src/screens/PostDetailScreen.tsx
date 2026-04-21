import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Heart, Bookmark } from "lucide-react";
import { motion } from "framer-motion";
import { mockAccounts } from "@/data/mockData";
import { loadReelsData, loadAccountReelEdits } from "@/data/reelInsightsData";
import { useInstagramData, getConnectedUsername, proxyIgImage } from "@/lib/instagramApi";
import { getIgMediaByCode } from "@/lib/instagramMedia";
import { cn } from "@/lib/utils";

const fmtK = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
};

const PostDetailScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const accountUsername = searchParams.get("account") || "just4abhii";
  const igCodeParam = searchParams.get("ig") || "";
  const index = parseInt(id || "0", 10);

  const account = mockAccounts[accountUsername];
  const isMain = accountUsername === "just4abhii";

  // Live IG fetch
  const connectedIg = getConnectedUsername();
  const igEnabled = isMain && !!connectedIg;
  const { data: igData } = useInstagramData(igEnabled ? connectedIg : undefined, "all");

  const [liked, setLiked] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!account) navigate("/profile");
  }, [account, navigate]);

  if (!account) return null;

  // Resolve post data
  const post = account.posts[index];
  const reelsLocal = isMain ? loadReelsData() : null;
  const localData = reelsLocal?.[index];
  const accountEdits = !isMain ? loadAccountReelEdits(accountUsername) : {};
  const editedAcc = !isMain ? accountEdits[index] : null;
  const igMediaList = igData ? [...(igData.reels || []), ...(igData.posts || [])].sort((a, b) => (b.takenAt || 0) - (a.takenAt || 0)) : [];
  const igMatch = getIgMediaByCode(igMediaList, igCodeParam, index);

  const image = proxyIgImage(igMatch?.thumbnail) || editedAcc?.thumbnail || localData?.thumbnail || (post as any)?.image || "";
  const caption = editedAcc?.caption || igMatch?.caption || localData?.caption || "🔥 New post ✨";
  const likes = localData?.insights?.likes ?? editedAcc?.insights?.likes ?? igMatch?.likes ?? 256;
  const comments = localData?.insights?.comments ?? editedAcc?.insights?.comments ?? igMatch?.comments ?? 2;
  const sends = localData?.insights?.shares ?? editedAcc?.insights?.shares ?? igMatch?.shares ?? 1;
  const username = account.profile.username;

  const goInsights = () => {
    const igParam = igMatch?.code ? `?ig=${encodeURIComponent(igMatch.code)}` : "";
    navigate(`/reel-insights/${index}${igParam}`);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-background flex flex-col text-foreground"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      {/* Header */}
      <header className="flex items-center gap-4 px-4 h-[48px] border-b border-border/40 shrink-0">
        <button onClick={() => navigate(-1)} className="text-foreground active:opacity-60">
          <ArrowLeft size={24} strokeWidth={2} />
        </button>
        <h1 className="text-[17px] font-bold">Posts</h1>
      </header>

      {/* Scrollable post */}
      <div className="flex-1 overflow-y-auto">
        {/* Image */}
        <div className="w-full bg-black">
          <img
            src={image}
            alt="Post"
            className="w-full max-h-[80vh] object-contain"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* View Insights + Boost Post row */}
        <div className="flex items-center justify-between px-4 py-3 bg-background">
          <button onClick={goInsights} className="flex items-center gap-1.5 active:opacity-70">
            <svg width="16" height="13" viewBox="0 0 120 100">
              <defs>
                <mask id="post-eye-mask">
                  <rect width="120" height="100" fill="white" />
                  <circle cx="74" cy="48" r="14" fill="black" />
                </mask>
              </defs>
              <path d="M15 45 C30 8, 90 8, 105 45" stroke="currentColor" strokeWidth="10" strokeLinecap="round" fill="none" />
              <circle cx="60" cy="62" r="30" fill="currentColor" mask="url(#post-eye-mask)" />
            </svg>
            <span className="text-[14px] text-foreground font-normal">
              {fmtK(likes)} · <span className="font-medium">View Insights</span>
            </span>
          </button>
          <button className="bg-[#0095f6] text-white text-[13px] font-semibold px-4 py-2 rounded-lg active:opacity-90">
            Boost Post
          </button>
        </div>

        {/* Action row: like, comment, share, save */}
        <div className="flex items-center justify-between px-4 pb-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLiked(v => !v)}
              className="flex items-center gap-1.5 active:scale-90 transition-transform"
            >
              <Heart size={26} className={cn(liked ? "fill-[#FF3040] text-[#FF3040]" : "text-foreground")} strokeWidth={1.7} />
              <span className="text-[14px] font-semibold">{fmtK(likes + (liked ? 0 : 0))}</span>
            </button>
            <button className="flex items-center gap-1.5 active:scale-90 transition-transform">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "scaleX(-1)" }}>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <span className="text-[14px] font-semibold">{fmtK(comments)}</span>
            </button>
            <button className="flex items-center gap-1.5 active:scale-90 transition-transform">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <span className="text-[14px] font-semibold">{fmtK(sends)}</span>
            </button>
          </div>
          <button onClick={() => setSaved(v => !v)} className="active:scale-90 transition-transform">
            <Bookmark size={26} className={cn(saved ? "fill-foreground text-foreground" : "text-foreground")} strokeWidth={1.7} />
          </button>
        </div>

        {/* Caption */}
        <div className="px-4 pb-4">
          <p className="text-[14px] leading-[19px] text-foreground">
            <span className="font-semibold mr-1.5">{username}</span>
            {caption}
          </p>
          <p className="text-[12px] text-muted-foreground mt-2">6 days ago · See translation</p>
        </div>
      </div>
    </motion.div>
  );
};

export default PostDetailScreen;
