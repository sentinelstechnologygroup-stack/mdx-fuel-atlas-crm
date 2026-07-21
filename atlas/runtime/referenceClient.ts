// Provider-neutral preservation boundary for pre-Firebase function logic.
// These sources are retained for porting and parity review and are not deployed.
export function createReferenceClientFromRequest(_request: unknown): never {
  throw new Error('ATLAS reference function invoked before Firebase-native porting.');
}
