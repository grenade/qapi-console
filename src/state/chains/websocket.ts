import { JsonRpcProvider } from "@polkadot-api/substrate-client"
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat"
import { getWsProvider } from "polkadot-api/ws-provider/web"

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

// Translation layer to convert chainHead calls to legacy RPC calls
function createChainHeadToLegacyTranslator(provider: JsonRpcProvider): JsonRpcProvider {
  // Track active subscriptions
  const subscriptions = new Map<string, {
    initialized: boolean
    newHeadsId?: string
    finalizedId?: string
    pendingNewHeadsId?: string
    pendingFinalizedId?: string
  }>()
  
  // Generate unique IDs
  let idCounter = 0
  const generateId = () => `legacy-${Date.now()}-${++idCounter}`
  
  return (onMessage) => {
    const inner = provider((message: string) => {
      try {
        const parsed = JSON.parse(message)
        
        // Handle subscription confirmations
        if (parsed.id && parsed.result && typeof parsed.result === 'string') {
          // Check if this is a response to our subscription requests
          for (const [followId, sub] of subscriptions.entries()) {
            if (parsed.id === sub.pendingNewHeadsId) {
              sub.newHeadsId = parsed.result
              delete sub.pendingNewHeadsId
              console.log(`[WebSocket] Got newHeads subscription ID ${parsed.result} for ${followId}`)
              
              // Check if we now have both IDs
              if (sub.newHeadsId && sub.finalizedId) {
                console.log(`[WebSocket] Both subscription IDs received for ${followId}, ready to process events`)
              }
              return
            } else if (parsed.id === sub.pendingFinalizedId) {
              sub.finalizedId = parsed.result
              delete sub.pendingFinalizedId
              console.log(`[WebSocket] Got finalizedHeads subscription ID ${parsed.result} for ${followId}`)
              
              // Check if we now have both IDs
              if (sub.newHeadsId && sub.finalizedId) {
                console.log(`[WebSocket] Both subscription IDs received for ${followId}, ready to process events`)
              }
              return
            }
          }
        }
        
        // Handle subscription events
        if (parsed.method === "chain_newHead" || parsed.method === "chain_finalizedHead") {
          console.log(`[WebSocket] Received ${parsed.method} event:`, JSON.stringify(parsed, null, 2))
          
          // Find which subscription this belongs to
          for (const [followId, sub] of subscriptions.entries()) {
            // Only process events if we have both subscription IDs
            if (!sub.newHeadsId || !sub.finalizedId) {
              console.log(`[WebSocket] Skipping event - waiting for both subscription IDs. Have newHeads: ${!!sub.newHeadsId}, finalized: ${!!sub.finalizedId}`)
              continue
            }
            
            if ((parsed.method === "chain_newHead" && parsed.params?.subscription === sub.newHeadsId) ||
                (parsed.method === "chain_finalizedHead" && parsed.params?.subscription === sub.finalizedId)) {
              
              const header = parsed.params.result
              console.log(`[WebSocket] Header data:`, JSON.stringify(header, null, 2))
              
              // Ensure we have a valid header
              if (!header) {
                console.warn(`[WebSocket] Received ${parsed.method} without header data`)
                return
              }
              
              // Get block hash - check multiple possible locations
              let blockHash = header.hash
              console.log(`[WebSocket] Extracted blockHash:`, blockHash)
              
              if (!blockHash && header.digest && header.digest.logs) {
                // For some chains, we might need to compute the hash
                // For now, we'll skip if no hash is available
                console.warn(`[WebSocket] Header missing hash field, header keys:`, Object.keys(header))
                return
              }
              
              // Ensure hash is properly formatted (0x-prefixed hex string)
              if (blockHash && !blockHash.startsWith('0x')) {
                blockHash = '0x' + blockHash
              }
              
              // Send initialized event if not done yet
              if (!sub.initialized && blockHash) {
                sub.initialized = true
                console.log(`[WebSocket] Sending initialized event with block hash: ${blockHash}`)
                onMessage(JSON.stringify({
                  jsonrpc: "2.0",
                  method: "chainHead_v1_followEvent",
                  params: {
                    subscription: followId,
                    result: {
                      event: "initialized",
                      finalizedBlockHashes: [blockHash]
                    }
                  }
                }))
              }
              
              // Send the appropriate event
              if (parsed.method === "chain_newHead") {
                // Send newBlock event
                console.log(`[WebSocket] Sending newBlock event: ${blockHash}`)
                onMessage(JSON.stringify({
                  jsonrpc: "2.0",
                  method: "chainHead_v1_followEvent",
                  params: {
                    subscription: followId,
                    result: {
                      event: "newBlock",
                      blockHash: blockHash,
                      parentBlockHash: header.parentHash || null,
                      newRuntime: null
                    }
                  }
                }))
                
                // Send bestBlockChanged event
                console.log(`[WebSocket] Sending bestBlockChanged event: ${blockHash}`)
                onMessage(JSON.stringify({
                  jsonrpc: "2.0",
                  method: "chainHead_v1_followEvent",
                  params: {
                    subscription: followId,
                    result: {
                      event: "bestBlockChanged",
                      bestBlockHash: blockHash
                    }
                  }
                }))
              } else if (parsed.method === "chain_finalizedHead") {
                // Send finalized event
                onMessage(JSON.stringify({
                  jsonrpc: "2.0",
                  method: "chainHead_v1_followEvent",
                  params: {
                    subscription: followId,
                    result: {
                      event: "finalized",
                      finalizedBlockHashes: [blockHash],
                      prunedBlockHashes: []
                    }
                  }
                }))
              }
              
              return
            }
          }
        }
        
        // Pass through all other messages
        onMessage(message)
      } catch (e) {
        // Pass through on error
        onMessage(message)
      }
    })
    
    return {
      disconnect: inner.disconnect,
      send: (msg: string) => {
        try {
          const parsed = JSON.parse(msg)
          
          // Handle chainHead_v1_follow
          if (parsed.method === "chainHead_v1_follow") {
            const followId = generateId()
            
            console.log(`[WebSocket] Translating chainHead_v1_follow to legacy subscriptions (${followId})`)
            
            const newHeadsId = generateId()
            const finalizedId = generateId()
            
            subscriptions.set(followId, {
              initialized: false,
              pendingNewHeadsId: newHeadsId,
              pendingFinalizedId: finalizedId
            })
            
            // Subscribe to newHeads
            inner.send(JSON.stringify({
              jsonrpc: "2.0",
              id: newHeadsId,
              method: "chain_subscribeNewHeads",
              params: []
            }))
            
            // Subscribe to finalizedHeads  
            inner.send(JSON.stringify({
              jsonrpc: "2.0",
              id: finalizedId,
              method: "chain_subscribeFinalizedHeads",
              params: []
            }))
            
            // Send the follow response immediately
            setTimeout(() => {
              onMessage(JSON.stringify({
                jsonrpc: "2.0",
                id: parsed.id,
                result: followId
              }))
            }, 0)
            
            return
          }
          
          // Handle chainHead_v1_unfollow
          if (parsed.method === "chainHead_v1_unfollow") {
            const [followId] = parsed.params
            const sub = subscriptions.get(followId)
            
            if (sub) {
              console.log(`[WebSocket] Cleaning up chainHead subscription ${followId}`)
              
              // Unsubscribe from legacy subscriptions
              if (sub.newHeadsId) {
                inner.send(JSON.stringify({
                  jsonrpc: "2.0",
                  id: generateId(),
                  method: "chain_unsubscribeNewHeads",
                  params: [sub.newHeadsId]
                }))
              }
              
              if (sub.finalizedId) {
                inner.send(JSON.stringify({
                  jsonrpc: "2.0",
                  id: generateId(),
                  method: "chain_unsubscribeFinalizedHeads",
                  params: [sub.finalizedId]
                }))
              }
              
              subscriptions.delete(followId)
              
              // Send success response
              setTimeout(() => {
                onMessage(JSON.stringify({
                  jsonrpc: "2.0",
                  id: parsed.id,
                  result: null
                }))
              }, 0)
              return
            }
          }
          
          // Handle chainHead_v1_header
          if (parsed.method === "chainHead_v1_header") {
            const [followId, hash] = parsed.params
            
            // If hash is null, return an error
            if (!hash) {
              setTimeout(() => {
                onMessage(JSON.stringify({
                  jsonrpc: "2.0",
                  id: parsed.id,
                  error: {
                    code: -32602,
                    message: "Invalid params",
                    data: "Block hash cannot be null"
                  }
                }))
              }, 0)
              return
            }
            
            // Otherwise, translate to chain_getHeader
            inner.send(JSON.stringify({
              jsonrpc: "2.0",
              id: parsed.id,
              method: "chain_getHeader",
              params: [hash]
            }))
            return
          }
          
          // Let all other requests pass through
        } catch (e) {
          // If parsing fails, continue normally
        }
        
        // Send all other requests normally
        inner.send(msg)
      }
    }
  }
}

export function getWebsocketProvider(source: WebsocketSource): JsonRpcProvider {
  const baseProvider = getWsProvider(source.endpoint)
  
  // Apply chainHead to legacy translation for all chains (assuming PoW)
  const translatedProvider = createChainHeadToLegacyTranslator(baseProvider)
  
  return withPolkadotSdkCompat(translatedProvider)
}