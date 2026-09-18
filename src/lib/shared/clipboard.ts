/**
 * 复制文本到剪贴板：优先异步 Clipboard API，不可用或失败时降级为
 * 隐藏 textarea + execCommand（非 https 环境 / 无权限 / 旧浏览器兜底）。
 * 返回是否成功——调用方据此给出可见反馈，绝不静默失败。
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof window === "undefined" || !text) return false;

  // 现代 API：仅安全上下文（https / localhost）存在；权限被拒会 reject
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 落到兜底方案
  }

  // 兜底：隐藏 textarea 选中后触发浏览器的复制命令
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    // 保存当前选区，复制完还原（不破坏页面上正在进行的文本选择）
    const sel = document.getSelection();
    const saved = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (saved && sel) {
      sel.removeAllRanges();
      sel.addRange(saved);
    }
    return ok;
  } catch {
    return false;
  }
}
