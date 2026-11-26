import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".ts") ? [path] : []
  })
}

describe("layering", () => {
  it("the domain imports nothing from application, adapters, Mozaik or Node I/O", () => {
    const offenders = files("src/domain").filter((file) =>
      /from\s+["'](\.\.\/(application|adapters)|@mozaik-ai|node:|fs|http)/.test(readFileSync(file, "utf8")),
    )
    expect(offenders).toEqual([])
  })
  it("the application layer never imports adapters", () => {
    const offenders = files("src/application").filter((file) => /from\s+["'][./]*adapters\//.test(readFileSync(file, "utf8")))
    expect(offenders).toEqual([])
  })
})
