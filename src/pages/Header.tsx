import { Link, useLocation } from "react-router-dom"
import { NetworkSwitcher } from "./Network/Network"
import { FC, PropsWithChildren } from "react"
import { twMerge } from "tailwind-merge"

export const Header = () => (
  <div className="flex p-4 pb-2 items-center flex-shrink-0 gap-2">
    <div className="flex flex-1 items-center flex-row gap-2">
      <img
        className="w-14 min-w-14 hidden dark:inline-block"
        src="/papi_logo-dark.svg"
        alt="papi-logo"
      />
      <img
        className="w-14 min-w-14 dark:hidden"
        src="/papi_logo-light.svg"
        alt="papi-logo"
      />
      <h1 className="hidden lg:block poppins-regular text-lg">
        papi <span className="poppins-extralight">console</span>
      </h1>
    </div>
    <NetworkSwitcher />
    <div className="flex flex-row items-center justify-end px-1 py-1 text-nowrap">
      <NavLink to="/explorer">Explorer</NavLink>
      <NavLink to="/storage">Storage</NavLink>
      <NavLink to="/extrinsics">Extrinsics</NavLink>
      <NavLink to="/constants">Constants</NavLink>
      <NavLink to="/runtimeCalls">Runtime Calls</NavLink>
      <NavLink to="/metadata">Metadata</NavLink>
    </div>
  </div>
)

const NavLink: FC<PropsWithChildren<{ to: string }>> = ({ to, children }) => {
  const location = useLocation()
  const active = location.pathname.startsWith(to)

  return (
    <Link
      to={to}
      className={twMerge(
        "transition-colors text-foreground/75 hover:text-foreground cursor-pointer px-3 py-1",
        active && "text-foreground font-bold",
      )}
    >
      {children}
    </Link>
  )
}
