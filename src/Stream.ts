import { EventEmitter } from 'events';
import { JsonValue } from 'type-fest';

import { Endpoint, onMessage, sendMessage } from './internal';


export type StreamInfo = {
	streamId: string;
	channel: string;
	endpoint: Endpoint;
}

export type HybridUnsubscriber = {
	(): void;
	dispose: () => void;
	close: () => void;
}

/**
 * Built on top of Bridge. Nothing much special except that Stream allows
 * you to create a namespaced scope under a channel name of your choice
 * and allows continuous e2e communication, with less possibility of
 * conflicting messageId's, since streams are strictly scoped.
 */
class Stream {
	private static initDone = false
	private static openStreams: Map<string, Stream> = new Map();

	private internalInfo: StreamInfo;
	private emitter: EventEmitter;
	private isClosed: boolean;
	constructor(t: StreamInfo) {
		this.internalInfo = t;
		this.emitter = new EventEmitter();
		this.isClosed = false;

		if (!Stream.initDone) {
			onMessage<{ streamId: string; action: 'transfer' | 'close'; streamTransfer: JsonValue }>('__crx_bridge_stream_transfer__', (msg) => {
				const { streamId, streamTransfer, action } = msg.data;
				const stream = Stream.openStreams.get(streamId);
				if (stream && !stream.isClosed) {
					if (action === 'transfer') {
						stream.emitter.emit('message', streamTransfer);
					}

					if (action === 'close') {
						Stream.openStreams.delete(streamId);
						stream.handleStreamClose();
					}
				}
			});
			Stream.initDone = true;
		}

		Stream.openStreams.set(t.streamId, this);
	}

	/**
	 * Returns stream info
	 */
	public get info(): StreamInfo {
		return this.internalInfo;
	}

	/**
	 * Sends a message to other endpoint.
	 * Will trigger onMessage on the other side.
	 *
	 * Warning: Before sending sensitive data, verify the endpoint using `stream.info.endpoint.isInternal()`
	 * The other side could be malicious webpage speaking same language as crx-bridge
	 * @param msg
	 */
	public send(msg?: JsonValue): void {
		if (this.isClosed) {
			throw new Error('Attempting to send a message over closed stream. Use stream.onClose(<callback>) to keep an eye on stream status');
		}

		sendMessage('__crx_bridge_stream_transfer__', {
			streamId: this.internalInfo.streamId,
			streamTransfer: msg,
			action: 'transfer',
		}, this.internalInfo.endpoint);
	}

	/**
	 * Closes the stream.
	 * Will trigger stream.onClose(<callback>) on both endpoints.
	 * If needed again, spawn a new Stream, as this instance cannot be re-opened
	 * @param msg
	 */
	public close(msg?: JsonValue): void {
		if (msg) {
			this.send(msg);
		}
		this.handleStreamClose();

		sendMessage('__crx_bridge_stream_transfer__', {
			streamId: this.internalInfo.streamId,
			streamTransfer: null,
			action: 'close',
		}, this.internalInfo.endpoint);
	}

	/**
	 * Registers a callback to fire whenever other endpoint sends a message
	 * @param callback
	 */
	public onMessage<T extends JsonValue>(callback: (msg?: T) => void): HybridUnsubscriber {
		return this.getDisposable('message', callback);
	}

	/**
	 * Registers a callback to fire whenever stream.close() is called on either endpoint
	 * @param callback
	 */
	public onClose<T extends JsonValue>(callback: (msg?: T) => void): HybridUnsubscriber {
		return this.getDisposable('closed', callback);
	}

	private handleStreamClose = () => {
		if (!this.isClosed) {
			this.isClosed = true;
			this.emitter.emit('closed', true);
			this.emitter.removeAllListeners();
		}
	}

	private getDisposable(event: string, callback: () => void): HybridUnsubscriber {
		this.emitter.on(event, callback);
		const unsub = () => {
			this.emitter.removeListener(event, callback);
		};

		return Object.assign(unsub, {
			dispose: unsub,
			close: unsub,
		});
	}
}

export { Stream };
