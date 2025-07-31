import { JsonRpcProvider } from "@polkadot-api/substrate-client"
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat"
import { getWsProvider, WsJsonRpcProvider } from "polkadot-api/ws-provider/web"

export interface WebsocketSource {
  type: "websocket"
  id: string
  endpoint: string
  withChopsticks: boolean
}

export async function createWebsocketSource(
  id: string,
  endpoint: string,
  withChopsticks: boolean,
): Promise<WebsocketSource> {
  return { type: "websocket", id, endpoint, withChopsticks }
}

// Map chainHead_v1 methods to qpowChainHead_v1 methods for Resonance PoW chain
function mapToQpowChainHead(provider: WsJsonRpcProvider): WsJsonRpcProvider {
  const wrappedProvider: JsonRpcProvider = (onMessage) => {
    const inner = provider((message: string) => {
      const parsed = JSON.parse(message)
      
      // Map qpowChainHead_v1 responses back to chainHead_v1
      if (parsed.method && parsed.method.startsWith("qpowChainHead_v1_")) {
        const originalMethod = parsed.method.replace("qpowChainHead_v1_", "chainHead_v1_")
        onMessage(JSON.stringify({
          ...parsed,
          method: originalMethod
        }))
      } else {
        onMessage(message)
      }
    })
    
    return {
      send: (message: string) => {
        const parsed = JSON.parse(message)
        
        // Map chainHead_v1 methods to qpowChainHead_v1 methods
        if (parsed.method && parsed.method.startsWith("chainHead_v1_")) {
          const qpowMethod = parsed.method.replace("chainHead_v1_", "qpowChainHead_v1_")
          console.log(`[WebSocket] Mapping ${parsed.method} to ${qpowMethod} for Resonance`)
          
          const mappedMessage = JSON.stringify({
            ...parsed,
            method: qpowMethod
          })
          
          return inner.send(mappedMessage)
        }
        
        return inner.send(message)
      },
      disconnect: () => inner.disconnect(),
    }
  }
  
  // Preserve WsJsonRpcProvider methods
  return Object.assign(wrappedProvider, {
    switch: provider.switch.bind(provider),
    getStatus: provider.getStatus.bind(provider),
  }) as WsJsonRpcProvider
}

// Check if the node supports qpowChainHead_v1 methods
async function checkQpowSupport(provider: JsonRpcProvider): Promise<boolean> {
  return new Promise((resolve) => {
    let messageId: string | null = null
    
    const checkProvider = provider((message) => {
      const parsed = JSON.parse(message)
      if (parsed.id === messageId && parsed.result) {
        const methods = parsed.result.methods || []
        const hasQpowMethods = methods.some((method: string) => 
          method.startsWith("qpowChainHead_v1_")
        )
        resolve(hasQpowMethods)
      }
    })
    
    // Generate a unique ID for this request
    messageId = `qpow-check-${Date.now()}`
    
    // Request available RPC methods
    checkProvider.send(JSON.stringify({
      jsonrpc: "2.0",
      id: messageId,
      method: "rpc_methods",
      params: []
    }))
    
    // Timeout after 5 seconds and assume no support
    setTimeout(() => resolve(false), 5000)
  })
}

export function getWebsocketProvider(source: WebsocketSource): JsonRpcProvider {
  let provider = getWsProvider(source.endpoint)
  
  // Create a provider that will check for qpowChainHead support on first use
  let qpowSupportChecked = false
  let qpowSupported = false
  
  const qpowDetectingProvider: JsonRpcProvider = (onMessage) => {
    const inner = provider(onMessage)
    
    return {
      send: async (message: string) => {
        // Check for qpow support on first real request (not during the check itself)
        if (!qpowSupportChecked) {
          const parsed = JSON.parse(message)
          if (parsed.method !== "rpc_methods") {
            qpowSupportChecked = true
            qpowSupported = await checkQpowSupport(provider)
            if (qpowSupported) {
              console.log("[WebSocket] Detected qpowChainHead_v1 support, enabling method mapping")
              // Replace the provider with the mapped version
              provider = mapToQpowChainHead(provider)
              // Recreate inner with the new provider
              const newInner = provider(onMessage)
              return newInner.send(message)
            }
          }
        }
        
        return inner.send(message)
      },
      disconnect: () => inner.disconnect(),
    }
  }
  
  // Preserve WsJsonRpcProvider interface if provider has it
  if ('switch' in provider && 'getStatus' in provider) {
    return Object.assign(qpowDetectingProvider, {
      switch: (provider as WsJsonRpcProvider).switch.bind(provider),
      getStatus: (provider as WsJsonRpcProvider).getStatus.bind(provider),
    }) as JsonRpcProvider
  }
  
  // Apply SDK compatibility layer which will convert between old and new methods
  return withPolkadotSdkCompat(qpowDetectingProvider)
}