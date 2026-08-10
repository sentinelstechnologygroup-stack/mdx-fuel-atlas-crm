import {
  defineSecret,
  defineString,
} from "firebase-functions/params";

import {
  MessagingEnvironment,
} from "./messagingProviders";

export const resendApiKey = defineSecret(
  "RESEND_API_KEY",
  {description: "Resend API credential."}
);

export const twilioAuthToken = defineSecret(
  "TWILIO_AUTH_TOKEN",
  {description: "Twilio API authentication token."}
);

const resendFromEmail = defineString(
  "RESEND_FROM_EMAIL",
  {description: "Verified Resend sender address."}
);

const resendReplyTo = defineString(
  "RESEND_REPLY_TO",
  {
    description: "Optional reply-to address for CRM email.",
    default: "",
  }
);

const twilioAccountSid = defineString(
  "TWILIO_ACCOUNT_SID",
  {description: "Twilio account identifier."}
);

const twilioFromNumber = defineString(
  "TWILIO_FROM_NUMBER",
  {description: "Twilio sender phone number."}
);

export const EMAIL_MESSAGING_SECRETS = [
  resendApiKey,
];

export const ALL_MESSAGING_SECRETS = [
  resendApiKey,
  twilioAuthToken,
];

/**
 * Returns the runtime environment required for email delivery.
 * @return {MessagingEnvironment} Email provider configuration.
 */
export function emailMessagingEnvironment(): MessagingEnvironment {
  return {
    RESEND_API_KEY: resendApiKey.value(),
    RESEND_FROM_EMAIL: resendFromEmail.value(),
    RESEND_REPLY_TO: resendReplyTo.value() || undefined,
  };
}

/**
 * Returns the runtime environment required for all messaging providers.
 * @return {MessagingEnvironment} Email and SMS provider configuration.
 */
export function messagingEnvironment(): MessagingEnvironment {
  return {
    ...emailMessagingEnvironment(),
    TWILIO_ACCOUNT_SID: twilioAccountSid.value(),
    TWILIO_AUTH_TOKEN: twilioAuthToken.value(),
    TWILIO_FROM_NUMBER: twilioFromNumber.value(),
  };
}
