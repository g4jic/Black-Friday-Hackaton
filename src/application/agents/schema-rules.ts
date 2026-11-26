import type { StructuredOutputFormat } from "@mozaik-ai/core"

/**
 * What Anthropic structured outputs (output_config.format) accept, from
 * https://platform.claude.com/docs/en/build-with-claude/structured-outputs (read 26 Nov 2026), plus what the API
 * rejected in our own live run (enum next to a type array: 400 "Enum value 'rent' does not match declared type").
 * Every agent schema is checked against these rules in tests/schema-rules.test.ts, so a schema change cannot bring a
 * 400 back unnoticed.
 */
export const SCHEMA_LIMITS = { unionParameters: 16, optionalParameters: 24 } as const

const UNSUPPORTED_KEYWORDS = [
  "oneOf",
  "not",
  "if",
  "then",
  "else",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "maxItems",
  "uniqueItems",
  "contains",
  "minContains",
  "maxContains",
  "prefixItems",
  "minProperties",
  "maxProperties",
  "patternProperties",
  "propertyNames",
  "dependentSchemas",
  "dependentRequired",
  "unevaluatedProperties",
  "unevaluatedItems",
] as const

const SUPPORTED_FORMATS = new Set(["date-time", "time", "date", "duration", "email", "hostname", "uri", "ipv4", "ipv6", "uuid"])

type Node = Record<string, unknown>
const isNode = (x: unknown): x is Node => typeof x === "object" && x !== null && !Array.isArray(x)

/** All problems in one schema. An empty list means the schema follows every rule we know of. */
export function structuredOutputProblems(format: StructuredOutputFormat): string[] {
  const problems: string[] = []
  let unions = 0
  let optional = 0

  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`))
    if (!isNode(node)) return

    for (const k of UNSUPPORTED_KEYWORDS) if (k in node) problems.push(`${path}: "${k}" is not supported`)

    const typeIsArray = Array.isArray(node.type)
    if (typeIsArray) unions++
    if ("anyOf" in node) {
      unions++
      if ("type" in node || "properties" in node) problems.push(`${path}: "anyOf" cannot sit next to "type" or "properties"`)
    }
    if ("enum" in node || "const" in node) {
      if (typeIsArray) problems.push(`${path}: "enum"/"const" next to a type array is rejected by the API; use anyOf instead`)
      const values = "enum" in node ? (node.enum as unknown[]) : [node.const]
      if (values.some((v) => v !== null && typeof v === "object")) problems.push(`${path}: enum/const values must be strings, numbers, booleans or null`)
      const lower = values.filter((v): v is string => typeof v === "string").map((v) => v.toLowerCase())
      if (new Set(lower).size !== lower.length) problems.push(`${path}: enum values must not differ only in capitalization`)
    }
    if (typeof node.format === "string" && !SUPPORTED_FORMATS.has(node.format)) problems.push(`${path}: format "${node.format}" is not supported`)
    if ("minItems" in node && node.minItems !== 0 && node.minItems !== 1) problems.push(`${path}: minItems must be 0 or 1`)
    if (typeof node.$ref === "string" && !node.$ref.startsWith("#")) problems.push(`${path}: external $ref is not supported`)
    if (typeof node.pattern === "string" && /\\[1-9bB]|\(\?[=!<]/.test(node.pattern)) {
      problems.push(`${path}: pattern uses backreferences, lookaround or word boundaries`)
    }

    const isObject = node.type === "object" || (typeIsArray && (node.type as unknown[]).includes("object")) || "properties" in node
    if (isObject) {
      if (node.additionalProperties !== false) problems.push(`${path}: objects need "additionalProperties": false`)
      const props = isNode(node.properties) ? Object.keys(node.properties) : []
      const required = Array.isArray(node.required) ? (node.required as string[]) : []
      for (const r of required) if (!props.includes(r)) problems.push(`${path}: required "${r}" is not a property`)
      optional += props.filter((p) => !required.includes(p)).length
    }

    for (const [key, child] of Object.entries(node)) {
      if (key === "properties" && isNode(child)) for (const [name, sub] of Object.entries(child)) walk(sub, `${path}.${name}`)
      else if (key === "$defs" || key === "definitions") {
        if (isNode(child)) for (const [name, sub] of Object.entries(child)) walk(sub, `${path}.${key}.${name}`)
      } else if (key === "items" || key === "anyOf" || key === "allOf") walk(child, `${path}.${key}`)
    }
  }

  walk(format.schema, format.name ?? "schema")
  if (unions > SCHEMA_LIMITS.unionParameters) problems.push(`${unions} union-typed parameters (anyOf or type arrays); the API allows ${SCHEMA_LIMITS.unionParameters}`)
  if (optional > SCHEMA_LIMITS.optionalParameters) problems.push(`${optional} optional parameters; the API allows ${SCHEMA_LIMITS.optionalParameters}`)
  return problems
}
