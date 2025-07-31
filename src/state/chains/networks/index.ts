import resonanceRawNetworks from "./resonance.json"

export type Network = {
  id: string
  display: string
  endpoints: Record<string, string>
  lightclient: boolean
  relayChain?: string
}

export type NetworkCategory = {
  name: string
  networks: Network[]
}

const [Resonance] = ([resonanceRawNetworks] as const).map((n): Network[] =>
  n.map((x) => ({
    endpoints: x.rpcs as any,
    lightclient: false,
    id: x.id,
    display: x.display,
    // Resonance is not a parachain, so no relay chain
  })),
)

const networks = {
  Resonance,
  Custom: [
    {
      id: "localhost",
      display: "Localhost",
      lightclient: false,
      endpoints: {
        "Port 9944": "ws://127.0.0.1:9944",
        "Port 3000": "ws://127.0.0.1:3000",
        "Port 8132": "ws://127.0.0.1:8132",
      },
    } as Network,
  ],
}

export const networkCategories: NetworkCategory[] = Object.entries(
  networks,
).map(([name, networks]) => ({ name, networks }))

export const getCustomNetwork = () => networks.Custom[0]
export const addCustomNetwork = (uri: string) => {
  getCustomNetwork().endpoints[uri] = uri
}

export const defaultNetwork = Resonance[0]
