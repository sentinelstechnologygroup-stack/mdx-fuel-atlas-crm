// src/api/atlasClient.js
import { httpsCallable } from 'firebase/functions';

import {
  getUserProfile,
  signOutFromFirebase,
} from '@/auth/firebaseAuthService';
import {
  firebaseAuth,
  firebaseFunctions,
} from '@/firebase/client';
import { firestoreEntities } from '@/firebase/entityAdapter';

function requireCurrentFirebaseUser() {
  const currentUser = firebaseAuth.currentUser;

  if (!currentUser) {
    throw new Error('No authenticated Firebase user is available.');
  }

  return currentUser;
}

async function getCurrentProfile() {
  const currentUser = requireCurrentFirebaseUser();
  return getUserProfile(currentUser.uid);
}

async function updateCurrentProfile(data = {}) {
  requireCurrentFirebaseUser();

  const callable = httpsCallable(
    firebaseFunctions,
    'updateCurrentProfile'
  );

  const response = await callable(data);

  return response?.data?.user || getCurrentProfile();
}

function createUnsupportedOperation(category, operationName) {
  return async () => {
    throw new Error(
      `ATLAS ${category} operation "${operationName}" has not yet been migrated to Firebase.`
    );
  };
}

async function invokeAtlasAi(operation, input, context = undefined) {
  requireCurrentFirebaseUser();
  const callable = httpsCallable(firebaseFunctions, 'invokeAtlasAi');
  const response = await callable({
    operation,
    input,
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
  });
  const result = response?.data;
  if (!result?.success) {
    const reason = result?.reason || 'provider_unavailable';
    throw new Error(`ATLAS is unavailable (${reason}).`);
  }
  if (operation === 'conversation' && typeof result.output === 'string') {
    return enforceConversationFormat(result.output, input);
  }
  return result.output;
}

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function enforceConversationFormat(text, input) {
  const match = String(input || '').match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:concise\s+)?(?:markdown\s+)?(?:bullet(?:s|\s+points?)?|items?)\b/i
  );
  if (!match) return text;
  const count = NUMBER_WORDS[match[1].toLowerCase()] || Number(match[1]);
  if (!Number.isInteger(count) || count < 1 || count > 10) return text;
  const units = String(text).split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  const normalized = units.length > 1 ? units : String(text)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((unit) => unit.trim()).filter(Boolean);
  if (!normalized.length) return text;
  const selected = normalized.slice(0, count);
  if (normalized.length > count) {
    selected[count - 1] = [selected[count - 1], ...normalized.slice(count)].join(' ');
  }
  while (selected.length < count) selected.push('Additional detail unavailable.');
  return selected.map((unit) => `- ${unit}`).join('\n');
}

function inferOperation(prompt = '') {
  const normalized = String(prompt).toLowerCase();
  if (normalized.includes('report') || normalized.includes('trend')) {
    return 'report_insights';
  }
  if (normalized.includes('email') || normalized.includes('reply')) {
    return 'smart_email';
  }
  if (normalized.includes('lead')) return 'lead_analysis';
  if (normalized.includes('activity')) return 'activity_summary';
  return 'opportunity_assistance';
}

const firebaseCore = Object.freeze({
  InvokeLLM: async ({ prompt, response_json_schema, storage_paths } = {}) =>
    invokeAtlasAi(
      storage_paths?.length ? 'lead_import' : inferOperation(prompt),
      String(prompt || ''),
      {
        ...(response_json_schema ? { response_json_schema } : {}),
        ...(storage_paths?.length ? { storage_paths } : {}),
      }
    ),
  ExtractDataFromUploadedFile: async ({ storage_path, json_schema } = {}) =>
    invokeAtlasAi('document_extraction', 'Extract the uploaded document.', {
      storage_path,
      ...(json_schema ? { json_schema } : {}),
    }),
  GenerateImage: async ({ prompt } = {}) =>
    invokeAtlasAi('image_generation', String(prompt || '')),
});

const conversationSubscribers = new Map();
const firebaseAgents = Object.freeze({
  createConversation: async () => ({
    id: globalThis.crypto?.randomUUID?.() || `atlas-${Date.now()}`,
    messages: [],
  }),
  subscribeToConversation: (id, callback) => {
    conversationSubscribers.set(id, callback);
    return () => conversationSubscribers.delete(id);
  },
  addMessage: async (conversation, message) => {
    const messages = [...(conversation.messages || []), message].slice(-20);
    conversation.messages = messages;
    conversationSubscribers.get(conversation.id)?.({ messages });
    const output = await invokeAtlasAi('conversation', message.content, {
      history: messages.slice(-10).map(({ role, content }) => ({ role, content })),
      ...(message.context?.record_refs ? { record_refs: message.context.record_refs } : {}),
    });
    conversation.messages = [...messages, {
      role: 'assistant',
      content: typeof output === 'string' ? output : JSON.stringify(output),
    }];
    conversationSubscribers.get(conversation.id)?.({
      messages: conversation.messages,
    });
    return conversation;
  },
});

const unsupportedCore = new Proxy(
  {},
  {
    get(_target, property) {
      if (typeof property !== 'string') {
        return undefined;
      }

      return createUnsupportedOperation('integration', property);
    },
  }
);

const unsupportedAgents = new Proxy(
  {},
  {
    get(_target, property) {
      if (typeof property !== 'string') {
        return undefined;
      }

      return createUnsupportedOperation('agent', property);
    },
  }
);

export const atlas = Object.freeze({
  // Firebase-backed ATLAS application API.
  entities: firestoreEntities,

  auth: Object.freeze({
    me: getCurrentProfile,
    updateMe: updateCurrentProfile,
    logout: signOutFromFirebase,
    redirectToLogin: async () => {
      await signOutFromFirebase();

      if (typeof window !== 'undefined') {
        window.location.assign('/');
      }
    },
  }),

  functions: Object.freeze({
    invoke: async (functionName, data = {}) => {
      if (
        typeof functionName !== 'string' ||
        functionName.trim().length === 0
      ) {
        throw new Error('A Firebase callable function name is required.');
      }

      const callable = httpsCallable(
        firebaseFunctions,
        functionName.trim()
      );

      return callable(data);
    },
  }),

  integrations: Object.freeze({
    Core: new Proxy(firebaseCore, {
      get(target, property) {
        return property in target
          ? target[property]
          : unsupportedCore[property];
      },
    }),
  }),

  agents: new Proxy(firebaseAgents, {
    get(target, property) {
      return property in target
        ? target[property]
        : unsupportedAgents[property];
    },
  }),

  // Prevent disabled usage tracking from generating failed network traffic.
  appLogs: Object.freeze({
    logUserInApp: async () => ({
      logged: false,
      provider: 'firebase',
    }),
  }),
});
