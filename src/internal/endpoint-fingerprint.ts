import uid from 'tiny-uid'

export type EndpointFingerprint = `uid::${string}`

export const createFingerprint = (): EndpointFingerprint => `uid::${uid(7)}`
