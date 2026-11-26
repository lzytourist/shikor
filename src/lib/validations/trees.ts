import { z } from "zod";

export const createTreeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tree name must be at least 2 characters.")
    .max(100, "Tree name is too long."),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer.")
    .optional(),
  firstPersonName: z
    .string()
    .trim()
    .min(2, "First person name must be at least 2 characters.")
    .max(120, "Name is too long."),
  firstPersonGender: z.enum(["M", "F", "O", "U"]),
  claimAsSelf: z.boolean().optional(),
});

export type CreateTreeValues = z.infer<typeof createTreeSchema>;
