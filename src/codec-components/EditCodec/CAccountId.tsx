import { AccountIdDisplay } from "@/components/AccountIdDisplay"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  accountDetail$,
  accounts$,
  getPublicKey,
} from "@/state/extension-accounts.state"
import { identity$, isVerified } from "@/state/identity.state"
import { cn } from "@/utils/cn"
import { EditAccountId, NOTIN } from "@polkadot-api/react-builder"
import { getSs58AddressInfo } from "@polkadot-api/substrate-bindings"
import { toHex } from "@polkadot-api/utils"
import { state, useStateObservable } from "@react-rxjs/core"
import { combineKeys } from "@react-rxjs/utils"
import { Check, ChevronsUpDown } from "lucide-react"
import { FC, useState } from "react"
import { map, switchMap, take } from "rxjs"

const hintedAccounts$ = state(
  combineKeys(
    accounts$.pipe(
      map((accounts) =>
        [...accounts.entries()]
          .filter(([, { address }]) => !address.startsWith("0x"))
          .map(([key]) => key),
      ),
    ),
    (address) =>
      accounts$.pipe(
        map((v) => v.get(address)!),
        take(1),
        switchMap((details) =>
          identity$(details.address).pipe(
            map((identity) => ({
              address: details.address,
              name: identity?.displayName ?? details.name,
              isVerified: isVerified(identity),
            })),
          ),
        ),
      ),
  ).pipe(map((v) => new Map(v))),
  new Map<
    string,
    {
      address: string
      name: string | undefined
      isVerified: boolean | undefined
    }
  >(),
)

export const CAccountId: EditAccountId = ({ value, onValueChanged }) => {
  const accounts = useStateObservable(hintedAccounts$)

  const [query, setQuery] = useState("")
  const queryInfo = getSs58AddressInfo(query)

  const [open, _setOpen] = useState(false)
  const setOpen = (value: boolean) => {
    _setOpen(value)
    setQuery("")
  }

  const valueIsNew =
    value !== NOTIN &&
    !accounts.has(toHex(getPublicKey(value) ?? new Uint8Array()))

  const accountList = Array.from(accounts.entries())
  if (value !== NOTIN) {
    accountList.sort(([, a], [, b]) =>
      a.address === value ? -1 : b.address === value ? 1 : 0,
    )
  }

  const onTriggerKeyDown = (evt: React.KeyboardEvent) => {
    if (evt.key.length === 1) {
      setOpen(true)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onKeyDown={onTriggerKeyDown}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex w-64 justify-between overflow-hidden px-2 border border-border bg-input"
          forceSvgSize={false}
        >
          {value !== NOTIN ? (
            <AccountIdDisplay value={value} className="overflow-hidden" />
          ) : (
            <span className="opacity-80">Select…</span>
          )}
          <ChevronsUpDown size={14} className="opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput
            placeholder="Filter…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              <div className="text-foreground/50">
                The value is not a valid Account ID
              </div>
            </CommandEmpty>
            <CommandGroup>
              {valueIsNew && (
                <AccountOption
                  account={value}
                  selected={true}
                  onSelect={() => setOpen(false)}
                />
              )}
              {accountList.map(([key, account]) => (
                <AccountOption
                  key={key}
                  account={account.address}
                  selected={value === account.address}
                  onSelect={() => {
                    onValueChanged(account.address)
                    setOpen(false)
                  }}
                />
              ))}
              {queryInfo.isValid && (
                <AccountOption
                  account={query}
                  selected={value === query}
                  onSelect={() => {
                    onValueChanged(query)
                    setOpen(false)
                  }}
                />
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

const AccountOption: FC<{
  account: string
  selected: boolean
  onSelect: () => void
}> = ({ account, selected, onSelect }) => {
  const details = useStateObservable(accountDetail$(account))
  const identity = useStateObservable(identity$(account))

  const name = identity?.displayName ?? details?.name

  return (
    <CommandItem
      value={account + "_" + name}
      onSelect={onSelect}
      className="flex flex-row items-center gap-2 p-1"
      forceSvgSize={false}
    >
      <AccountIdDisplay value={account} className="overflow-hidden" />
      <Check
        size={12}
        className={cn(
          "ml-auto shrink-0",
          selected ? "opacity-100" : "opacity-0",
        )}
      />
    </CommandItem>
  )
}
