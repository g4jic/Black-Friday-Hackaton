import { DomainError } from "./errors.js"

/** Floor area in square metres. Always positive. */
export class AreaM2 {
  private constructor(readonly value: number) {}

  static of(value: number): AreaM2 {
    if (!Number.isFinite(value) || value <= 0) throw new DomainError("invalid_area", `Area must be a positive number of m2, got ${value}`)
    return new AreaM2(value)
  }

  isWithin(min: AreaM2, max: AreaM2): boolean {
    return this.value >= min.value && this.value <= max.value
  }

  toJSON(): number {
    return this.value
  }
}
