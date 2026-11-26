import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(1, "Please enter your password."),
  rememberMe: z.boolean().optional(),
});

export const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters.")
      .max(100, "Full name is too long."),
    email: z.string().trim().email("Please enter a valid email address."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
