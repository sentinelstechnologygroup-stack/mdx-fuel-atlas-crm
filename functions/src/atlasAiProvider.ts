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
    const schema = responseSchema(request.context);
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
        "Systems. Be concise and professional. Use only supplied context. " +
        "Never claim that you performed a CRM write.",
      input: [{role: "user", content}],
    };
    if (schema) {
      body.text = {format: {
        type: "json_schema", name: "atlas_response", strict: false, schema,
      }};
    }
    const payload = await this.post("responses", body);
    const rawOutput = extractOutputText(payload);
    let output: unknown = rawOutput;
    if (schema) {
      try {
        output = JSON.parse(rawOutput);
      } catch {
        throw new Error("AI provider returned invalid structured output.");
      }
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
