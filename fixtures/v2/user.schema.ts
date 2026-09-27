import { z } from "zod";

export const UserSchema = z.object({
  id: z.number(),
  email: z.string().optional(), // WARNING: widened from required string to optional
  role: z.string(),
});

export type User = z.infer<typeof UserSchema>;
