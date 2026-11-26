import { DomainError } from "./errors.js"

export type Currency = "EUR" | "RSD" | "USD"
const CURRENCIES: readonly Currency[] = ["EUR", "RSD", "USD"]

/** Money in integer minor units (cents), so sums never drift. Immutable. */
export class Money {
  private constructor(
    readonly cents: number,
    readonly currency: Currency,
  ) {}

  static of(amount: number, currency: Currency): Money {
    if (!Number.isFinite(amount)) throw new DomainError("invalid_money", `Amount must be a finite number, got ${amount}`)
    if (!CURRENCIES.includes(currency)) throw new DomainError("invalid_money", `Unsupported currency "${currency}"`)
    return new Money(Math.round(amount * 100), currency)
  }

  static zero(currency: Currency): Money {
    return new Money(0, currency)
  }

  get amount(): number {
    return this.cents / 100
  }

  add(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.cents + other.cents, this.currency)
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.cents - other.cents, this.currency)
  }

  multiply(factor: number): Money {
    if (!Number.isFinite(factor)) throw new DomainError("invalid_money", `Factor must be finite, got ${factor}`)
    return new Money(Math.round(this.cents * factor), this.currency)
  }

  /** Ratio of two amounts in the same currency, for example rent / revenue. */
  ratioTo(other: Money): number {
    this.assertSameCurrency(other)
    if (other.cents === 0) throw new DomainError("invalid_money", "Cannot divide by a zero amount")
    return this.cents / other.cents
  }

  isNegative(): boolean {
    return this.cents < 0
  }

  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other)
    return this.cents > other.cents
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.cents === other.cents
  }

  toJSON(): { amount: number; currency: Currency } {
    return { amount: this.amount, currency: this.currency }
  }

  toString(): string {
    return `${this.amount.toFixed(2)} ${this.currency}`
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new DomainError("currency_mismatch", `Cannot combine ${this.currency} with ${other.currency} without a sourced exchange rate`)
    }
  }
}
