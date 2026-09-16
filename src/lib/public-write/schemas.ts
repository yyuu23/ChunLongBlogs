import { z } from "zod";
import { XP_EVENTS } from "@/lib/achievements";

const bottleTheme = z.enum(["sakura", "firefly", "leaf", "snow"]);

export const visitorIdInput = z.string().trim().min(2).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9_-]+$/).optional();

export const bottleOpenSchema = z
  .object({ visitorId: visitorIdInput, bottleId: z.number().int().positive() })
  .strict();

export const starCreateSchema = z
  .object({
    content: z.string().trim().min(2).max(50),
    visitorId: visitorIdInput,
    theme: bottleTheme.optional(),
  })
  .strict();

export const starLightSchema = z
  .object({ visitorId: visitorIdInput, starId: z.number().int().positive() })
  .strict();

export const postLikeSchema = z
  .object({ visitorId: visitorIdInput, action: z.enum(["like", "unlike"]).default("like") })
  .strict();

export const statsVisitSchema = z
  .object({ type: z.literal("visit"), page: z.string().max(256), visitorId: visitorIdInput })
  .strict();

export const playerEventSchema = z
  .object({
    visitorId: visitorIdInput,
    event: z.enum(XP_EVENTS),
    payload: z
      .record(z.string().min(1).max(32), z.union([z.string().max(100), z.number().finite(), z.boolean()]))
      .refine((value) => Object.keys(value).length <= 12)
      .optional(),
    __meta: z.object({ theme: bottleTheme.optional() }).strict().optional(),
  })
  .strict();

export const chatMemorySchema = z
  .object({
    messages: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20_000) }).strict())
      .min(1)
      .max(20),
    digest: z.string().max(800).optional(),
  })
  .strict();

export const commentCreateSchema = z
  .object({
    refType: z.enum(["post", "moment"]),
    refId: z.number().int().positive(),
    parentId: z.number().int().positive().optional(),
    // 控制字符清洗与 1000 字截断仍由领域逻辑完成；这里只挡异常大输入。
    content: z.string().max(4_000),
  })
  .strict();

const chatImage = z
  .string()
  .max(6_000_000)
  .refine((value) => /^data:image\/(?:jpeg|png|webp|gif)(?:;[^,]*)?;base64,/i.test(value));

export const chatRequestSchema = z
  .object({
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().max(20_000),
            images: z.array(chatImage).max(3).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(16),
    stream: z.boolean().optional(),
    localHour: z.number().int().min(0).max(23).optional(),
    visitorId: visitorIdInput,
    page: z.string().max(256).optional(),
    pageTitle: z.string().max(120).optional(),
    memory: z.string().max(800).optional(),
    model: z.string().max(100).optional(),
    effort: z.enum(["off", "low", "mid", "high", "max", "on"]).optional(),
  })
  .strict();
