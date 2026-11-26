import { AnthropicMessages, DefaultInferenceRunner, supportedModels, type InferenceInput, type InferenceRunner } from "@mozaik-ai/core"

/**
 * Mozaik's own runner for live mode, with one change for Anthropic models: Mozaik executes only the FIRST tool call
 * of an answer, so we ask the API for at most one (tool_choice auto + disable_parallel_tool_use). Keys come from the
 * environment (ANTHROPIC_API_KEY); nothing here reads or prints them.
 */
export function createLiveRunner(): InferenceRunner {
  const models = supportedModels.map((model) => {
    if (model.specification.provider !== "anthropic") return model
    const base = model.endpoint.endpointMapper
    const endpoint = new AnthropicMessages({
      toRequest(input: InferenceInput) {
        const request = base.toRequest(input) as { tools?: unknown[]; tool_choice?: unknown }
        if (request.tools && request.tools.length > 0) request.tool_choice = { type: "auto", disable_parallel_tool_use: true }
        return request
      },
      toResponse: (response: unknown) => base.toResponse(response),
    })
    return { ...model, endpoint }
  })
  // Mozaik's request validator is not exported; this one keeps the check that matters for us.
  const validator = {
    validate(input: InferenceInput, model: { name: string; supportsStructuredOutput?: boolean; supportsFunctionCalling?: boolean }) {
      if (input.structuredOutput && !model.supportsStructuredOutput) throw new Error(`Model ${model.name} has no structured output`)
      if (input.tools?.length && !model.supportsFunctionCalling) throw new Error(`Model ${model.name} has no function calling`)
    },
  }
  return new DefaultInferenceRunner(models, validator as unknown as ConstructorParameters<typeof DefaultInferenceRunner>[1])
}
