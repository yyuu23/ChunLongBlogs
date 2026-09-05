"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatCardBlock } from "@/components/chat/ChatCard";

/**
 * 聊天气泡内的 Markdown 渲染（GFM：列表/表格/删除线/任务列表）。
 * ```chat-card 代码块渲染成站内原生卡片（ChatCard.tsx）；
 * 样式集中在 globals.css 的 .chat-md 下；复制按钮复制的仍是 Markdown 原文。
 * streaming 期间未闭合的卡片围栏显示占位，完成后整卡渲染。
 */

/** react-markdown 的 pre 子节点是 <code className="language-xxx"> 元素，这里取其原始文本 */
function codeChildOf(children: React.ReactNode): { className?: string; text?: string } {
  const child = Array.isArray(children) ? children[0] : children;
  if (child && typeof child === "object" && "props" in child) {
    const props = (child as { props?: { className?: string; children?: unknown } }).props;
    return {
      className: props?.className,
      text: typeof props?.children === "string" ? props.children : undefined,
    };
  }
  return {};
}

export function ChatMarkdown({ content, streaming }: { content: string; streaming?: boolean }) {
  return (
    <div className="chat-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          pre: ({ children }) => {
            const { className, text } = codeChildOf(children);
            if (className?.includes("chat-card") && text !== undefined) {
              return <ChatCardBlock code={text} streaming={streaming} />;
            }
            return <pre>{children}</pre>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
