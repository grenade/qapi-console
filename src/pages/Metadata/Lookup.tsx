import { ExpandBtn } from "@/components/Expand"
import { V14Lookup } from "@polkadot-api/substrate-bindings"
import {
  createContext,
  FC,
  PropsWithChildren,
  useContext,
  useState,
} from "react"

export const Lookup: FC<{ lookup: V14Lookup }> = ({ lookup }) => {
  const [id, setId] = useState(0)

  return (
    <div className="border rounded p-2 flex flex-col gap-2">
      <h3 className="font-bold text-xl">Lookup</h3>
      <label>
        Id:{" "}
        <input
          className="text-sm border rounded p-2 border-polkadot-200 leading-tight text-white"
          value={id}
          onChange={(evt) => setId(evt.target.valueAsNumber)}
          type="number"
        />
      </label>
      <div className="border-t max-h-[75vh] overflow-auto">
        <LookupContext.Provider value={lookup}>
          <LookupNode id={id} />
        </LookupContext.Provider>
      </div>
    </div>
  )
}

type V14Entry = V14Lookup extends Array<infer R> ? R : never
type V14Def = V14Entry extends { def: infer R } ? R : never
type V14SpecificDef<T extends V14Def["tag"]> = V14Def & { tag: T }
type NodeProps<T extends V14Def["tag"]> = {
  entry: V14Entry
  value: V14SpecificDef<T>
}

const LookupContext = createContext<V14Lookup>(null as any)

const LookupNode: FC<{ id: number }> = ({ id }) => {
  const lookup = useContext(LookupContext)
  const entry = lookup[id]
  if (!entry) return null

  switch (entry.def.tag) {
    case "array":
      return <ArrayNode entry={entry} value={entry.def} />
    case "bitSequence":
      return <BitSequenceNode entry={entry} value={entry.def} />
    case "compact":
      return <CompactNode entry={entry} value={entry.def} />
    case "composite":
      return <CompositeNode entry={entry} value={entry.def} />
    case "primitive":
      return <PrimitiveNode entry={entry} value={entry.def} />
    case "sequence":
      return <SequenceNode entry={entry} value={entry.def} />
    case "tuple":
      return <TupleNode entry={entry} value={entry.def} />
    case "variant":
      return <VariantNode entry={entry} value={entry.def} />
  }
}

const LookupLink: FC<{ id: number }> = ({ id }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border rounded p-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1"
      >
        <ExpandBtn expanded={expanded} />
        id: {id}
      </button>
      {expanded && <LookupNode id={id} />}
    </div>
  )
}

const ArrayNode: FC<NodeProps<"array">> = ({ entry, value }) => (
  <GenericLookupNode entry={entry}>
    <p>Length: {value.value.len}</p>
    <LookupLink id={value.value.type} />
  </GenericLookupNode>
)

const BitSequenceNode: FC<NodeProps<"bitSequence">> = ({ entry, value }) => (
  <GenericLookupNode entry={entry}>
    <div>
      <h4 className="font-bold">BitStore</h4>
      <LookupLink id={value.value.bitStoreType} />
    </div>
    <div>
      <h4 className="font-bold">BitOrder</h4>
      <LookupLink id={value.value.bitOrderType} />
    </div>
  </GenericLookupNode>
)

const CompactNode: FC<NodeProps<"compact">> = ({ entry, value }) => (
  <GenericLookupNode entry={entry}>
    <LookupLink id={value.value} />
  </GenericLookupNode>
)

const CompositeNode: FC<NodeProps<"composite">> = ({ entry, value }) => (
  <GenericLookupNode entry={entry}>
    {value.value.map((field, idx) => {
      const name = field.name ?? `Item ${idx}`

      return (
        <div key={name}>
          <h4 className="font-bold">{name}</h4>
          <LookupLink id={field.type} />
        </div>
      )
    })}
  </GenericLookupNode>
)

const PrimitiveNode: FC<NodeProps<"primitive">> = ({ entry, value }) => (
  <GenericLookupNode entry={entry}>
    <p>Value: {value.value.tag}</p>
  </GenericLookupNode>
)

const SequenceNode: FC<NodeProps<"sequence">> = ({ entry, value }) => (
  <GenericLookupNode entry={entry}>
    <LookupLink id={value.value} />
  </GenericLookupNode>
)

const TupleNode: FC<NodeProps<"tuple">> = ({ entry, value }) => (
  <GenericLookupNode entry={entry}>
    {value.value.map((field, idx) => (
      <div key={idx}>
        <h4 className="font-bold">Item {idx}</h4>
        <LookupLink id={field} />
      </div>
    ))}
  </GenericLookupNode>
)

const VariantNode: FC<NodeProps<"variant">> = ({ entry, value }) => (
  <GenericLookupNode entry={entry}>
    {value.value.map((variant) => (
      <div key={variant.name} className="border-b pb-4">
        <h4 className="font-bold">{variant.name}</h4>
        {variant.fields.map((field, idx) => {
          const name = field.name ?? `Item ${idx}`

          return (
            <div key={name}>
              {variant.fields.length > 1 && (
                <h4 className="font-bold">{name}</h4>
              )}
              <LookupLink id={field.type} />
            </div>
          )
        })}
      </div>
    ))}
  </GenericLookupNode>
)

const GenericLookupNode: FC<PropsWithChildren<{ entry: V14Entry }>> = ({
  entry,
  children,
}) => {
  return (
    <div className="flex flex-col gap-2 w-full">
      <div>
        <h4 className="font-bold">Type: {entry.def.tag}</h4>
        {entry.path.length ? <p>Path: {entry.path.join(".")}</p> : null}
      </div>
      {children}
    </div>
  )
}
