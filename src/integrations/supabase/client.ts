/**
 * Supabase client replaced with a lightweight adapter
 * that calls our own server API routes.
 * Import unchanged: import { supabase } from "@/integrations/supabase/client";
 */

const reelsDataApi = {
  from: (_table: string) => ({
    select: (_cols?: string) => ({
      eq: (_col: string, val: unknown) => ({
        eq: (_col2: string, val2: unknown) => ({
          maybeSingle: async () => {
            const params = new URLSearchParams({ account: String(val) });
            const res = await fetch(`/api/reels-data?${params}`);
            if (!res.ok) return { data: null, error: await res.json() };
            const rows = await res.json();
            const match = rows.find((r: any) => r.post_index === val2);
            return { data: match ? { data: match.data } : null, error: null };
          },
        }),
        order: (_col2: string, _opts?: any) => ({
          limit: async (n: number) => {
            const params = new URLSearchParams({ account: String(val) });
            const res = await fetch(`/api/reels-data?${params}`);
            if (!res.ok) return { data: [], error: await res.json() };
            const rows = await res.json();
            return { data: rows.slice(0, n).map((r: any) => ({ ...r.data, post_index: r.post_index })), error: null };
          },
        }),
      }),
    }),
    upsert: async (payload: any, _opts?: any) => {
      const res = await fetch("/api/reels-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: payload.account,
          post_index: payload.post_index,
          data: payload.data,
        }),
      });
      if (!res.ok) return { error: await res.json() };
      return { error: null };
    },
  }),
};

const storageApi = {
  from: (_bucket: string) => ({
    upload: async (_filePath: string, file: File, _opts?: any) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/storage/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { data: null, error: err };
      }
      const data = await res.json();
      return { data: { path: data.url }, error: null };
    },
    getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
  }),
};

export const supabase = {
  from: (table: string) => reelsDataApi.from(table),
  storage: storageApi,
} as any;