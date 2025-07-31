# qpowChainHead_v1 Detection and Mapping Example

## How It Works

The qapi-console automatically detects when a chain supports `qpowChainHead_v1_*` methods and transparently maps between standard `chainHead_v1_*` calls and the qpow equivalents.

## Detection Process

When connecting to a chain, the following happens:

1. **Initial Connection**: The WebSocket provider is wrapped with detection logic
2. **First Real Request**: When the first non-`rpc_methods` request is made, detection is triggered
3. **RPC Methods Query**: The system calls `rpc_methods` to get a list of available methods
4. **qpow Detection**: If any methods starting with `qpowChainHead_v1_` are found, mapping is enabled
5. **Transparent Mapping**: All subsequent chainHead calls are automatically mapped

## Example Flow

### 1. Connection to a qpow-enabled chain (e.g., Resonance)

```javascript
// User connects to Resonance
const endpoint = "wss://a.t.res.fm"

// First API call triggers detection
api.chainHead.follow() 
// → Internal: calls rpc_methods
// → Response: ["qpowChainHead_v1_follow", "qpowChainHead_v1_header", ...]
// → Console: "[WebSocket] Detected qpowChainHead_v1 support, enabling method mapping"
```

### 2. Automatic Method Mapping

After detection, all chainHead calls are transparently mapped:

```javascript
// What the API sends
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "chainHead_v1_follow",
  "params": [true]
}

// What actually goes to the node
{
  "jsonrpc": "2.0", 
  "id": 1,
  "method": "qpowChainHead_v1_follow",
  "params": [true]
}

// Console output
"[WebSocket] Mapping chainHead_v1_follow to qpowChainHead_v1_follow"
```

### 3. Response Mapping

Responses from the node are mapped back:

```javascript
// What the node sends
{
  "jsonrpc": "2.0",
  "method": "qpowChainHead_v1_followEvent",
  "params": {
    "subscription": "abc123",
    "result": {
      "event": "newBlock",
      "blockHash": "0x..."
    }
  }
}

// What the API receives
{
  "jsonrpc": "2.0",
  "method": "chainHead_v1_followEvent",
  "params": {
    "subscription": "abc123",
    "result": {
      "event": "newBlock",
      "blockHash": "0x..."
    }
  }
}
```

## Chains Without qpow Support

For standard chains, the detection finds no qpow methods and passes through calls unchanged:

```javascript
// Connect to Polkadot
const endpoint = "wss://rpc.polkadot.io"

// First API call
api.chainHead.follow()
// → Internal: calls rpc_methods
// → Response: ["chainHead_v1_follow", "chainHead_v1_header", ...] (no qpow methods)
// → No mapping applied, calls pass through unchanged
```

## Benefits

1. **Automatic**: No configuration needed - just works based on chain capabilities
2. **Transparent**: The Polkadot API doesn't need to know about qpow methods
3. **Flexible**: Works with any chain that implements qpow methods
4. **Future-proof**: New chains with PoW finality can implement qpow methods and automatically work

## Debugging

To see the detection and mapping in action:

1. Open browser DevTools console
2. Connect to a qpow-enabled chain
3. Look for these messages:
   - `[WebSocket] Detected qpowChainHead_v1 support, enabling method mapping`
   - `[WebSocket] Mapping chainHead_v1_* to qpowChainHead_v1_*`

## Implementation Details

The key components:

- **checkQpowSupport()**: Queries `rpc_methods` and looks for qpow methods
- **mapToQpowChainHead()**: Intercepts and translates method names bidirectionally
- **Lazy Detection**: Only checks on first real request, not during provider setup
- **Timeout Handling**: Falls back to no mapping if detection takes too long (5 seconds)