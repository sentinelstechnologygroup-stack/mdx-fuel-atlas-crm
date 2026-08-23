/* eslint-disable require-jsdoc, max-len */
export type AtlasAiOperation =
  | "lead_analysis" | "report_insights" | "opportunity_assistance"
  | "smart_email" | "activity_summary" | "lead_import"
  | "document_extraction" | "image_generation" | "conversation";

export interface AtlasProviderRequest {
  operation: AtlasAiOperation;
  input: string;
  context?: Record<string, unknown>;
}

export interface AtlasProviderResult {
  output: unknown;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
}

export interface AtlasAiProvider {
  execute(request: AtlasProviderRequest): Promise<AtlasProviderResult>;
}

export interface OpenAiAtlasProviderOptions {
  apiKey: string;
  textModel: string;
  imageModel: string;
  timeoutMs: number;
  fetchImplementation?: typeof fetch;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ?
    value as JsonRecord : {};
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function extractOutputText(payload: JsonRecord): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(asRecord(item).content) ?
      asRecord(item).content as unknown[] : [];
    for (const part of content) {
      const text = asRecord(part).text;
      if (typeof text === "string") return text;
    }
  }
  throw new Error("AI provider returned no text output.");
}

function responseSchema(context?: JsonRecord): JsonRecord | null {
  const value = context?.response_json_schema ?? context?.json_schema;
  return value && typeof value === "object" && !Array.isArray(value) ?
    value as JsonRecord : null;
}

function authorizedImages(context?: JsonRecord): string[] {
  return Array.isArray(context?.authorized_image_data_urls) ?
    context.authorized_image_data_urls.filter(
      (value): value is string => typeof value === "string" &&
        /^data:image\/(jpeg|png|webp);base64,/i.test(value)
    ).slice(0, 4) : [];
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function requestedBulletCount(input: string): number | null {
  const match = input.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+\n?\s*(?:concise\s+)?(?:markdown\s+)?(?:bullet(?:s|\s+points?)?|items?)\b/i
  );
  if (!match) return null;
  const count = NUMBER_WORDS[match[1].toLowerCase()] || Number(match[1]);
  return Number.isInteger(count) && count > 0 && count <= 10 ? count : null;
}

function conversationSchema(input: string): JsonRecord | null {
  const count = requestedBulletCount(input);
  if (!count) return null;
  return {
    type: "object",
    properties: {
      items: {
        type: "array", minItems: count, maxItems: count,
        items: {type: "string"},
      },
    },
    required: ["items"], additionalProperties: false,
  };
}

function renderConversationItems(output: unknown, input: string): string | null {
  const count = requestedBulletCount(input);
  const items = asRecord(output).items;
  if (!count || !Array.isArray(items)) return null;
  const normalized = items.filter((item): item is string =>
    typeof item === "string" && item.trim().length > 0
  ).slice(0, count);
  if (normalized.length !== count) return null;
  return normalized.map((item) => `- ${item.trim()}`).join("\n");
}

function responseUnits(text: string): string[] {
  const lines = text.split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((unit) => unit.trim())
    .filter(Boolean);
}

/**
 * Enforces common list requests without relying on model formatting alone.
 * @param {string} text Raw model response.
 * @param {string} input Original user request.
 * @return {string} Normalized response text.
 */
export function enforceConversationFormat(text: string, input: string): string {
  const count = requestedBulletCount(input);
  if (!count || !text.trim()) return text;
  const units = responseUnits(text);
  if (units.length === 0) return text;
  const selected = units.slice(0, count);
  if (units.length > count) {
    selected[count - 1] = [
      selected[count - 1], ...units.slice(count),
    ].join(" ");
  }
  while (selected.length < count) selected.push("Additional detail unavailable.");
  return selected.map((unit) => `- ${unit}`).join("\n");
}

/** OpenAI-compatible ATLAS provider. Credentials never leave Functions. */
export class OpenAiAtlasProvider implements AtlasAiProvider {
  private readonly fetchImplementation: typeof fetch;

  constructor(private readonly options: OpenAiAtlasProviderOptions) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async execute(request: AtlasProviderRequest): Promise<AtlasProviderResult> {
    return request.operation === "image_generation" ?
      this.generateImage(request) : this.generateText(request);
  }

  private async post(path: string, body: JsonRecord): Promise<JsonRecord> {
    const response = await this.fetchImplementation(
      `https://api.openai.com/v1/${path}`,
      {
        method: "POST",
        headers: {
          "authorization": `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      }
    );
    const payload = asRecord(await response.json());
    if (!response.ok) {
      const message = asRecord(payload.error).message;
      throw new Error(typeof message === "string" ? message :
        `AI provider failed with status ${response.status}.`);
    }
    return payload;
  }

  private async generateText(
    request: AtlasProviderRequest
  ): Promise<AtlasProviderResult> {
    const schema = responseSchema(request.context) ||
      (request.operation === "conversation" ?
        conversationSchema(request.input) : null);
    const history = Array.isArray(request.context?.history) ?
      request.context.history.slice(-10) : [];
    const historyText = history.length > 0 ?
      `\n\nRecent conversation:\n${JSON.stringify(history)}` : "";
    const crmContext = Array.isArray(request.context?.server_crm_context) ?
      request.context.server_crm_context : [];
    const crmText = crmContext.length > 0 ?
      `\n\nAuthorized CRM context:\n${JSON.stringify(crmContext)}` : "";
    const content: JsonRecord[] = [
      {type: "input_text", text: request.input + historyText + crmText},
      ...authorizedImages(request.context).map(
        (imageUrl) => ({type: "input_image", image_url: imageUrl})
      ),
    ];
    const body: JsonRecord = {
      model: this.options.textModel,
      instructions: "You are ATLAS, powered by Aurora Intelligence " +
        "Systems. Follow the user's request exactly, including requested " +
        "count, structure, and format. Infer a useful format when none is " +
        "specified; never ask the user to choose a format. If the user asks " +
        "for bullets, return Markdown bullet items rather than paragraphs. " +
        "If the user asks for a number of items, return exactly that number " +
        "unless the supplied CRM data cannot support it. Be concise and " +
        "professional. Use only supplied context. Never claim that you " +
        "performed a CRM write.",
      input: [{role: "user", content}],
    };
    if (schema) {
      body.text = {format: {
        type: "json_schema", name: "atlas_response", strict: false, schema,
      }};
    }
    const payload = await this.post("responses", body);
    const rawOutput = extractOutputText(payload);
    let output: unknown = schema ? rawOutput :
      request.operation === "conversation" ?
        enforceConversationFormat(rawOutput, request.input) : rawOutput;
    if (schema) {
      try {
        output = JSON.parse(rawOutput);
      } catch {
        throw new Error("AI provider returned invalid structured output.");
      }
      const rendered = request.operation === "conversation" ?
        renderConversationItems(output, request.input) : null;
      if (rendered) output = rendered;
    }
    const usage = asRecord(payload.usage);
    return {
      output, provider: "openai", model: this.options.textModel,
      inputTokens: asNumber(usage.input_tokens),
      outputTokens: asNumber(usage.output_tokens), estimatedCostUsd: null,
    };
  }

  private async generateImage(
    request: AtlasProviderRequest
  ): Promise<AtlasProviderResult> {
    const payload = await this.post("images/generations", {
      model: this.options.imageModel, prompt: request.input,
      size: "1024x1024", response_format: "b64_json",
    });
    const data = Array.isArray(payload.data) ? payload.data : [];
    const imageBase64 = asRecord(data[0]).b64_json;
    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      throw new Error("AI provider returned no generated image.");
    }
    return {
      output: {b64_json: imageBase64, content_type: "image/png"},
      provider: "openai", model: this.options.imageModel,
      inputTokens: 0, outputTokens: 0, estimatedCostUsd: null,
    };
  }
}
