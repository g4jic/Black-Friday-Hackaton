import { AreaM2 } from "./area.js"
import { DomainError } from "./errors.js"
import { Money, type Currency } from "./money.js"
import { calc, sourced, type Sourced } from "./source.js"

export type BusinessType = "cafe_food" | "retail" | "office_studio" | "workshop"
const BUSINESS_TYPES: readonly BusinessType[] = ["cafe_food", "retail", "office_studio", "workshop"]

export type BusinessProfileInput = {
  businessType: BusinessType
  description: string
  headcount: number
  areaMinM2: number
  areaMaxM2: number
  currency: Currency
  monthlyBudget: number
  expectedMonthlyRevenue: number
  /** Gross margin as a share of revenue (0..1). Needed for break-even and payback. */
  grossMarginRate?: number
  walkInCustomers: boolean
  leaseMonths: number
  /** How many years the business plans to stay (for lease or buy). Defaults to the lease length in whole years. */
  yearsPlanned?: number
  city: string
  area?: string
  fitOutBudget: number
  equipmentBudget: number
  specialNeeds?: string
}

/**
 * The questionnaire answers. Every numeric field is exposed as a Sourced value with kind "profile",
 * so calculations can cite "you told us X".
 */
export class BusinessProfile {
  private constructor(readonly input: Readonly<BusinessProfileInput>) {}

  static create(input: BusinessProfileInput): BusinessProfile {
    const fail = (msg: string): never => {
      throw new DomainError("invalid_profile", msg)
    }
    if (!BUSINESS_TYPES.includes(input.businessType)) fail(`Unknown business type "${input.businessType}"`)
    if (!input.city?.trim()) fail("City is required")
    if (!Number.isInteger(input.headcount) || input.headcount < 1) fail("Headcount must be a whole number of at least 1")
    if (!(input.areaMinM2 > 0) || !(input.areaMaxM2 >= input.areaMinM2)) fail("Area range must be positive and min must not exceed max")
    if (!(input.monthlyBudget > 0)) fail("Monthly budget must be positive")
    if (!(input.expectedMonthlyRevenue >= 0)) fail("Expected monthly revenue must not be negative")
    if (input.grossMarginRate !== undefined && !(input.grossMarginRate > 0 && input.grossMarginRate <= 1)) {
      fail("Gross margin must be between 0 and 1")
    }
    if (!Number.isInteger(input.leaseMonths) || input.leaseMonths < 1) fail("Lease length must be a whole number of months")
    if (input.yearsPlanned !== undefined && (!Number.isInteger(input.yearsPlanned) || input.yearsPlanned < 1 || input.yearsPlanned > 30)) {
      fail("Years you plan to stay must be a whole number from 1 to 30")
    }
    if (!(input.fitOutBudget >= 0) || !(input.equipmentBudget >= 0)) fail("Fit-out and equipment budgets must not be negative")
    return new BusinessProfile(Object.freeze({ ...input }))
  }

  get currency(): Currency {
    return this.input.currency
  }

  money(field: "monthlyBudget" | "expectedMonthlyRevenue" | "fitOutBudget" | "equipmentBudget"): Sourced<Money> {
    return sourced(Money.of(this.input[field], this.input.currency), { kind: "profile", ref: "questionnaire", field })
  }

  areaRange(): { min: Sourced<AreaM2>; max: Sourced<AreaM2> } {
    return {
      min: sourced(AreaM2.of(this.input.areaMinM2), { kind: "profile", ref: "questionnaire", field: "areaMinM2" }),
      max: sourced(AreaM2.of(this.input.areaMaxM2), { kind: "profile", ref: "questionnaire", field: "areaMaxM2" }),
    }
  }

  businessType(): Sourced<BusinessType> {
    return sourced(this.input.businessType, { kind: "profile", ref: "questionnaire", field: "businessType" })
  }

  leaseMonths(): Sourced<number> {
    return sourced(this.input.leaseMonths, { kind: "profile", ref: "questionnaire", field: "leaseMonths" })
  }

  /** The years the business plans to stay: the questionnaire answer, or else the lease length in whole years (at least 1). */
  yearsPlanned(): Sourced<number> {
    if (this.input.yearsPlanned !== undefined) return sourced(this.input.yearsPlanned, { kind: "profile", ref: "questionnaire", field: "yearsPlanned" })
    return calc(Math.max(1, Math.round(this.input.leaseMonths / 12)), "lease length in months / 12 (no years given)", [this.leaseMonths()])
  }

  grossMarginRate(): Sourced<number> | null {
    const v = this.input.grossMarginRate
    return v === undefined ? null : sourced(v, { kind: "profile", ref: "questionnaire", field: "grossMarginRate" })
  }
}
