let promise: Promise<MessagePort>

/**
 * Returns a MessagePort for one-on-one communication
 *
 * Depending on which context's code runs first, either an incoming port from the other side
 * is accepted OR a port will be offered, which the other side will then accept.
 */
export const getMessagePort = (
  thisContext: 'window' | 'content-script',
  namespace: string,
  onMessage: (e: MessageEvent<any>) => void,
): Promise<MessagePort> => (
  promise ??= new Promise((resolve) => {
    const acceptMessagingPort = (event: MessageEvent) => {
      const { data: { cmd, scope, context }, ports } = event
      if (cmd === 'webext-port-offer' && scope === namespace && context !== thisContext) {
        window.removeEventListener('message', acceptMessagingPort)
        ports[0].onmessage = onMessage
        ports[0].postMessage('port-accepted')
        return resolve(ports[0])
      }
    }

    const offerMessagingPort = () => {
      const channel = new MessageChannel()
      channel.port1.onmessage = (event: MessageEvent) => {
        if (event.data === 'port-accepted') {
          window.removeEventListener('message', acceptMessagingPort)
          return resolve(channel.port1)
        }

        onMessage?.(event)
      }

      window.postMessage({
        cmd: 'webext-port-offer',
        scope: namespace,
        context: thisContext,
      }, '*', [channel.port2])
    }

    window.addEventListener('message', acceptMessagingPort)

    // one of the contexts needs to be offset by at least 1 tick to prevent a race condition
    // where both of them are offering, and then also accepting the port at the same time
    if (thisContext === 'window')
      setTimeout(offerMessagingPort, 0)
    else
      offerMessagingPort()
  })
)
