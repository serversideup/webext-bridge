import type { EndpointFingerprint } from './endpoint-fingerprint'

export interface ConnectionArgs {
  endpointName: string
  fingerprint: EndpointFingerprint
}

const isValidConnectionArgs = (
  args: unknown,
  requiredKeys: (keyof ConnectionArgs)[] = ['endpointName', 'fingerprint'],
): args is ConnectionArgs =>
  typeof args === 'object'
  && args !== null
  && requiredKeys.every(k => k in args)

export const encodeConnectionArgs = (args: ConnectionArgs) => {
  if (!isValidConnectionArgs(args))
    throw new TypeError('Invalid connection args')

  return JSON.stringify(args)
}

export const decodeConnectionArgs = (encodedArgs: string): ConnectionArgs => {
  try {
    const args = JSON.parse(encodedArgs)
    return isValidConnectionArgs(args) ? args : null
  }
  catch (error) {
    return null
  }
}
