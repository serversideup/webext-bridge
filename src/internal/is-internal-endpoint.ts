import type { Endpoint, RuntimeContext } from '../types'

const internalEndpoints: RuntimeContext[] = ['background', 'devtools', 'content-script', 'options', 'offscreen', 'popup']

export const isInternalEndpoint = ({ context: ctx }: Endpoint): boolean => internalEndpoints.includes(ctx)
