import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const getDeviceSeed = () => {
  const ua = navigator.userAgent || "";
  const scr = `${window.screen.width}x${window.screen.height}`;
  let hash = 0;
  const str = ua + scr + (navigator.language || "");
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

type GridItem = { image: string; isReel?: boolean; views?: string; isPost?: boolean };

const ITEMS: GridItem[] = [
  { image: "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "1.7M" },
  { image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "22.1M" },
  { image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=faces", isReel: false },
  { image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "2.5M" },
  { image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "4.8M" },
  { image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop", isReel: true, views: "1.3M" },
  { image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "1.7M" },
  { image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=400&fit=crop", isReel: true, views: "2.3M" },
  { image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "3.4M" },
  { image: "https://images.unsplash.com/photo-1488161628813-04466f0cc7d4?w=400&h=400&fit=crop&crop=faces", isReel: false },
  { image: "https://images.unsplash.com/photo-1545291730-faff8ca1d4b0?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "2.4M" },
  { image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "1.1M" },
  { image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "567K" },
  { image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "1.7M" },
  { image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "4.8M" },
  { image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "2.1M" },
  { image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "780K" },
  { image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "12.4M" },
  { image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "3.8M" },
  { image: "https://images.unsplash.com/photo-1493106819501-66d381c466f3?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=400&fit=crop", isReel: true, views: "567K" },
  { image: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=400&fit=crop&crop=faces", isReel: true, views: "890K" },
];

// Build grid layout: groups of 6 tiles
// [0][1][2]   ← 3 small squares
// [3  ][4]   ← large (col-span-2, row-span-2) + small on right, odd groups flip
// [   ][5]
type TileInfo = GridItem & { colSpan: 1 | 2; rowSpan: 1 | 2 };

const buildLayout = (items: GridItem[]): TileInfo[] => {
  const result: TileInfo[] = [];
  for (let i = 0; i < items.length; i++) {
    const posInGroup = i % 6;
    const groupIndex = Math.floor(i / 6);
    // Position 3 in even groups → large tile (2×2)
    const isLarge = posInGroup === 3;
    result.push({
      ...items[i],
      colSpan: isLarge ? 2 : 1,
      rowSpan: isLarge ? 2 : 1,
    });
  }
  return result;
};

const PlayIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

const MultiIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
    <rect x="3" y="3" width="14" height="14" rx="2" />
    <path d="M8 21h10a2 2 0 002-2V8" />
  </svg>
);

const SearchScreen = () => {
  const [query, setQuery] = useState("");
  const [loadedMap, setLoadedMap] = useState<Record<number, boolean>>({});

  const shuffled = useMemo(() => seededShuffle(ITEMS, getDeviceSeed()), []);
  const layout = useMemo(() => buildLayout(shuffled), [shuffled]);

  const visible = query
    ? layout.filter((_, i) => i % 2 === 0).slice(0, 18)
    : layout;

  const cellPx = `calc((min(100vw, 430px) - 4px) / 3)`;

  return (
    <div className="pb-20 min-h-screen bg-background">
      {/* Search Bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-3 py-2.5">
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value) trackEvent("search", { query: e.target.value });
            }}
            placeholder="Search with Meta AI"
            data-testid="input-search"
            className="w-full h-[38px] rounded-[12px] bg-secondary pl-9 pr-10 text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              data-testid="button-search-clear"
              className="absolute right-3 flex items-center justify-center w-[20px] h-[20px] rounded-full bg-muted-foreground/40"
            >
              <X size={12} className="text-background" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* Explore Grid */}
      <div
        className="grid grid-cols-3 gap-[2px]"
        style={{ gridAutoRows: cellPx }}
      >
        {visible.map((item, i) => {
          const showMulti = !item.isReel && i % 7 === 0;
          const loaded = loadedMap[i];

          return (
            <div
              key={i}
              data-testid={`tile-explore-${i}`}
              className={cn(
                "relative overflow-hidden bg-secondary cursor-pointer",
                item.colSpan === 2 ? "col-span-2" : "",
                item.rowSpan === 2 ? "row-span-2" : ""
              )}
              onClick={() => trackEvent("explore_tap", { index: i })}
            >
              {/* Skeleton shimmer while loading */}
              {!loaded && (
                <div className="absolute inset-0 bg-secondary animate-pulse" />
              )}

              <img
                src={item.image}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                onLoad={() => setLoadedMap(prev => ({ ...prev, [i]: true }))}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />

              {/* Reel overlay */}
              {item.isReel && item.views && (
                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-[3px] drop-shadow-md">
                  <PlayIcon />
                  <span className="text-[11px] font-bold text-white leading-none">
                    {item.views}
                  </span>
                </div>
              )}

              {/* Multi-image icon */}
              {showMulti && (
                <div className="absolute top-1.5 right-1.5 drop-shadow-md">
                  <MultiIcon />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SearchScreen;
