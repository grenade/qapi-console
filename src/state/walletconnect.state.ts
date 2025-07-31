import { localStorageSubject } from "@/utils/localStorageSubject"
import { state, withDefault } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { WalletConnectModal } from "@walletconnect/modal"
import { SessionTypes } from "@walletconnect/types"
import UniversalProvider from "@walletconnect/universal-provider"
import { getSdkError } from "@walletconnect/utils"
import {
  getPolkadotSignerFromPjs,
  PolkadotSigner,
} from "polkadot-api/pjs-signer"
import {
  catchError,
  defer,
  EMPTY,
  filter,
  finalize,
  firstValueFrom,
  from,
  fromEventPattern,
  ignoreElements,
  map,
  Observable,
  of,
  scan,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs"

// https://docs.reown.com/advanced/multichain/polkadot/dapp-integration-guide
// TODO: Add Resonance chain ID once we have the genesis hash
// Format: "polkadot:<genesis_hash>"
const chains: string[] = [
  // Pre-quantum chains removed - only post-quantum chains supported
]
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID
const walletConnectModal = new WalletConnectModal({
  projectId,
  chains,
})

const provider$ = state(
  defer(() =>
    UniversalProvider.init({
      projectId,
      relayUrl: "wss://relay.walletconnect.com",
    }),
  ),
)

interface InitializedSession {
  uri?: string
  approval: () => Promise<SessionTypes.Struct>
}
const initializeSession$ = () =>
  provider$.pipe(
    take(1),
    switchMap(
      (provider): Promise<InitializedSession> =>
        provider.client.connect({
          requiredNamespaces: {
            polkadot: {
              methods: ["polkadot_signTransaction", "polkadot_signMessage"],
              chains,
              events: ["chainChanged", "accountsChanged"],
            },
          },
        }),
    ),
  )

const sessionSubject = localStorageSubject<SessionTypes.Struct>(
  "wallet-connect",
  JSON,
)

type WalletConnectStatus =
  | {
      type: "disconnected"
    }
  | {
      type: "connecting"
    }
  | {
      type: "connected"
      session: SessionTypes.Struct
    }

const connect$ = defer(initializeSession$).pipe(
  switchMap(({ uri, approval }) => {
    if (!uri) return approval()

    walletConnectModal.openModal({ uri })
    const modal$ = fromEventPattern<{ open: boolean }>(
      (handler) => walletConnectModal.subscribeModal(handler),
      (_, fn) => fn(),
    )
    const closed$ = modal$.pipe(
      tap((v) => console.log("modal event", v)),
      filter(({ open }) => !open),
    )

    return from(approval()).pipe(
      takeUntil(closed$),
      finalize(() => walletConnectModal.closeModal()),
    )
  }),
  map((session): WalletConnectStatus => ({ type: "connected", session })),
  catchError((err) => {
    console.log("connect WalletConnect error", err)
    return of(EMPTY) as any as Observable<WalletConnectStatus>
  }),
  startWith({ type: "connecting" } satisfies WalletConnectStatus),
)
const disconnect$ = provider$.pipe(
  take(1),
  switchMap((provider) =>
    provider.session
      ? provider.client.disconnect({
          topic: provider.session.topic,
          reason: getSdkError("USER_DISCONNECTED"),
        })
      : EMPTY,
  ),
  ignoreElements(),
  startWith({
    type: "disconnected",
  } satisfies WalletConnectStatus),
)

export const [toggleConnect$, toggleWalletConnect] = createSignal<void>()

export const walletConnectStatus$ = state(
  sessionSubject.stream$.pipe(
    take(1),
    switchMap((session): Observable<WalletConnectStatus> => {
      const connectState$ = toggleConnect$.pipe(
        scan((acc) => !acc, !!session),
        switchMap((connect) =>
          connect
            ? connect$.pipe(
                tapOnLast((v) => {
                  // hack! if connect$ didn't actually complete, toggle it off
                  if (v?.type !== "connected") {
                    toggleWalletConnect()
                  }
                }),
              )
            : disconnect$,
        ),
        tap((v) => {
          if (v.type === "connected") {
            sessionSubject.setValue(v.session)
          } else {
            sessionSubject.clear()
          }
        }),
      )

      return connectState$.pipe(
        startWith(
          (session
            ? {
                type: "connected",
                session,
              }
            : {
                type: "disconnected",
              }) satisfies WalletConnectStatus,
        ),
      )
    }),
  ),
  {
    type: "disconnected",
  },
)

const getAccounts = (session: SessionTypes.Struct) =>
  Object.values(session.namespaces)
    .map((namespace) => namespace.accounts)
    .flat()
    .map((wcAccount) => wcAccount.split(":")[2])

const getSigner = (session: SessionTypes.Struct, address: string) =>
  getPolkadotSignerFromPjs(
    address,
    async (transactionPayload) => {
      const provider = await firstValueFrom(provider$)

      console.log("Topic to check chainId below", session.topic)

      return provider.client.request({
        topic: session.topic,
        chainId: `polkadot:${transactionPayload.genesisHash.substring(2, 34)}`,
        request: {
          method: "polkadot_signTransaction",
          params: {
            address,
            transactionPayload,
          },
        },
      })
    },
    async ({ address, data }) => {
      const provider = await firstValueFrom(provider$)

      // const chainId = provider.session.topic.split(":")[1];
      const chainId = session.topic.split(":")[1]

      return provider.client.request({
        topic: session.topic,
        chainId: `polkadot:${chainId}`,
        request: {
          method: "polkadot_signMessage",
          params: {
            address,
            message: data,
          },
        },
      })
    },
  )

const getSignersFromSession = (
  session: SessionTypes.Struct,
): Record<string, PolkadotSigner> => {
  const accounts = getAccounts(session)
  return Object.fromEntries(
    accounts.map((address) => [address, getSigner(session, address)]),
  )
}

export const walletConnectAccounts$ = walletConnectStatus$.pipeState(
  map((status) =>
    status.type === "connected" ? getSignersFromSession(status.session) : {},
  ),
  withDefault({} as Record<string, PolkadotSigner>),
)

const tapOnLast =
  <T>(onLast: (value: T | null) => void) =>
  (source$: Observable<T>) =>
    defer(() => {
      let value: T | null = null
      return source$.pipe(
        tap({
          next(v) {
            value = v
          },
          complete() {
            onLast(value)
          },
        }),
      )
    })
