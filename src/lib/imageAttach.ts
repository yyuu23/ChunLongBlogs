/**
 * 聊天图片附件（纯客户端处理，不经服务器存储）：
 * - full：压缩到最长边 1568px / jpeg 85% 后的 dataURL，随请求发给模型（三家均原生多模态）
 * - thumb：96px 缩略图，消息气泡展示与会话持久化用（防 localStorage 爆容）
 */

export interface AttachedImage {
  full: string;
  thumb: string;
}

const drawScaled = async (blob: Blob, maxEdge: number, quality: number): Promise<string | null> => {
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff"; // 透明底转白（jpeg 无 alpha）
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
};

/** 压缩一张图片；解码失败返回 null（GIF 只取首帧，动图会静止——可接受） */
export async function attachImage(blob: Blob): Promise<AttachedImage | null> {
  const full = await drawScaled(blob, 1568, 0.85);
  if (!full) return null;
  const thumb = (await drawScaled(blob, 96, 0.6)) ?? full;
  return { full, thumb };
}
