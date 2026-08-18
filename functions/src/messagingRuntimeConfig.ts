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
 * Detects the local Firebase emulator runtime.
 * @return {boolean} Whether provider secrets should come from process.env.
 */
function isLocalEmulatorRuntime(): boolean {
  return (
    process.env.FUNCTIONS_EMULATOR === "true" ||
    Boolean(process.env.FIRESTORE_EMULATOR_HOST) ||
    Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST)
  );
}

/**
 * Detects local emulator runs that must not use provider secrets.
 * @return {boolean} Whether configured provider secrets should be ignored.
 */
function providerSecretsDisabled(): boolean {
  return (
    process.env.MDX_EMULATOR_DISABLE_PROVIDER_SECRETS === "true"
  );
}

/**
 * Returns the runtime environment required for email delivery.
 * @return {MessagingEnvironment} Email provider configuration.
 */
export function emailMessagingEnvironment(): MessagingEnvironment {
  const useLocalEnvironment = isLocalEmulatorRuntime();
  const disableProviderSecrets = providerSecretsDisabled();

  return {
    RESEND_API_KEY: disableProviderSecrets ?
      undefined :
      useLocalEnvironment ?
        process.env.RESEND_API_KEY :
        resendApiKey.value(),
    RESEND_FROM_EMAIL: resendFromEmail.value(),
    RESEND_REPLY_TO: resendReplyTo.value() || undefined,
  };
}

/**
 * Returns the runtime environment required for all messaging providers.
 * @return {MessagingEnvironment} Email and SMS provider configuration.
 */
export function messagingEnvironment(): MessagingEnvironment {
  const useLocalEnvironment = isLocalEmulatorRuntime();
  const disableProviderSecrets = providerSecretsDisabled();

  return {
    ...emailMessagingEnvironment(),
    TWILIO_ACCOUNT_SID: twilioAccountSid.value(),
    TWILIO_AUTH_TOKEN: disableProviderSecrets ?
      undefined :
      useLocalEnvironment ?
        process.env.TWILIO_AUTH_TOKEN :
        twilioAuthToken.value(),
    TWILIO_FROM_NUMBER: twilioFromNumber.value(),
  };
}
