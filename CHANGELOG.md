# Changelog

## v6.0.0

This revision is primarily focused on codebase improvements all around. The code should be now much
more readable and easy to comprehend as the responsibilities have been split into smaller pieces and
composed as needed by each runtime context.

For end users of the library, the breaking changes aren't that "breaking", they'll just need to do a
bit of import restructring. The API behaviour is mostly unchanged, with just minor exceptions.

### Breaking changes
- Runtime context is no longer automatically detected by `webext-bridge`. You must import the
relevant part yourself depending on the context, eg: `import Bridge from 'webext-bridge/window'` for a script that'll be running in the Window context. Learn more about the change
[here](https://github.com/zikaari/crx-bridge/issues/11).
- `setNamespace` is not available in any context except `window`, and `allowWindowMessaging` is not available in any context except `content-script`.
- `getCurrentContext` export has been removed.
- `isInternalEndpoint` returns `true` for some new contexts. In summary it'll be `true` for `background`,
`content-script`, `devtools`, `popup`, and `options`.

### Fixes
- Fixed an issue with messages sometimes not reaching `content-script` or `window` when being sent by some other context right after a tab had navigated forward or back. This was caused by old port's
 `onDisconnect` callback being called *after* the new port's `onConnect` callback. The `onDisconnect`
 would then remove the port mapping preventing messages from being routed to `content-script` or `window`.