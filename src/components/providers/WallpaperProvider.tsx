"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** 访客壁纸偏好；null = 未覆盖 → 用后台配置值 */
export interface WallpaperPrefs {
  /** "auto" = 9s 轮播（默认）；数字 = 固定第 N 张 */
  pick: "auto" | number;
  /** 遮罩浓度覆盖 0–0.8 */
  mask: number | null;
  /** 磨砂模糊覆盖 px 0–24 */
  blur: number | null;
}

/** 服务端下发的背景配置（getSiteConfig → (site)/layout → Provider） */
export interface WallpaperServerConfig {
  mode: "image" | "gradient";
  images: string[];
  palette: string[];
  maskOpacity: number;
  maskBlur: number;
}

const LS_KEY = "cl-wallpaper";
const DEFAULT_PREFS: WallpaperPrefs = { pick: "auto", mask: null, blur: null };

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

interface WallpaperCtx {
  server: WallpaperServerConfig;
  prefs: WallpaperPrefs;
  /** 合并写 + localStorage 持久化（值域 clamp 在写入时做） */
  setPrefs: (patch: Partial<WallpaperPrefs>) => void;
  /** 整组回到默认（面板区块「恢复默认」按钮用） */
  reset: () => void;
  /** 合并结果：BackgroundLayer 直接消费 */
  effective: {
    /** 非 null = 固定第 N 张（停轮播） */
    fixedIndex: number | null;
    maskOpacity: number;
    maskBlur: number;
  };
}

const Ctx = createContext<WallpaperCtx>({
  server: { mode: "gradient", images: [], palette: [], maskOpacity: 0.15, maskBlur: 0 },
  prefs: DEFAULT_PREFS,
  setPrefs: () => {},
  reset: () => {},
  effective: { fixedIndex: null, maskOpacity: 0.15, maskBlur: 0 },
});

export const useWallpaper = () => useContext(Ctx);

/** 校验/收敛偏好：pick 越界（后台删图换图）回退 auto，mask/blur 夹到值域 */
const sanitize = (
  prefs: WallpaperPrefs,
  imageCount: number,
): WallpaperPrefs => ({
  pick:
    prefs.pick === "auto" || (Number.isInteger(prefs.pick) && prefs.pick >= 0 && prefs.pick < imageCount)
      ? prefs.pick
      : "auto",
  mask: prefs.mask === null ? null : clamp(prefs.mask, 0, 0.8),
  blur: prefs.blur === null ? null : clamp(prefs.blur, 0, 24),
});

/**
 * 壁纸访客偏好：后台配置为默认值，访客本地覆盖（选中某张 / 遮罩 / 模糊）。
 * 初始 state 固定默认值（SSR 与客户端首渲染一致，零 mismatch），
 * 挂载后读 localStorage 再收敛 —— 用户固定第 N 张时借 BackgroundLayer
 * 现成的交叉淡入过渡到所选图，可接受的同风格短暂淡入。
 */
export function WallpaperProvider({
  server,
  children,
}: {
  server: WallpaperServerConfig;
  children: ReactNode;
}) {
  const [prefs, setPrefsState] = useState<WallpaperPrefs>(DEFAULT_PREFS);

  // 依赖 imageCount：后台改壁纸列表后重读 localStorage 并重新校验越界
  useEffect(() => {
    let stored: Partial<WallpaperPrefs> = {};
    try {
      stored = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Partial<WallpaperPrefs>;
    } catch {}
    setPrefsState(sanitize({ ...DEFAULT_PREFS, ...stored }, server.images.length));
  }, [server.images.length]);

  const setPrefs = useCallback(
    (patch: Partial<WallpaperPrefs>) => {
      setPrefsState((prev) => {
        const next = sanitize({ ...prev, ...patch }, server.images.length);
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [server.images.length],
  );

  const reset = useCallback(() => setPrefs(DEFAULT_PREFS), [setPrefs]);

  const effective = useMemo(
    () => ({
      fixedIndex: prefs.pick === "auto" ? null : prefs.pick,
      maskOpacity: prefs.mask ?? server.maskOpacity,
      maskBlur: prefs.blur ?? server.maskBlur,
    }),
    [prefs, server.maskOpacity, server.maskBlur],
  );

  return (
    <Ctx.Provider value={{ server, prefs, setPrefs, reset, effective }}>
      {children}
    </Ctx.Provider>
  );
}
