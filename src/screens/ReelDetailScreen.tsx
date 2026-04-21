import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Heart, MessageCircle, Send, Bookmark, MoreVertical, ArrowLeft } from "lucide-react";
import { mockAccounts, currentUser, loadFeedVideos } from "@/data/mockData";
import { loadReelsData, loadAccountReelEdits } from "@/data/reelInsightsData";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import CommentsSheet from "@/components/CommentsSheet";
import ShareSheet from "@/components/ShareSheet";
import { useInstagramData, getConnectedUsername, proxyIgImage } from "@/lib/instagramApi";
import { getPlayableVideoUrl } from "@/lib/instagramMedia";

const CameraIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const fmtK = (n: number) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
};

// ─── Single Reel Card for Profile Reels Scroll ──────────────────────────
interface ProfileReelData {
  index: number;
  thumbnail: string;
  videoUrl?: string;
  caption: string;
  musicTitle: string;
  musicIcon: string;
  likes: number;
  comments: number;
  sends: number;
  saves: number;
  views: string;
  accountUsername: string;
  profileAvatar: string;
  profileUsername: string;
  isReel?: boolean;
}

const ProfileReelCard = ({
  data,
  isActive,
  onNavigateInsights,
}: {
  data: ProfileReelData;
  isActive: boolean;
  onNavigateInsights: () => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(true);
  const [saved, setSaved] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const lastTap = useRef(0);

  // (Long-press editing removed — edit only via Reel Insights screen)
  const [likeCount, setLikeCount] = useState(data.likes);
  const [commentCount, setCommentCount] = useState(data.comments);
  const [sendCount, setSendCount] = useState(data.sends);
  const [saveCount, setSaveCount] = useState(data.saves);

  // Auto-play/pause based on isActive
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isActive) {
      vid.currentTime = 0;
      vid.muted = true;
      vid.play().catch(() => { });
      // Try unmuting after play
      setTimeout(() => { try { vid.muted = false; } catch { } }, 200);
    } else {
      vid.pause();
    }
  }, [isActive]);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) {
        setLiked(true);
        setLikeCount(c => c + 1);
        setLikeAnimating(true);
        setTimeout(() => setLikeAnimating(false), 350);
      }
      setShowDoubleTapHeart(true);
      setTimeout(() => setShowDoubleTapHeart(false), 900);
    }
    lastTap.current = now;
  };

  return (
    <>
      <div className="relative w-full h-full bg-black overflow-hidden" onClick={handleTap}>
        {/* Video or Image */}
        {data.videoUrl ? (
          <video
            ref={videoRef}
            src={data.videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            loop
            playsInline
            preload="metadata"
          />
        ) : data.thumbnail ? (
          <img src={data.thumbnail} alt="Reel" className="absolute inset-0 w-full h-full object-cover" />
        ) : null}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

        {/* Double tap heart */}
        {showDoubleTapHeart && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.175, 0.885, 0.32, 1.275] }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <Heart size={100} className="fill-white text-white drop-shadow-2xl" />
          </motion.div>
        )}

        {/* Right side actions */}
        <div className="absolute right-5 bottom-[130px] flex flex-col items-center gap-5 z-10">
          {/* Heart */}
          <button
            onClick={(e) => { e.stopPropagation(); setLiked(!liked); setLikeCount(c => liked ? c - 1 : c + 1); }}
            className={cn("flex flex-col items-center gap-0.5", likeAnimating && "ig-like-bounce")}
          >
            <Heart size={30} className={cn(liked ? "fill-[#FF3040] text-[#FF3040]" : "text-white")} />
            <span className="text-[12px] text-white font-semibold">{fmtK(likeCount)}</span>
          </button>
          {/* Comment */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
            className="flex flex-col items-center gap-0.5"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "scaleX(-1)" }}>
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <span className="text-[12px] text-white font-semibold">{fmtK(commentCount)}</span>
          </button>
          {/* Repost */}
          <button onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-0.5">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 12V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 12v3a4 4 0 0 1-4 4H3" />
            </svg>
          </button>
          {/* Send */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowShare(true); }}
            className="flex flex-col items-center gap-0.5"
          >
            <svg width="28" height="28" viewBox="0 0 24 24">
              <path d="M21.39 2.97c.46-.46.06-1.24-.56-1.06L2.42 6.86c-.56.16-.6.95-.06 1.18l6.93 2.97 6.18-4.47c.24-.18.5.1.3.32l-4.47 6.18 2.97 6.93c.22.54 1.02.5 1.18-.06l4.94-18.41c.04-.14.02-.28-.04-.4l.04-.13z" fill="none" stroke="white" strokeWidth="1.2" />
            </svg>
            <span className="text-[12px] text-white font-semibold">{fmtK(sendCount)}</span>
          </button>
          {/* Bookmark */}
          <button
            onClick={(e) => { e.stopPropagation(); setSaved(!saved); setSaveCount(c => saved ? c - 1 : c + 1); }}
            className="flex flex-col items-center gap-0.5"
          >
            <svg width="30" height="30" viewBox="0 0 24 24">
              <path d="M4 2h16v20l-8-5.5L4 22V2z" fill={saved ? 'white' : 'none'} stroke="white" strokeWidth="1.5" />
            </svg>
            <span className="text-[12px] text-white font-semibold">{fmtK(saveCount)}</span>
          </button>
          {/* 3 dots */}
          <button onClick={(e) => e.stopPropagation()} className="text-white">
            <MoreVertical size={24} />
          </button>
          {/* Music disc — show music thumb if music set, else small avatar (original audio) */}
          <div className="w-[30px] h-[30px] rounded-[6px] border-[1.5px] border-white/40 overflow-hidden">
            <img
              src={data.musicIcon || data.profileAvatar}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-3" onClick={(e) => e.stopPropagation()}>
          {/* Username + Music (or Original audio fallback) */}
          <div className="flex items-start gap-1.5 mb-1">
            <img src={data.profileAvatar} alt="" className="h-[28px] w-[28px] rounded-full object-cover border border-white/30 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-white leading-tight">{data.profileUsername}</span>
              <div className="flex items-center gap-1 mt-[2px]">
                {data.musicTitle ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                      <path d="M9 17V4l10-2v13" stroke="white" strokeWidth="2.5" fill="none" />
                      <ellipse cx="5.5" cy="17.5" rx="3.5" ry="2.5" fill="white" />
                      <ellipse cx="15.5" cy="15.5" rx="3.5" ry="2.5" fill="white" />
                    </svg>
                    <span className="text-[11px] text-white/70 truncate">{data.musicTitle}</span>
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                      <path d="M9 17V4l10-2v13" stroke="white" strokeWidth="2.5" fill="none" />
                      <ellipse cx="5.5" cy="17.5" rx="3.5" ry="2.5" fill="white" />
                      <ellipse cx="15.5" cy="15.5" rx="3.5" ry="2.5" fill="white" />
                    </svg>
                    <span className="text-[11px] text-white/70 truncate">{data.profileUsername} · Original audio</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Caption */}
          <div className="mb-1.5 mt-1">
            {data.caption.length > 50 && !showFullCaption ? (
              <p className="text-[13px] text-white/90 leading-[17px] break-words">
                {data.caption.slice(0, 50)}...{" "}
                <button onClick={() => setShowFullCaption(true)} className="text-white/50">more</button>
              </p>
            ) : (
              <p className="text-[13px] text-white/90 leading-[17px] break-words">{data.caption}</p>
            )}
          </div>

          {/* View Insights + Boost Reel */}
          <div className="border-t-[2px] border-white/25 mt-1" />
          <div className="flex items-center justify-between pt-4 pb-2 px-4">
            <button onClick={onNavigateInsights} className="flex items-center gap-1.5">
              <svg width="13" height="11" viewBox="0 0 120 100">
                <defs>
                  <mask id={`eye-mask-${data.index}`}>
                    <rect width="120" height="100" fill="white" />
                    <circle cx="74" cy="48" r="14" fill="black" />
                  </mask>
                </defs>
                <path d="M15 45 C30 8, 90 8, 105 45" stroke="white" strokeWidth="10" strokeLinecap="round" fill="none" />
                <circle cx="60" cy="62" r="30" fill="white" mask={`url(#eye-mask-${data.index})`} />
              </svg>
              <span className="text-[12px] text-white/90 font-normal">{String(data.views).replace(/(\s*(likes?|views?))+$/i, "").trim()} · View Insights</span>
            </button>
            <button className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-85">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span className="text-[12px] text-white/90 font-normal">{data.isReel === false ? "Boost Post" : "Boost Reel"}</span>
            </button>
          </div>

          {/* Comment bar */}
          <div className="bg-black -mx-3 px-3 pb-2.5 pt-3 mt-1.5">
            <div className="bg-[#262626] rounded-full px-4 py-2.5 flex items-center">
              <span className="text-[14px] text-white/40">Add comment...</span>
            </div>
          </div>
        </div>
      </div>

      <CommentsSheet isOpen={showComments} onClose={() => setShowComments(false)} postUsername={data.profileUsername} />
      <ShareSheet isOpen={showShare} onClose={() => setShowShare(false)} />

    </>
  );
};

// ─── Main ReelDetailScreen with vertical scroll ─────────────────────────────
const ReelDetailScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const searchParams = new URLSearchParams(window.location.search);
  const accountUsername = searchParams.get("account") || "just4abhii";
  const igCodeParam = searchParams.get("ig") || "";
  const account = mockAccounts[accountUsername] || mockAccounts["just4abhii"] || Object.values(mockAccounts)[0];
  const startIndex = parseInt(id || "0");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(startIndex);

  const isMainAccount = accountUsername === "just4abhii" || account?.profile === currentUser;
  const connectedIg = getConnectedUsername();
  // For the main account use the connected IG handle; for any other mock account
  // (e.g. Organicsmm.pro) fetch live IG data using its own username so caption,
  // username, avatar and counts come from the real reel.
  const igHandle = isMainAccount ? connectedIg : accountUsername;
  const igEnabled = !!igHandle;
  const { data: igData } = useInstagramData(igEnabled ? igHandle : undefined, "all");

  const reelsData = isMainAccount ? loadReelsData() : null;
  const accountEdits = !isMainAccount ? loadAccountReelEdits(accountUsername) : {};

  // Build IG media list (sorted desc by date) for cross-referencing
  const igMediaList = igData ? [...(igData.reels || []), ...(igData.posts || [])].sort((a, b) => (b.takenAt || 0) - (a.takenAt || 0)) : [];

  // Live profile (avatar/username) from scraped IG data when available
  const liveProfile = igData?.profile;
  const displayUsername = liveProfile?.username || account.profile.username;
  const displayAvatar = proxyIgImage(liveProfile?.avatarUrl) || account.profile.avatar;

  // Build all reels data for this profile
  const reelCount = igEnabled && igMediaList.length > 0 ? igMediaList.length : account.posts.length;

  const allProfileReels: ProfileReelData[] = Array.from({ length: reelCount }, (_, index) => {
    const post = account.posts[index];
    const reelData = isMainAccount && reelsData ? reelsData[index] : null;
    // Per-account edits (sparse) — overlay for non-main accounts (e.g. Organicsmm.pro)
    const accEdit = !isMainAccount ? accountEdits[index] : null;
    const ins = reelData?.insights || (accEdit?.insights as any) || null;
    const igReel = igEnabled ? igMediaList[index] : null;

    const thumb = proxyIgImage(igReel?.thumbnail) || reelData?.thumbnail || accEdit?.thumbnail || post?.thumbnail || "";
    const videoUrl = getPlayableVideoUrl(igReel?.videoUrl, reelData?.videoUrl, accEdit?.videoUrl, post?.videoUrl);
    // Prefer manual edited caption, then real scraped caption, then fallbacks.
    const caption = (accEdit?.caption ?? reelData?.caption) || igReel?.caption || (post as any)?.caption || "";
    // Manual edits in Reel Insights (saved to localStorage) always win — these are the
    // values the user explicitly set, so they should override API/scraped numbers and
    // remain consistent even if the scraper fails or returns different data.
    const likes = ins?.likes ?? igReel?.likes ?? 725;
    const comments = ins?.comments ?? igReel?.comments ?? 10;
    const sends = ins?.shares ?? igReel?.shares ?? 24;
    const saves = ins?.saves ?? 60;
    const views = ins?.views || igReel?.views || 0;

    const isReelItem = (post as any)?.isReel !== false && (!!videoUrl || !!(post as any)?.isReel || !!igReel);
    const viewsLabel = views > 0
      ? `${fmtK(views)} views`
      : isReelItem
        ? `${fmtK(likes || 7000)} views`
        : `${fmtK(likes)} likes`;

    return {
      index,
      thumbnail: thumb,
      videoUrl,
      caption,
      musicTitle: reelData?.musicTitle || "",
      musicIcon: reelData?.musicIcon || "",
      likes,
      comments,
      sends,
      saves,
      views: viewsLabel,
      accountUsername,
      profileAvatar: displayAvatar,
      profileUsername: displayUsername,
      igCode: igReel?.code || "",
      isReel: isReelItem,
    } as ProfileReelData & { igCode?: string };
  });

  // Scroll to the initial reel on mount
  useEffect(() => {
    if (!account) {
      navigate('/profile');
    }
  }, [account, navigate]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // Wait for layout
    requestAnimationFrame(() => {
      const height = container.clientHeight;
      container.scrollTo({ top: startIndex * height, behavior: "instant" as ScrollBehavior });
    });
  }, [startIndex]);

  // Detect active reel on scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollTop = container.scrollTop;
        const height = container.clientHeight;
        const newIndex = Math.round(scrollTop / height);
        setActiveIndex(newIndex);
        ticking = false;
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [allProfileReels.length]);

  if (!account) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black z-50 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header - absolute over reels */}
      <div className="absolute top-0 left-0 right-0 z-[60] flex items-center justify-between px-4 pt-10 pb-2 pointer-events-none">
        <button onClick={() => navigate('/profile')} className="text-white active:opacity-60 p-1 pointer-events-auto">
          <ArrowLeft size={24} strokeWidth={2} />
        </button>
        <button className="text-white active:opacity-60 p-1 pointer-events-auto">
          <CameraIcon />
        </button>
      </div>

      {/* Scrollable reels container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {allProfileReels.map((reel, index) => (
          <div
            key={`profile-reel-${index}`}
            className="w-full"
            style={{
              height: "100vh",
              scrollSnapAlign: "start",
              scrollSnapStop: "always",
            }}
          >
            <ProfileReelCard
              data={reel}
              isActive={index === activeIndex}
              onNavigateInsights={() => {
                const ig = (reel as any).igCode ? `&ig=${encodeURIComponent((reel as any).igCode)}` : "";
                navigate(`/reel-insights/${index}?account=${accountUsername}${ig}`);
              }}
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default ReelDetailScreen;
