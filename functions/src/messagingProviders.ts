export type DeliveryChannel = "email" | "sms";

export type DeliveryStatus =
  | "sent"
  | "queued"
  | "failed"
  | "skipped";

export type ProviderAvailability =
  | "configured"
  | "disabled"
  | "misconfigured"
  | "unavailable";

export interface DeliveryRequest {
  idempotencyKey: string;
  recipient: string;
  message: string;
  subject?: string;
  sourceType?: string;
  sourceId?: string;
  replyTo?: string;
}

export interface DeliveryResult {
  channel: DeliveryChannel;
  status: DeliveryStatus;
  provider: string | null;
  reason: string | null;
  idempotencyKey: string;
  providerMessageId: string | null;
}

export interface MessageProvider {
  readonly channel: DeliveryChannel;
  readonly name: string | null;
  readonly availability: ProviderAvailability;

  send(request: DeliveryRequest): Promise<DeliveryResult>;
}

export interface MessagingProviders {
  email: MessageProvider;
  sms: MessageProvider;
}

export interface MessagingEnvironment {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_REPLY_TO?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
}

type FetchFunction = typeof fetch;

/**
 * Validates one provider-independent delivery request.
 *
 * @param {DeliveryRequest} request Delivery request.
 * @return {void}
 */
function validateRequest(request: DeliveryRequest): void {
  if (
    !request ||
    typeof request.idempotencyKey !== "string" ||
    request.idempotencyKey.trim().length === 0
  ) {
    throw new Error("A delivery idempotency key is required.");
  }

  if (
    typeof request.recipient !== "string" ||
    request.recipient.trim().length === 0
  ) {
    throw new Error("A delivery recipient is required.");
  }

  if (
    typeof request.message !== "string" ||
    request.message.trim().length === 0
  ) {
    throw new Error("A delivery message is required.");
  }
}

/**
 * Reads and trims one optional configuration value.
 *
 * @param {string|undefined} value Configuration value.
 * @return {string|null} Trimmed value or null.
 */
function configurationValue(
  value: string | undefined
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Builds a normalized failed-delivery result.
 *
 * @param {DeliveryChannel} channel Delivery channel.
 * @param {string|null} provider Provider name.
 * @param {DeliveryRequest} request Delivery request.
 * @param {string} reason Failure reason.
 * @return {DeliveryResult} Failed-delivery result.
 */
function failedResult(
  channel: DeliveryChannel,
  provider: string | null,
  request: DeliveryRequest,
  reason: string
): DeliveryResult {
  return {
    channel,
    status: "failed",
    provider,
    reason,
    idempotencyKey: request.idempotencyKey,
    providerMessageId: null,
  };
}

/**
 * Provider used when an external channel is not configured.
 */
export class DisabledMessageProvider implements MessageProvider {
  readonly availability = "disabled" as const;
  readonly name = null;

  /**
   * Creates a disabled provider.
   *
   * @param {DeliveryChannel} channel Delivery channel.
   */
  constructor(readonly channel: DeliveryChannel) {}

  /**
   * Returns a controlled skipped result.
   *
   * @param {DeliveryRequest} request Delivery request.
   * @return {Promise<DeliveryResult>} Skipped result.
   */
  async send(request: DeliveryRequest): Promise<DeliveryResult> {
    validateRequest(request);

    return {
      channel: this.channel,
      status: "skipped",
      provider: null,
      reason: "provider_not_configured",
      idempotencyKey: request.idempotencyKey,
      providerMessageId: null,
    };
  }
}

/**
 * Deterministic provider for automated and emulator testing.
 */
export class MockMessageProvider implements MessageProvider {
  readonly availability = "configured" as const;
  readonly name = "mock";

  /**
   * Creates a mock provider.
   *
   * @param {DeliveryChannel} channel Delivery channel.
   * @param {"sent"|"failed"} behavior Delivery behavior.
   */
  constructor(
    readonly channel: DeliveryChannel,
    private readonly behavior:
      | "sent"
      | "failed" = "sent"
  ) {}

  /**
   * Returns a deterministic mock result.
   *
   * @param {DeliveryRequest} request Delivery request.
   * @return {Promise<DeliveryResult>} Mock result.
   */
  async send(request: DeliveryRequest): Promise<DeliveryResult> {
    validateRequest(request);

    if (this.behavior === "failed") {
      return failedResult(
        this.channel,
        this.name,
        request,
        "mock_delivery_failure"
      );
    }

    return {
      channel: this.channel,
      status: "sent",
      provider: this.name,
      reason: null,
      idempotencyKey: request.idempotencyKey,
      providerMessageId:
        `mock-${this.channel}-${request.idempotencyKey}`,
    };
  }
}

/**
 * Resend transactional-email adapter.
 */
export class ResendEmailProvider implements MessageProvider {
  readonly availability = "configured" as const;
  readonly channel = "email" as const;
  readonly name = "resend";

  /**
   * Creates a Resend email adapter.
   *
   * @param {string} apiKey Resend API key.
   * @param {string} fromEmail Verified sender identity.
   * @param {string|null} defaultReplyTo Optional reply-to address.
   * @param {FetchFunction} fetchFunction HTTP implementation.
   */
  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly defaultReplyTo: string | null = null,
    private readonly fetchFunction: FetchFunction = fetch
  ) {}

  /**
   * Sends one transactional email through Resend.
   *
   * @param {DeliveryRequest} request Email delivery request.
   * @return {Promise<DeliveryResult>} Delivery result.
   */
  async send(request: DeliveryRequest): Promise<DeliveryResult> {
    validateRequest(request);

    if (
      typeof request.subject !== "string" ||
      request.subject.trim().length === 0
    ) {
      return failedResult(
        this.channel,
        this.name,
        request,
        "email_subject_required"
      );
    }

    try {
      const response = await this.fetchFunction(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": request.idempotencyKey,
          },
          body: JSON.stringify({
            from: this.fromEmail,
            to: [request.recipient.trim()],
            subject: request.subject.trim(),
            text: request.message,
            reply_to:
              request.replyTo?.trim() ||
              this.defaultReplyTo ||
              undefined,
          }),
        }
      );

      if (!response.ok) {
        return failedResult(
          this.channel,
          this.name,
          request,
          `provider_http_${response.status}`
        );
      }

      const payload = await response.json() as {
        id?: unknown;
      };

      return {
        channel: this.channel,
        status: "sent",
        provider: this.name,
        reason: null,
        idempotencyKey: request.idempotencyKey,
        providerMessageId:
          typeof payload.id === "string" ?
            payload.id :
            null,
      };
    } catch {
      return failedResult(
        this.channel,
        this.name,
        request,
        "provider_exception"
      );
    }
  }
}

/**
 * Twilio programmable-messaging adapter.
 */
export class TwilioSmsProvider implements MessageProvider {
  readonly availability = "configured" as const;
  readonly channel = "sms" as const;
  readonly name = "twilio";

  /**
   * Creates a Twilio SMS adapter.
   *
   * @param {string} accountSid Twilio account SID.
   * @param {string} authToken Twilio auth token.
   * @param {string} fromNumber Twilio sender number.
   * @param {FetchFunction} fetchFunction HTTP implementation.
   */
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber: string,
    private readonly fetchFunction: FetchFunction = fetch
  ) {}

  /**
   * Sends one SMS through Twilio.
   *
   * @param {DeliveryRequest} request SMS delivery request.
   * @return {Promise<DeliveryResult>} Delivery result.
   */
  async send(request: DeliveryRequest): Promise<DeliveryResult> {
    validateRequest(request);

    const form = new URLSearchParams({
      To: request.recipient.trim(),
      From: this.fromNumber,
      Body: request.message,
    });

    const credentials = Buffer.from(
      `${this.accountSid}:${this.authToken}`
    ).toString("base64");

    try {
      const response = await this.fetchFunction(
        "https://api.twilio.com/2010-04-01/Accounts/" +
          `${this.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${credentials}`,
            "Content-Type":
              "application/x-www-form-urlencoded",
            "Idempotency-Key": request.idempotencyKey,
          },
          body: form.toString(),
        }
      );

      if (!response.ok) {
        return failedResult(
          this.channel,
          this.name,
          request,
          `provider_http_${response.status}`
        );
      }

      const payload = await response.json() as {
        sid?: unknown;
      };

      return {
        channel: this.channel,
        status: "sent",
        provider: this.name,
        reason: null,
        idempotencyKey: request.idempotencyKey,
        providerMessageId:
          typeof payload.sid === "string" ?
            payload.sid :
            null,
      };
    } catch {
      return failedResult(
        this.channel,
        this.name,
        request,
        "provider_exception"
      );
    }
  }
}

/**
 * Creates safely disabled email and SMS providers.
 *
 * @return {MessagingProviders} Disabled providers.
 */
export function createDisabledMessagingProviders():
MessagingProviders {
  return {
    email: new DisabledMessageProvider("email"),
    sms: new DisabledMessageProvider("sms"),
  };
}

/**
 * Resolves configured providers without requiring either channel.
 *
 * @param {MessagingEnvironment} environment Server environment values.
 * @param {FetchFunction} fetchFunction Optional HTTP implementation.
 * @return {MessagingProviders} Independently resolved providers.
 */
export function createMessagingProvidersFromEnvironment(
  environment: MessagingEnvironment,
  fetchFunction: FetchFunction = fetch
): MessagingProviders {
  const resendApiKey =
    configurationValue(environment.RESEND_API_KEY);
  const resendFromEmail =
    configurationValue(environment.RESEND_FROM_EMAIL);
  const resendReplyTo =
    configurationValue(environment.RESEND_REPLY_TO);

  const twilioAccountSid =
    configurationValue(environment.TWILIO_ACCOUNT_SID);
  const twilioAuthToken =
    configurationValue(environment.TWILIO_AUTH_TOKEN);
  const twilioFromNumber =
    configurationValue(environment.TWILIO_FROM_NUMBER);

  const email: MessageProvider =
    resendApiKey && resendFromEmail ?
      new ResendEmailProvider(
        resendApiKey,
        resendFromEmail,
        resendReplyTo,
        fetchFunction
      ) :
      new DisabledMessageProvider("email");

  const sms: MessageProvider =
    twilioAccountSid &&
    twilioAuthToken &&
    twilioFromNumber ?
      new TwilioSmsProvider(
        twilioAccountSid,
        twilioAuthToken,
        twilioFromNumber,
        fetchFunction
      ) :
      new DisabledMessageProvider("sms");

  return {email, sms};
}

/**
 * Attempts email and SMS independently.
 *
 * @param {MessagingProviders} providers Provider implementations.
 * @param {{email: DeliveryRequest, sms: DeliveryRequest}} requests
 * Delivery requests.
 * @return {Promise<{email: DeliveryResult, sms: DeliveryResult}>}
 * Independent channel results.
 */
export async function deliverOptionalMessages(
  providers: MessagingProviders,
  requests: {
    email: DeliveryRequest;
    sms: DeliveryRequest;
  }
): Promise<{
  email: DeliveryResult;
  sms: DeliveryResult;
}> {
  const [email, sms] = await Promise.all([
    providers.email.send(requests.email).catch(() =>
      failedResult(
        "email",
        providers.email.name,
        requests.email,
        "provider_exception"
      )
    ),
    providers.sms.send(requests.sms).catch(() =>
      failedResult(
        "sms",
        providers.sms.name,
        requests.sms,
        "provider_exception"
      )
    ),
  ]);

  return {email, sms};
}
