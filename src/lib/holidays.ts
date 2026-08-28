/**
 * 中国法定节假日 + 调休规则表（2024-2030，按国务院办公厅发布的安排整理）。
 * - holiday: 法定节假日（带薪假，标"休"）
 * - workday: 调休补班日（周末但要上班，标"工"）
 * 国务院一般在每年 10-11 月发布次年安排；次年未发布前该表可能缺省，
 * 此时回退为普通双休判断（缺省年份不影响组件运行）。
 */

export type DayKind =
  | "holiday" // 法定节假日
  | "workday" // 调休补班
  | "weekend" // 普通双休
  | "work"; // 正常工作日/其他

const TABLE: Record<string, DayKind> = {};
const mark = (kind: DayKind, ...dates: string[]) => {
  for (const d of dates) TABLE[d] = kind;
};

/* ===== 2024 ===== */
mark("holiday",
  "2024-01-01",
  "2024-02-10", "2024-02-11", "2024-02-12", "2024-02-13", "2024-02-14", "2024-02-15", "2024-02-16", "2024-02-17",
  "2024-04-04", "2024-04-05", "2024-04-06",
  "2024-05-01", "2024-05-02", "2024-05-03", "2024-05-04", "2024-05-05",
  "2024-06-08", "2024-06-09", "2024-06-10",
  "2024-09-15", "2024-09-16", "2024-09-17",
  "2024-10-01", "2024-10-02", "2024-10-03", "2024-10-04", "2024-10-05", "2024-10-06", "2024-10-07",
);
mark("workday", "2024-02-04", "2024-02-18", "2024-04-07", "2024-04-28", "2024-05-11", "2024-09-14", "2024-09-29", "2024-10-12");

/* ===== 2025 ===== */
mark("holiday",
  "2025-01-01",
  "2025-01-28", "2025-01-29", "2025-01-30", "2025-01-31", "2025-02-01", "2025-02-02", "2025-02-03", "2025-02-04",
  "2025-04-04", "2025-04-05", "2025-04-06",
  "2025-05-01", "2025-05-02", "2025-05-03", "2025-05-04", "2025-05-05",
  "2025-05-31", "2025-06-01", "2025-06-02",
  "2025-10-01", "2025-10-02", "2025-10-03", "2025-10-04", "2025-10-05", "2025-10-06", "2025-10-07", "2025-10-08",
);
mark("workday", "2025-01-26", "2025-02-08", "2025-04-27", "2025-09-28", "2025-10-11");

/* ===== 2026（2026 全年假期安排已发布：新增除夕假，劳动节调休减少）===== */
mark("holiday",
  "2026-01-01", "2026-01-02", "2026-01-03",
  "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23",
  "2026-04-04", "2026-04-05", "2026-04-06",
  "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
  "2026-06-19", "2026-06-20", "2026-06-21",
  "2026-09-25", "2026-09-26", "2026-09-27",
  "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08",
);
mark("workday", "2026-02-28", "2026-09-30");

/* ===== 2027-2030：尚未发布，发布后补录；期间回退普通双休 ===== */

const pad = (n: number) => String(n).padStart(2, "0");
export const dateKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** 判断某日的类型（先查表，周末且未标"工"即为休） */
export function dayKind(y: number, m: number, d: number): DayKind {
  const key = dateKey(y, m, d);
  const t = TABLE[key];
  if (t) return t;
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6 ? "weekend" : "work";
}

/** 节假日名称（用于 tooltip，如"国庆节"）；调休日返回其所属假期 */
const NAMES: Record<string, string> = {};
const name = (n: string, ...dates: string[]) => {
  for (const d of dates) NAMES[d] = n;
};

name("元旦", "2026-01-01", "2026-01-02", "2026-01-03");
name("春节·除夕至初七",
  "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23");
name("清明节", "2026-04-04", "2026-04-05", "2026-04-06");
name("劳动节", "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05");
name("端午节", "2026-06-19", "2026-06-20", "2026-06-21");
name("中秋节", "2026-09-25", "2026-09-26", "2026-09-27");
name("国庆节", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08");
name("春节调休", "2026-02-28");
name("国庆·中秋连休调休", "2026-09-30");

export function dayName(y: number, m: number, d: number): string | undefined {
  return NAMES[dateKey(y, m, d)];
}

/* ============ 远程数据源（holiday-cn 开源数据集，逐年文件）============
 * 国务院每年 10-11 月发布次年安排后，该数据集数天内更新；
 * 本地表覆盖 2024-2026，之后年份自动联网获取并缓存，无需改代码。 */

export interface YearRule {
  kind: DayKind;
  name?: string;
}

interface RemoteDay {
  name?: string;
  date?: string;
  isOffDay?: boolean;
}

const remoteCache = new Map<number, { at: number; rules: Record<string, YearRule> }>();
const REMOTE_TTL = 7 * 24 * 3600 * 1000; // 成功缓存 7 天
const REMOTE_FAIL_TTL = 24 * 3600 * 1000; // 失败/空数据缓存 1 天（避免频繁探测）

/** 本地表中该年份是否有数据 */
function localYearCovered(y: number) {
  const prefix = `${y}-`;
  return Object.keys(TABLE).some((k) => k.startsWith(prefix));
}

/** 拉取一年的远程规则（holiday-cn），失败返回 null */
async function fetchRemoteYear(y: number): Promise<Record<string, YearRule> | null> {
  const urls = [
    `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${y}.json`,
    `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${y}.json`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const data = (await res.json()) as { year?: number; days?: RemoteDay[] };
      if (data.year !== y || !Array.isArray(data.days)) continue;
      const rules: Record<string, YearRule> = {};
      for (const day of data.days) {
        if (!day.date) continue;
        // isOffDay=true 法定假；false 调休补班
        rules[day.date] = {
          kind: day.isOffDay ? "holiday" : "workday",
          name: day.name,
        };
      }
      return rules;
    } catch {
      // 换下一个源
    }
  }
  return null;
}

/** 取某年完整规则：本地表优先，未覆盖年份联网补充（带缓存） */
export async function getYearRules(y: number): Promise<Record<string, YearRule>> {
  // 本地有数据的年份直接用（最可靠，含调休名）
  if (localYearCovered(y)) {
    const rules: Record<string, YearRule> = {};
    for (const [k, kind] of Object.entries(TABLE)) {
      if (k.startsWith(`${y}-`)) rules[k] = { kind, name: NAMES[k] };
    }
    return rules;
  }

  const cached = remoteCache.get(y);
  if (cached && Date.now() - cached.at < (Object.keys(cached.rules).length ? REMOTE_TTL : REMOTE_FAIL_TTL)) {
    return cached.rules;
  }

  const remote = await fetchRemoteYear(y);
  const rules = remote ?? {};
  remoteCache.set(y, { at: Date.now(), rules });
  return rules;
}
