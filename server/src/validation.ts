import { z } from "zod";

const textQuestionSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("text"),
  prompt: z.string(),
  answer: z.string().optional(),
});

const imageQuestionSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("image"),
  imageUrl: z.string().url(),
  prompt: z.string().optional(),
  answer: z.string().optional(),
});

const musicQuestionSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("music"),
  trackUri: z.string(),
  trackName: z.string(),
  trackArtists: z.string(),
  albumImage: z.string().url().optional(),
  prompt: z.string().optional(),
});

export const questionSchema = z.discriminatedUnion("type", [
  textQuestionSchema,
  imageQuestionSchema,
  musicQuestionSchema,
]);

export const createQuizSchema = z.object({
  name: z.string().trim().min(1).max(255),
  questions: z.array(questionSchema).default([]),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(255),
});

export const shareQuizWithUserSchema = z.object({
  email: z.string().trim().email().max(255),
});

const tokenSchema = z.string().trim().min(1).max(4096);

export const putUserTokensSchema = z.object({
  accessToken: tokenSchema.nullable(),
  refreshToken: tokenSchema.nullable(),
});

export const patchUserTokensSchema = z
  .object({
    accessToken: tokenSchema.nullable().optional(),
    refreshToken: tokenSchema.nullable().optional(),
  })
  .refine((value) => value.accessToken !== undefined || value.refreshToken !== undefined, {
    message: "At least one field must be provided",
  });

export const updateQuizSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    questions: z.array(questionSchema).optional(),
  })
  .refine((value) => value.name !== undefined || value.questions !== undefined, {
    message: "At least one field must be provided",
  });

export type QuestionPayload = z.infer<typeof questionSchema>;
export type CreateQuizPayload = z.infer<typeof createQuizSchema>;
export type UpdateQuizPayload = z.infer<typeof updateQuizSchema>;
export type LoginPayload = z.infer<typeof loginSchema>;
export type ShareQuizWithUserPayload = z.infer<typeof shareQuizWithUserSchema>;
export type PutUserTokensPayload = z.infer<typeof putUserTokensSchema>;
export type PatchUserTokensPayload = z.infer<typeof patchUserTokensSchema>;
