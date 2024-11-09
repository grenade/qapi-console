import { CopyText } from "@/components/Copy"
import { JsonDisplay } from "@/components/JsonDisplay"
import { FC } from "react"
import { Link } from "react-router-dom"
import { BlockStatusIcon, statusText } from "./Detail/BlockState"
import { EventInfo, eventKey } from "./events.state"

export const EventPopover: FC<{ event: EventInfo }> = ({ event }) => {
  return (
    <div>
      <div className="flex justify-between items-center gap-4 mb-2">
        <h3 className="font-bold text-lg">
          Event{" "}
          <Link
            to={`${event.hash}#event=${event.index}`}
            className="text-primary/70 hover:text-primary"
          >
            {eventKey(event)}
          </Link>
        </h3>
        <p className="flex gap-1">
          Status:
          <BlockStatusIcon state={event.status} />
          {statusText[event.status]}
        </p>
      </div>
      <p className="overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-2">
        Block: {event.hash.slice(0, 18)}…
        <CopyText text={event.hash} binary />
      </p>
      <p className="font-bold">{`${event.event.type}.${event.event.value.type}`}</p>
      <JsonDisplay src={event.event.value.value} />
    </div>
  )
}
