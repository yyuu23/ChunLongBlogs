/** 看板娘好感度：等级阶梯 + 语气注入（服务端结算、客户端展示共用） */
import { type LText } from "@/lib/i18n/config";

/** 升级所需累计好感（比 XP 曲线慢，营造长线陪伴感） */
export const AFFINITY_STEPS = [0, 30, 90, 200, 400] as const;

export const AFFINITY_LEVELS: LText[] = [
  { zh: "初见", en: "First Meeting", ja: "初めまして", ko: "첫 만남" },
  { zh: "熟络", en: "Getting Familiar", ja: "打ち解け合う", ko: "친해지는 중" },
  { zh: "常伴", en: "Good Company", ja: "いつもそばに", ko: "늘 곁에" },
  { zh: "知心", en: "Close at Heart", ja: "心の友", ko: "마음의 친구" },
  { zh: "羁绊", en: "Bonded", ja: "絆", ko: "인연" },
];

/** 好感 → 等级（1-5）与升级进度；满级 progress = 1、nextNeed = null */
export function affinityOf(points: number) {
  let level = 1;
  for (let i = 0; i < AFFINITY_STEPS.length; i++) {
    if (points >= AFFINITY_STEPS[i]) level = i + 1;
  }
  const currentNeed = AFFINITY_STEPS[level - 1]!;
  const nextNeed = level < AFFINITY_STEPS.length ? AFFINITY_STEPS[level]! : null;
  return {
    level,
    currentNeed,
    nextNeed,
    progress: nextNeed ? Math.min(1, (points - currentNeed) / (nextNeed - currentNeed)) : 1,
  };
}

/** 好感度语气注入：等级影响 AI 说话的亲疏（拼进 /api/chat 的 system prompt） */
export function affinityTonePrompt(level: number): string {
  if (level >= 5)
    return "[好感度：羁绊] 这位访客与你已经非常亲密了，像老朋友、家人一样自然亲昵地说话，可以主动撒娇、记挂对方近况。";
  if (level === 4)
    return "[好感度：知心] 这位访客是你很亲近的朋友，语气亲近自然，可以适当主动表达关心。";
  if (level === 3)
    return "[好感度：常伴] 这位访客常来看你，语气熟稔友好，像熟人之间打招呼聊天。";
  if (level === 2) return "[好感度：熟络] 这位访客来过几次了，语气可以放松一些、更自然随意。";
  return "[好感度：初见] 这位访客还和你不熟，礼貌友好，保持一点分寸感。";
}
