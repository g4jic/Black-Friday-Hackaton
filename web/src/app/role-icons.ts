import { Building2, Layers, Search, type LucideIcon } from "lucide-react"
import type { Role } from "./auth"

/** One icon per role, the same in Settings (the role switch) and in the onboarding (the role cards). */
export const ROLE_ICONS: Record<Role, LucideIcon> = { owner: Building2, seeker: Search, both: Layers }
