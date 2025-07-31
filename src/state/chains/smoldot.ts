import { JsonRpcProvider } from "@polkadot-api/substrate-client"
import { getSmProvider } from "polkadot-api/sm-provider"
import { startFromWorker } from "polkadot-api/smoldot/from-worker"
import SmWorker from "polkadot-api/smoldot/worker?worker"

const smoldot = startFromWorker(new SmWorker(), {
  logCallback: (level, target, message) => {
    const lvl: keyof typeof console =
      level <= 1 ? "error" : level == 2 ? "warn" : "debug"
    if (import.meta.env.DEV || level <= 2) {
      console[lvl]("smoldot[%s(%s)] %s", target, level, message)
    }
  },
  forbidWs: true,
})

export interface SmoldotSource {
  type: "chainSpec"
  id: string
  value: {
    chainSpec: string
    relayChain?: string
  }
}

export function createSmoldotSource(
  id: string,
  relayChain?: string,
): Promise<SmoldotSource> {
  return import(`./chainspecs/${id}.ts`).then(({ chainSpec }) => {
    const parsed = JSON.parse(chainSpec)
    return {
      id,
      type: "chainSpec",
      value: {
        chainSpec,
        relayChain: relayChain || parsed.relayChain || parsed.relay_chain,
      },
    }
  })
}

export function getSmoldotProvider(source: SmoldotSource): JsonRpcProvider {
  // Since we only support post-quantum chains, we don't support parachains/relay chains
  const chain = smoldot.addChain({
    chainSpec: source.value.chainSpec,
  })

  return getSmProvider(chain)
}
