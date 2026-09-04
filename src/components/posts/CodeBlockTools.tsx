"use client";

import { useEffect } from "react";
import { useT } from "@/components/providers/LocaleProvider";

/* lucide 的 Copy / Check 图标（正文是注入的 HTML 字符串，这里只能用内联 SVG） */
const SVG_ATTRS =
  'xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICON_COPY = `<svg ${SVG_ATTRS}><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const ICON_CHECK = `<svg ${SVG_ATTRS}><path d="M20 6 9 17l-5-5"/></svg>`;

/**
 * 给正文代码块加「语言标签 + 复制按钮」。
 * 正文是 dangerouslySetInnerHTML 注入的 HTML 字符串（rehype-pretty-code 输出），
 * 拿不到 React 节点，所以走「挂载后查 DOM 再注入」——与 Toc 查 getElementById 同一路子。
 * 按钮挂在 <figure> 而不是 <pre> 上：pre 会横向滚动，挂里面按钮会跟着滑走。
 */
export function CodeBlockTools({ slug }: { slug: string }) {
  const t = useT();
  const copyLabel = t("posts.copyCode");
  const copiedLabel = t("posts.copied");

  useEffect(() => {
    const figures = document.querySelectorAll<HTMLElement>(
      ".md figure[data-rehype-pretty-code-figure]",
    );
    const timers: number[] = [];
    const injected: HTMLElement[] = [];

    figures.forEach((fig) => {
      // 幂等：防 StrictMode 双跑 / 同页多次挂载重复插按钮
      if (fig.dataset.clTools === "1") return;
      const pre = fig.querySelector("pre");
      if (!pre) return;
      fig.dataset.clTools = "1";

      const bar = document.createElement("div");
      bar.className = "cl-code-tools";

      const lang = pre.getAttribute("data-language");
      if (lang && lang !== "plaintext" && lang !== "text") {
        const badge = document.createElement("span");
        badge.className = "cl-code-lang";
        badge.textContent = lang;
        bar.appendChild(badge);
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cl-code-copy";
      btn.title = copyLabel;
      btn.setAttribute("aria-label", copyLabel);
      btn.innerHTML = ICON_COPY;

      btn.addEventListener("click", () => {
        /* <code> 是 display:grid、每行一个 [data-line]，
           直接取 textContent 会把所有行连成一行 —— 必须逐行取再拼换行 */
        const lines = pre.querySelectorAll("[data-line]");
        const text = lines.length
          ? Array.from(lines)
              .map((l) => l.textContent ?? "")
              .join("\n")
          : (pre.textContent ?? "");

        void navigator.clipboard.writeText(text).then(
          () => {
            btn.innerHTML = ICON_CHECK;
            btn.classList.add("is-copied");
            btn.setAttribute("aria-label", copiedLabel);
            timers.push(
              window.setTimeout(() => {
                btn.innerHTML = ICON_COPY;
                btn.classList.remove("is-copied");
                btn.setAttribute("aria-label", copyLabel);
              }, 2000),
            );
          },
          () => {}, // 非 https / 无权限时静默失败，不打断阅读
        );
      });

      bar.appendChild(btn);
      fig.appendChild(bar);
      injected.push(bar);
    });

    return () => {
      timers.forEach((id) => clearTimeout(id));
      injected.forEach((el) => {
        const fig = el.parentElement;
        el.remove();
        if (fig) delete fig.dataset.clTools; // 清标记，切换文章后可重新注入
      });
    };
  }, [slug, copyLabel, copiedLabel]);

  return null;
}
