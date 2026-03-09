import { z } from "zod"

export const registerSchema = z
  .object({
    username: z.string().min(3, "Username is required"),
    email: z.email("Email is invalid"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters long")
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Confirm password must match password"
  })

export type RegisterSchema = typeof registerSchema
