import { FC, PropsWithChildren } from "react"
import { twMerge } from "tailwind-merge"

export const Title: FC<PropsWithChildren> = ({ children }) => (
  <h2 className="font-bold p-2 border-b border-slate-400 mb-2">{children}</h2>
)

export const Table: FC<PropsWithChildren> = ({ children }) => (
  <table className="border-collapse m-auto">
    <tbody>{children}</tbody>
  </table>
)

export const Row: FC<
  PropsWithChildren<{
    number: number
    finalized: number
    firstInGroup: boolean
    idx: number
  }>
> = ({ children, number, finalized, firstInGroup, idx }) => (
  <tr
    className={twMerge(
      number > finalized ? "bg-muted-foreground/5" : "",
      idx > 0 &&
        number === finalized &&
        firstInGroup &&
        "border-t border-card-foreground/50",
    )}
  >
    {children}
  </tr>
)

export const Root: FC<PropsWithChildren> = ({ children }) => {
  return (
    <div className="w-full px-3 py-2 border bg-card text-card-foreground">
      {children}
    </div>
  )
}
