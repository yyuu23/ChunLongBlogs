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
      // 尾部若可能是被拆开的"半个标记"则整段扣下等下一轮。两种形态都要接住:
      //   "[" ~ "[mood:"   —— 前缀被拆（原有行为）
      //   "[mood:ha"       —— 前缀完整、词或 ] 半截（曾泄漏进正文的形态）
      let keep = stripped.length;
      const li = stripped.lastIndexOf("[");
      if (li >= 0) {
        const tail = stripped.slice(li);
        if (
          stripped.length - li <= 20 && // 防正文中的 "[" 误扣长段
          ((tail.startsWith(PREFIX) && !tail.includes("]")) || PREFIX.startsWith(tail))
        ) {
          keep = li;
        }
      }
      hold = stripped.slice(keep);
      return stripped.slice(0, keep);
    },
    /** 流结束:吐回残缺部分 —— 但半个情绪标记永不展示,直接丢弃 */
    flush(): string {
      const rest = hold;
      hold = "";
      const li = rest.lastIndexOf("[");
      if (li >= 0) {
        const tail = rest.slice(li);
        if ((tail.startsWith(PREFIX) && !tail.includes("]")) || PREFIX.startsWith(tail)) {
          return rest.slice(0, li);
        }
      }
      return rest;
    },
  };
}
