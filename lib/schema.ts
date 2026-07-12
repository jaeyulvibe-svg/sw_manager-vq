import { z } from "zod"

// 데모 로그인 — 실제 인증은 없고 아이디/비밀번호가 비어있지만 않으면 통과한다
export const loginSchema = z.object({
  username: z.string().min(1, { message: "아이디를 입력해 주세요." }),
  password: z.string().min(1, { message: "비밀번호를 입력해 주세요." }),
  remember: z.boolean().optional(),
})

export type LoginSchema = z.infer<typeof loginSchema>
