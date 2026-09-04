/** 流式输出的情绪标记过滤器。
 *  标记格式 [mood:happy|comfort|sleepy|wink|surprise] 出现在回复末尾;
 *  流式下标记可能被拆在两个 delta 里,feed() 用"完整标记剥离 + 尾部前缀扣留"双层策略:
 *  先剥掉所有完整标记,再把结尾处可能是半个标记的后缀扣到 hold,下轮拼接再判。
 */
export type Mood = "happy" | "comfort" | "sleepy" | "wink" | "surprise";

export const MOOD_RE = /\[mood:\s*(happy|comfort|sleepy|wink|surprise)\s*\]/g;

const PREFIX = "[mood:";

/** 非流式一次性剥离(服务端/整段文本用) */
export function stripMood(text: string): { text: string; mood: Mood | null } {
  let last: Mood | null = null;
  const stripped = text.replace(MOOD_RE, (_m, g1: string) => {
    last = g1 as Mood;
    return "";
  });
  return { text: stripped, mood: last };
}

export function createMoodFilter() {
  let hold = "";
  let mood: Mood | null = null;
  return {
    get mood(): Mood | null {
      return mood;
    },
    /** 喂入一个 delta,返回可安全显示的部分 */
    feed(text: string): string {
      const { text: stripped, mood: m } = stripMood(hold + text);
      if (m) mood = m;
      // 尾部若可能是被拆开的标记前缀("[" ~ "[mood:"),扣下等下一轮
      let keep = stripped.length;
      const maxCheck = Math.min(stripped.length, PREFIX.length);
      for (let l = maxCheck; l > 0; l--) {
        if (PREFIX.startsWith(stripped.slice(stripped.length - l))) {
          keep = stripped.length - l;
          break;
        }
      }
      hold = stripped.slice(keep);
      return stripped.slice(0, keep);
    },
    /** 流结束:吐回残缺部分(不是完整标记就当正文,肉眼无感) */
    flush(): string {
      const rest = hold;
      hold = "";
      return rest;
    },
  };
}
