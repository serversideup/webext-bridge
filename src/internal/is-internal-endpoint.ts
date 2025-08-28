import type { Endpoint, RuntimeContext } from '../types'

const internalEndpoints: RuntimeContext[] = ['background', 'devtools', 'content-script', 'options', 'popup', 'sidepanel']

export const isInternalEndpoint = ({ context: ctx }: Endpoint): boolean => internalEndpoints.includes(ctx)
