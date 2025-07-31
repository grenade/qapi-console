import { localStorageSubject } from "@/utils/localStorageSubject"
import {
  IdentityData,
  IdentityJudgement,
} from "@polkadot-api/descriptors"
import { state } from "@react-rxjs/core"
import { Binary, SS58String } from "polkadot-api"
import { catchError, from, of, tap } from "rxjs"

export interface Identity {
  displayName: string
  judgments: Array<{
    registrar: number
    judgement: IdentityJudgement["type"]
  }>
}
export const isVerified = (identity: Identity | null) =>
  identity?.judgments.some((j) => j.judgement === "Reasonable")

const cache = localStorageSubject<Record<string, Identity>>(
  "identity-cache",
  JSON,
  {},
)

// Identity lookups disabled - Polkadot People chain not supported in post-quantum fork
const apiProm = Promise.resolve(null as any)

export const getAddressName = async (
  addr: string,
): Promise<Identity | null> => {
  const typedApi = await apiProm
  // Identity service disabled for post-quantum chains
  if (!typedApi) return null
  
  let id = await typedApi.query.Identity.IdentityOf.getValue(addr)

  let subIdStr = ""
  if (!id) {
    const sup = await typedApi.query.Identity.SuperOf.getValue(addr)
    if (!sup) return null
    const subDisplay = readIdentityData(sup[1])?.asText() || ""
    if (!subDisplay) return null
    subIdStr = ` (${subDisplay})`
    id = await typedApi.query.Identity.IdentityOf.getValue(sup[0])
    if (!id) return null
  }

  const displayName = readIdentityData(id.info.display)?.asText()
  return displayName
    ? {
        displayName: `${displayName}${subIdStr}`,
        judgments: id.judgements.map(([registrar, judgement]: [any, any]) => ({
          registrar,
          judgement: judgement.type,
        })),
      }
    : null
}

export const identity$ = state(
  (address: SS58String) =>
    from(getAddressName(address)).pipe(
      tap((v) =>
        cache.setValue((c) => {
          if (v) {
            return { ...c, [address]: v }
          } else {
            delete c[address]
            return c
          }
        }),
      ),
      catchError(() => of(null)),
    ),
  (address) => cache.getValue()[address] ?? null,
)

const readIdentityData = (identityData: IdentityData): Binary | null => {
  if (identityData.type === "None" || identityData.type === "Raw0") return null
  if (identityData.type === "Raw1")
    return Binary.fromBytes(new Uint8Array(identityData.value))
  return identityData.value
}
