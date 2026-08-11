import {describe, expect, it, vi} from "vitest";

import {OpenAiAtlasProvider} from "../functions/src/atlasAiProvider.ts";

function provider(fetchImplementation) {
  return new OpenAiAtlasProvider({
    apiKey: "server-secret",
    textModel: "text-test",
    imageModel: "image-test",
    timeoutMs: 1000,
    fetchImplementation,
  });
}

describe("Phase 11 ATLAS provider", () => {
  it("sends credentials server-side and returns text usage", async () => {
    const fetchImplementation = vi.fn(async (_url, options) => ({
      ok: true,
      json: async () => ({
        output: [{content: [{type: "output_text", text: "Next step"}]}],
        usage: {input_tokens: 8, output_tokens: 2},
      }),
      status: 200,
      options,
    }));
    const result = await provider(fetchImplementation).execute({
      operation: "opportunity_assistance",
      input: "Suggest a next step.",
    });
    expect(result).toMatchObject({
      output: "Next step",
      provider: "openai",
      inputTokens: 8,
      outputTokens: 2,
    });
    expect(fetchImplementation.mock.calls[0][1].headers.authorization)
      .toBe("Bearer server-secret");
  });

  it("parses schema-controlled structured output", async () => {
    const fetchImplementation = vi.fn(async () => ({
      ok: true,
      json: async () => ({output_text: '{"score":92}', usage: {}}),
      status: 200,
    }));
    const result = await provider(fetchImplementation).execute({
      operation: "lead_analysis",
      input: "Score lead",
      context: {response_json_schema: {
        type: "object",
        properties: {score: {type: "number"}},
        required: ["score"],
        additionalProperties: false,
      }},
    });
    expect(result.output).toEqual({score: 92});
  });

  it("rejects malformed structured output", async () => {
    const fetchImplementation = vi.fn(async () => ({
      ok: true,
      json: async () => ({output_text: "not-json", usage: {}}),
      status: 200,
    }));
    await expect(provider(fetchImplementation).execute({
      operation: "lead_analysis",
      input: "Score lead",
      context: {response_json_schema: {type: "object"}},
    })).rejects.toThrow("invalid structured output");
  });

  it("returns generated image data for server persistence", async () => {
    const fetchImplementation = vi.fn(async () => ({
      ok: true,
      json: async () => ({data: [{b64_json: "aW1hZ2U="}]}),
      status: 200,
    }));
    const result = await provider(fetchImplementation).execute({
      operation: "image_generation",
      input: "Fuel terminal illustration",
    });
    expect(result.output).toMatchObject({b64_json: "aW1hZ2U="});
  });
});
