"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * 聊天气泡内的 Markdown 渲染（GFM：列表/表格/删除线/任务列表）。
 * 样式集中在 globals.css 的 .chat-md 下；复制按钮复制的仍是 Markdown 原文。
 * 流式期间传入未写完的内容也没关系——未闭合的代码块等会被宽容地渲染。
 */
export function ChatMarkdown({ content }: { content: string }) {
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
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
