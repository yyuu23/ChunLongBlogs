/**
 * 写作助手（选区 AI 工具箱 + 续写）：动作定义、入参校验与 prompt 拼装。
 * 纯逻辑无 IO，供 /api/admin/assist 路由消费，vitest 直接测。
 */

export type AssistAction =
  | "rewrite"
  | "expand"
  | "shorten"
  | "translate_en"
  | "translate_zh"
  | "explain"
  | "custom"
  | "continue";

export interface AssistParams {
  action: AssistAction;
  /** 选区内容（continue 之外必填，10–4000 字） */
  selection?: string;
  /** 选区前文 / 后文（各 ~500 字，仅供模型理解语境） */
  contextBefore?: string;
  contextAfter?: string;
  /** custom 动作的自定义指令（必填，≤500 字） */
  instruction?: string;
  /** 文章标题（可选，帮助模型理解主题） */
  title?: string;
  /** continue 动作：光标前上文（≤1500 字） */
  context?: string;
}

/** 动作中文名（UI 工具条与 ai_tool 打点共用） */
export const ASSIST_ACTION_LABEL: Record<AssistAction, string> = {
  rewrite: "改写",
  expand: "扩写",
  shorten: "缩写",
  translate_en: "译为英文",
  translate_zh: "译为中文",
  explain: "解释",
  custom: "自定义",
  continue: "续写",
};

const SELECTION_MIN = 10;
const SELECTION_MAX = 4000;
const CONTEXT_MAX = 1500;
const INSTRUCTION_MAX = 500;

type ValidateResult =
  | { ok: true; params: AssistParams }
  | { ok: false; error: string };

/** 不可信入参一律钳制（长度/类型/白名单动作） */
export function validateAssistParams(raw: unknown): ValidateResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "请求格式错误" };
  }
  const body = raw as Record<string, unknown>;
  const action = body.action;
  if (typeof action !== "string" || !(action in ASSIST_ACTION_LABEL)) {
    return { ok: false, error: "未知动作" };
  }
  const clip = (v: unknown, max: number): string =>
    typeof v === "string" ? v.slice(0, max) : "";
  const params: AssistParams = {
    action: action as AssistAction,
    selection: clip(body.selection, SELECTION_MAX),
    contextBefore: clip(body.contextBefore, CONTEXT_MAX),
    contextAfter: clip(body.contextAfter, CONTEXT_MAX),
    instruction: clip(body.instruction, INSTRUCTION_MAX),
    title: clip(body.title, 100),
    context: clip(body.context, CONTEXT_MAX),
  };

  if (params.action === "continue") {
    if ((params.context ?? "").trim().length < 20) {
      return { ok: false, error: "上文太短，先写点内容再续写" };
    }
    return { ok: true, params };
  }
  const len = (params.selection ?? "").trim().length;
  if (len < SELECTION_MIN) {
    return { ok: false, error: `请先选中至少 ${SELECTION_MIN} 个字符` };
  }
  if (params.action === "custom" && !(params.instruction ?? "").trim()) {
    return { ok: false, error: "自定义动作需要填写指令" };
  }
  return { ok: true, params };
}

const ASSIST_SYSTEM =
  "你是中文技术博客的写作助手，在编辑器里对作者选中的文字做片段级加工。硬性规则：\n" +
  "1. 只处理【选区】内容，输出加工后的结果本身——不要评论、不要解释做了什么、不要复述原文；\n" +
  "2. 输出纯 Markdown 片段，不要用 ``` 代码围栏包裹整体；\n" +
  "3. 选区内的代码块、行内代码、链接、图片语法原样保留（翻译动作可以翻译代码注释）；\n" +
  "4. 保持原文的语言、语气与第一人称视角；\n" +
  "5. 【前文】【后文】只用来理解语境，不要把其中的内容写进结果。";

const TASK_LINES: Record<Exclude<AssistAction, "custom" | "continue">, string> = {
  rewrite: "任务：改写下面的选区——换一种更好的表达，消除赘余与口语化毛刺，意思、信息量与长度基本不变。",
  expand: "任务：扩写选区——补充细节、例子或推导，篇幅约为原文 1.5-2.5 倍，不得编造原文没有的事实。",
  shorten: "任务：缩写选区——压缩到原文三分之一到一半，保住核心信息与结论。",
  translate_en: "任务：把选区翻译成地道的技术英语，术语用业界通行写法，保留 Markdown 结构与代码。",
  translate_zh: "任务：把选区翻译成自然的简体中文，术语用业界通行译法，保留 Markdown 结构与代码。",
  explain: "任务：为选区内容写一段通俗易懂的解释（可以含一个生活化类比）。输出解释本身，供插入选区之后。",
};

/** 拼装 system/user 消息（流式与非流式共用）。入参应先过 validateAssistParams。 */
export function buildAssistMessages(p: AssistParams): { system: string; user: string } {
  if (p.action === "continue") {
    return {
      system: ASSIST_SYSTEM,
      user:
        `任务：从上文结尾继续写下去，自然衔接最后一句，续写 200-600 字，不要重复上文任何句子。\n\n` +
        (p.title ? `标题：${p.title}\n\n` : "") +
        `【上文】\n${p.context ?? ""}`,
    };
  }
  const task =
    p.action === "custom"
      ? `任务：按作者指令处理选区。指令：${p.instruction ?? ""}`
      : TASK_LINES[p.action];
  const parts = [task];
  if (p.title) parts.push(`文章标题：${p.title}`);
  if (p.contextBefore) parts.push(`【前文】\n…${p.contextBefore}`);
  parts.push(`【选区】\n${p.selection ?? ""}`);
  if (p.contextAfter) parts.push(`【后文】\n${p.contextAfter}…`);
  return { system: ASSIST_SYSTEM, user: parts.join("\n\n") };
}
