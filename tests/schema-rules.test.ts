import { readdirSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { StructuredOutputFormat } from "@mozaik-ai/core"
import { LISTING_EXTRACTION_SCHEMA } from "../src/application/agents/scout.js"
import { SCHEMA_LIMITS, structuredOutputProblems } from "../src/application/agents/schema-rules.js"

const isFormat = (x: unknown): x is StructuredOutputFormat =>
  typeof x === "object" && x !== null && "schema" in x && typeof (x as { schema: unknown }).schema === "object"

/** Every structured output exported by any agent module, now and in the future (no list to keep up to date). */
async function allAgentSchemas(): Promise<[string, StructuredOutputFormat][]> {
  const found: [string, StructuredOutputFormat][] = []
  for (const file of readdirSync("src/application/agents").filter((f) => f.endsWith(".ts"))) {
    const mod = (await import(`../src/application/agents/${file}`)) as Record<string, unknown>
    for (const [name, value] of Object.entries(mod)) if (isFormat(value)) found.push([`${file}:${name}`, value])
  }
  return found
}

const format = (schema: Record<string, unknown>): StructuredOutputFormat => ({ name: "t", strict: true, schema })

describe("structured output schemas follow Anthropic's rules", () => {
  it("every agent schema passes (Scout today, future agents automatically)", async () => {
    const schemas = await allAgentSchemas()
    expect(schemas.map(([n]) => n)).toContain("scout.ts:LISTING_EXTRACTION_SCHEMA")
    for (const [name, schema] of schemas) expect({ name, problems: structuredOutputProblems(schema) }).toEqual({ name, problems: [] })
  })

  it("the Scout schema stays within the union and optional limits", () => {
    const json = JSON.stringify(LISTING_EXTRACTION_SCHEMA.schema)
    expect((json.match(/"anyOf"/g) ?? []).length).toBeLessThanOrEqual(SCHEMA_LIMITS.unionParameters)
    expect(json).not.toMatch(/"type":\[/)
  })

  it("catches enum next to a type array (the 400 we got from the live API)", () => {
    const bad = format({ type: "object", properties: { kind: { type: ["string", "null"], enum: ["rent", "sale", null] } }, required: ["kind"], additionalProperties: false })
    expect(structuredOutputProblems(bad).join("\n")).toContain("next to a type array")
  })

  it("catches unsupported keywords and missing additionalProperties", () => {
    const bad = format({
      type: "object",
      properties: {
        a: { type: "string", minLength: 1, maxLength: 5 },
        b: { type: "number", minimum: 0 },
        c: { oneOf: [{ type: "string" }, { type: "number" }] },
        d: { type: "object", properties: { x: { type: "string" } }, required: ["x"] },
        e: { type: "string", format: "phone" },
        f: { type: "string", pattern: "(?=x)\\b" },
      },
      required: ["a", "b", "c", "d", "e", "f"],
      additionalProperties: false,
    })
    const text = structuredOutputProblems(bad).join("\n")
    for (const part of ['"minLength"', '"maxLength"', '"minimum"', '"oneOf"', "additionalProperties", 'format "phone"', "lookaround"]) expect(text).toContain(part)
  })

  it("catches anyOf next to type, and too many unions or optional parameters", () => {
    expect(structuredOutputProblems(format({ type: "object", anyOf: [], properties: {}, required: [], additionalProperties: false })).join()).toContain("cannot sit next to")
    const many = (n: number, required: boolean) =>
      format({
        type: "object",
        properties: Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i}`, { type: ["string", "null"] }])),
        required: required ? Array.from({ length: n }, (_, i) => `p${i}`) : [],
        additionalProperties: false,
      })
    expect(structuredOutputProblems(many(17, true)).join()).toContain("17 union-typed parameters")
    expect(structuredOutputProblems(many(16, true))).toEqual([])
    expect(structuredOutputProblems(many(25, false)).join()).toContain("25 optional parameters")
  })
})
