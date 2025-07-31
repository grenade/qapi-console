# Migration Notes: Post-Quantum Fork

This document describes the changes made to transform the original papi-console into qapi-console, a post-quantum focused blockchain console.

## Overview

This fork removes all support for chains using pre-quantum signature algorithms (ECDSA, Ed25519, Sr25519) and focuses exclusively on chains using post-quantum signatures. Currently, only Resonance chain is supported, which uses ML-DSA (Module-Lattice Digital Signature Algorithm) signatures.

## Major Changes

### 1. Removed Pre-Quantum Chains

The following chains and their associated files have been removed:

- **Polkadot** and all parachains (Asset Hub, Bridge Hub, Collectives, Coretime, People)
- **Kusama** and all parachains (Asset Hub, Coretime, Encointer, People)
- **Westend** and all parachains (Asset Hub, Collectives, People)
- **Paseo** and parachains (Asset Hub)
- **Other chains**: Acala, Ajuna, Astar, HydraDX, Invarch

### 2. Smoldot Light Client Changes

- Removed relay chain initialization for Polkadot, Kusama, Paseo, and Westend
- Simplified smoldot provider to only support standalone chains (no parachain/relay chain support)
- Note: Resonance currently doesn't support light client mode due to missing `lightSyncState` in chainspec

### 3. Default Configuration Updates

- Changed default network from Polkadot to Resonance
- Updated default endpoint selection to respect network's light client capability
- Fixed endpoint selection to use WebSocket when light client is not supported

### 4. Branding Changes

- Renamed color scheme from "polkadot-*" to "quantus-*" in Tailwind CSS classes
- Updated package name from "papi-console" to "qapi-console"
- Added description emphasizing post-quantum focus

### 5. Identity Service

- Disabled identity lookups (previously relied on Polkadot People chain)
- Removed whitelist.ts configuration for identity queries
- Identity service returns null for all lookups

### 6. WalletConnect Integration

- Removed hardcoded chain IDs for Polkadot and Westend
- Currently no chains configured (TODO: add Resonance once genesis hash is available)

## File Changes Summary

### Deleted Files
- All chainspec files except `resonance.ts` in `src/state/chains/chainspecs/`
- All network JSON files except `resonance.json` in `src/state/chains/networks/`
- `whitelist.ts` (identity service configuration)

### Modified Files
- `src/state/chains/smoldot.ts` - Removed relay chain support
- `src/state/chains/chain.state.ts` - Updated default endpoint selection
- `src/state/identity.state.ts` - Disabled identity lookups
- `src/state/walletconnect.state.ts` - Removed pre-quantum chain IDs
- `tailwind.config.js` - Renamed polkadot colors to quantus
- `package.json` - Updated name and description
- All `.tsx` files - Updated CSS classes from polkadot-* to quantus-*

## Current Status

- **Supported Chain**: Resonance (ML-DSA signatures)
- **Connection Type**: WebSocket only (light client not yet supported)
- **Endpoint**: wss://a.t.res.fm

## TODOs

1. **Light Client Support**: Add `lightSyncState` to Resonance chainspec to enable light client mode
2. **WalletConnect**: Add Resonance chain ID once genesis hash is determined
3. **Identity Service**: Consider implementing identity lookups for Resonance if needed
4. **Additional Chains**: Add support for other post-quantum chains as they become available

## Breaking Changes

This fork is incompatible with the original papi-console as it:
- Only supports post-quantum signature algorithms
- Removes all pre-quantum chain support
- Changes the default network and configuration
- Disables features that depended on removed chains (like identity lookups)

## Usage

After these changes, when running the console:
1. It will automatically connect to Resonance via WebSocket
2. The UI will show "Resonance" as the selected network
3. All chain interactions will use ML-DSA signatures
4. Pre-quantum chains cannot be added or selected