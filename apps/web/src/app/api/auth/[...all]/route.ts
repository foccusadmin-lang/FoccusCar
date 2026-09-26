import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

/** /api/auth/*: login Google, Microsoft, Apple, e-mail/senha, logout, recuperação (Better Auth). */
export const { GET, POST } = toNextJsHandler(auth);
