export const chainSpec = JSON.stringify({
  name: "Resonance",
  id: "resonance",
  chainType: "Live",
  bootNodes: [
    "/dns/a1.t.res.fm/tcp/30201/p2p/QmYpbayBgKbhfHGn2kNWWhh3DHwBnPaLDMYvaGmT78oAP7",
    "/dns/a2.t.res.fm/tcp/30203/p2p/QmeN9H9CBdBESd6wib9xetPiYsCLYPTAJn8sxajWi2Bjkb",
    "/dns/a3.t.res.fm/tcp/30202/p2p/QmQLf3wj7KqqtTjtrq7iQZY5JokQ3k7HHLGe5hNvHSxnFr",
  ],
  properties: { ss58Format: 189, tokenDecimals: 12, tokenSymbol: "RES" },
  codeSubstitutes: {},
  genesis: {
    stateRootHash:
      "0xdbacc01ae41b79388135ccd5d0ebe81eb0905260344256e6f4003bb8e75a91b5",
  },
  // TODO: To support light client mode without syncing from genesis, add lightSyncState:
  // lightSyncState: {
  //   header: { ... }, // Finalized block header
  //   authoritySet: { ... }, // GRANDPA authority set at that block
  // }
  // For now, use websocket connection (wss://a.t.res.fm) instead of light-client mode
})
