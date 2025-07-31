import { CopyText } from "@/components/Copy"
import { Popover } from "@/components/Popover"
import { Link } from "@/hashParams"
import { client$ } from "@/state/chains/chain.state"
import { state, useStateObservable } from "@react-rxjs/core"
import { FC } from "react"
import { combineLatest, debounceTime, map, switchMap } from "rxjs"
import { twMerge } from "tailwind-merge"
import { BlockInfo, blocksByHeight$, finalized$ } from "./block.state"
import { BlockPopover } from "./BlockPopover"
import * as Finalizing from "./FinalizingTable"

const best$ = client$.pipeState(
  switchMap((client) => client.bestBlocks$.pipe(map(([best]) => best))),
)

interface PositionedBlock {
  block: BlockInfo
  position: number
  branched: number | null
  branches: number[]
}

const blockTable$ = state(
  combineLatest([blocksByHeight$, best$]).pipe(
    debounceTime(0),
    map(([blocks, best]) => {
      const result: Array<PositionedBlock> = []

      const blockPositions: Record<string, number> = {}
      const positionsTaken = new Set<number>()
      const getFreePosition = () => {
        for (let i = 0; ; i++) {
          if (!positionsTaken.has(i)) {
            return i
          }
        }
      }
      for (let height = best.number; blocks[height]; height--) {
        const competingBlocks = [...blocks[height].values()]
        if (competingBlocks.length > 1) {
          if (height === best.number) {
            competingBlocks.sort((a) => (a.hash === best.hash ? -1 : 1))
          } else {
            competingBlocks.sort((a, b) =>
              (blockPositions[a.hash] ?? Number.POSITIVE_INFINITY) <
              (blockPositions[b.hash] ?? Number.POSITIVE_INFINITY)
                ? -1
                : 1,
            )
          }
        }
        competingBlocks.forEach((block) => {
          const branches = [...positionsTaken]

          const position = blockPositions[block.hash] ?? getFreePosition()
          if (blockPositions[block.parent] != null) {
            // then it means the parent was already discovered by a previous
            // so this is the start of a branch
            result.push({
              block,
              branched: blockPositions[block.parent],
              branches,
              position,
            })
            positionsTaken.delete(position)
          } else {
            // We put our parent underneath us
            blockPositions[block.parent] = position
            positionsTaken.add(position)
            result.push({
              block,
              branched: null,
              branches,
              position,
            })
          }
        })
      }

      return result
    }),
  ),
  [],
)

export const BlockTable = () => {
  const rows = useStateObservable(blockTable$)
  const finalized = useStateObservable(finalized$)

  const numberSpan = (idx: number) => {
    const initialIdx = idx
    const number = rows[idx].block.number
    do {
      idx++
    } while (number === rows[idx]?.block.number)
    return idx - initialIdx
  }
  // For PoW chains, finalized might be null, but we still want to show blocks

  return (
    <Finalizing.Root>
      <Finalizing.Title>Recent Blocks</Finalizing.Title>
      <Finalizing.Table>
        {rows.map((row, i) => (
          <Finalizing.Row
            key={row.block.hash}
            number={row.block.number}
            finalized={finalized?.number ?? -1}
            firstInGroup={row.position === 0}
            idx={i}
          >
            {rows[i - 1]?.block.number !== row.block.number ? (
              <td
                rowSpan={numberSpan(i)}
                className={twMerge(
                  "px-2",
                  numberSpan(i) > 1
                    ? twMerge(
                        i > 0 ? "border-y" : "border-b",
                        "border-card-foreground/25",
                      )
                    : null,
                  finalized && row.block.number === finalized.number &&
                    "border-t-card-foreground/50",
                  finalized && row.block.number === finalized.number + 1 &&
                    "border-b-card-foreground/50",
                )}
              >
                <Link to={`/explorer/${row.block.hash}`}>
                  {row.block.number.toLocaleString()}
                </Link>
              </td>
            ) : null}
            <td className="p-0">
              <ForkRenderer row={row} />
            </td>
            <td className="max-w-xs w-full">
              <div className="flex gap-1 pr-1">
                <Popover content={<BlockPopover hash={row.block.hash} />}>
                  <button
                    className={twMerge(
                      "overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm",
                      "text-card-foreground/80 hover:text-card-foreground/100",
                      row.position === 0
                        ? ""
                        : finalized && row.block.number > finalized.number
                          ? "opacity-80"
                          : "opacity-50",
                    )}
                  >
                    {row.block.hash}
                  </button>
                </Popover>
                <CopyText text={row.block.hash} binary />
              </div>
            </td>
          </Finalizing.Row>
        ))}
      </Finalizing.Table>
    </Finalizing.Root>
  )
}

const CELL_WIDTH = 20
const CELL_HEIGHT = 40
const CIRCLE_R = 5
const ForkRenderer: FC<{ row: PositionedBlock }> = ({ row }) => {
  const totalCells = Math.max(row.position, ...row.branches) + 1

  const getPositionCenter = (p: number) => CELL_WIDTH * p + CELL_WIDTH / 2

  return (
    <svg
      height={CELL_HEIGHT}
      width={CELL_WIDTH * totalCells}
      className="stroke-card-foreground/60"
    >
      {row.branches.map((branch, i) => (
        <line
          key={i}
          x1={getPositionCenter(branch)}
          y1={0}
          x2={getPositionCenter(branch)}
          y2={
            row.branched != null && branch === row.position
              ? CELL_HEIGHT / 2
              : CELL_HEIGHT
          }
        />
      ))}
      {row.branched != null ? (
        <line
          x1={getPositionCenter(row.branched)}
          y1={CELL_HEIGHT / 2}
          x2={getPositionCenter(row.position)}
          y2={CELL_HEIGHT / 2}
        />
      ) : row.branches.includes(row.position) ? null : (
        <line
          x1={getPositionCenter(row.position)}
          y1={CELL_HEIGHT / 2}
          x2={getPositionCenter(row.position)}
          y2={CELL_HEIGHT}
        />
      )}
      <circle
        cx={getPositionCenter(row.position)}
        cy={CELL_HEIGHT / 2}
        r={CIRCLE_R}
        className={
          row.position === 0 ? "fill-quantus-500" : "fill-quantus-600"
        }
      />
    </svg>
  )
}
