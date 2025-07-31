# qpowChainHead_v1 Support for PoW Chains

## Overview

Some chains (like Resonance) use a custom Proof-of-Work (PoW) finality mechanism where finality lags behind the latest block by a significant number of blocks (e.g., 180 blocks). This is incompatible with the standard Substrate `chainHead_v1_*` RPC methods which assume instant or near-instant finality.

To address this incompatibility, these chains implement custom `qpowChainHead_v1_*` RPC methods that properly handle the PoW finality semantics.

## Implementation

The qapi-console has been updated to automatically detect and use `qpowChainHead_v1_*` methods when they are available on the connected chain. This detection happens dynamically on connection.

### Method Mapping

The following mappings are performed transparently:

- `chainHead_v1_follow` → `qpowChainHead_v1_follow`
- `chainHead_v1_followEvent` → `qpowChainHead_v1_followEvent`
- `chainHead_v1_unfollow` → `qpowChainHead_v1_unfollow`
- `chainHead_v1_header` → `qpowChainHead_v1_header`
- `chainHead_v1_body` → `qpowChainHead_v1_body`
- `chainHead_v1_storage` → `qpowChainHead_v1_storage`
- `chainHead_v1_call` → `qpowChainHead_v1_call`
- `chainHead_v1_stopOperation` → `qpowChainHead_v1_stopOperation`

### How It Works

1. **Method Detection**: On first connection, the system calls `rpc_methods` to check if any `qpowChainHead_v1_*` methods are available.

2. **Automatic Mapping**: If qpow methods are detected, all subsequent requests are automatically mapped:
   - Outgoing `chainHead_v1_*` requests are translated to `qpowChainHead_v1_*`
   - Incoming `qpowChainHead_v1_*` responses are translated back to `chainHead_v1_*`

3. **Transparent Operation**: The Polkadot API client operates normally, unaware of the method translation happening behind the scenes.

### Code Location

The implementation is located in:
- `src/state/chains/websocket.ts` - Contains:
  - `checkQpowSupport` - Detects availability of qpow methods
  - `mapToQpowChainHead` - Performs the bidirectional translation

### Configuration

The mapping is automatically applied when:
- The connected node exposes `qpowChainHead_v1_*` methods
- Using a WebSocket connection (not light client)

No manual configuration is required. The system automatically detects qpow method availability and applies the appropriate mapping for any chain that implements these methods.

## Finality Handling

The UI has been updated to gracefully handle the PoW finality mechanism:

1. **Null Finality**: When finality information is not available (common during initial sync), the UI displays appropriate fallbacks.

2. **Lagging Finality**: The 180-block finality lag is handled transparently by the `qpowChainHead_v1_*` methods on the node side.

3. **Error Handling**: Connection errors related to finality are caught and handled gracefully, preventing UI crashes.

## Previous Approach

Before implementing the `qpowChainHead_v1_*` method mapping, we attempted to force the use of legacy RPC methods by blocking `chainHead_v1_*` calls. This approach was problematic because:

1. It relied on error handling fallbacks that weren't guaranteed to work
2. The legacy methods don't properly handle PoW finality semantics
3. It could break other functionality that depends on the newer RPC methods

The new approach with dedicated `qpowChainHead_v1_*` methods is cleaner and more reliable.

## Testing

To test the implementation:

1. Connect to a node that implements qpowChainHead_v1 methods (e.g., Resonance)
2. Observe the console logs:
   - "Detected qpowChainHead_v1 support, enabling method mapping" on first connection
   - "Mapping chainHead_v1_follow to qpowChainHead_v1_follow" for subsequent calls
3. Verify that:
   - Block exploration works correctly
   - Finality information displays properly (or shows null during sync)
   - Storage queries function normally
   - Transaction submission works as expected

## Future Considerations

1. **Light Client Support**: Currently, only WebSocket connections are supported. Light client support may require additional work.

2. **Other PoW Chains**: If other chains adopt similar PoW finality mechanisms, the method mapping approach can be extended to support them.

3. **Performance**: The method translation adds minimal overhead and should not impact performance.