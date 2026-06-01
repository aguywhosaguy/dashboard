import { Dynamic, Portal } from "solid-js/web"
import { Refresh, RefreshProps } from "./settings/Refresh"
import { Component, createSignal } from "solid-js"
import Filters from "./settings/Filters"

export type SettingsProps = {
  ref: HTMLDialogElement,
  refreshProps: RefreshProps
}

type Setting = {
  component: Component<any>,
  props: Record<string, any>
}

export default function Settings(props: SettingsProps) {
  const [setting, setSetting] = createSignal<Setting>({
    component: Refresh,
    props: props.refreshProps
  })

  return (
    <Portal>
      <dialog class="modal" ref={props.ref}>
        <div class="flex modal-box aspect-square overflow-hidden">
          <ul class="menu h-full w-1/3">
            <li>
              <button onClick={() => setSetting({ component: Refresh, props: props.refreshProps })}>
                Refresh
              </button>
            </li>
            <li>
              <button onClick={() => setSetting({ component: Filters, props: {} })}>
                Filters
              </button>
            </li>
          </ul>
          <div class="divider divider-horizontal"></div>
          <div>
            <Dynamic component={setting().component} {...setting().props}>
            
            </Dynamic>
          </div>
        </div>
      </dialog>
    </Portal>
  )
}
