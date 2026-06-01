import { For } from "solid-js";

type RefreshFunc = {
  refreshName: string,
  name: string
};

export type RefreshProps = {
  refreshers: RefreshFunc[]
}

export function Refresh(props: RefreshProps) {
  return (
    <ul class="flex flex-col mt-1 p-1 space-y-4">
      <For each={props.refreshers}>
        {(refresh: RefreshFunc) => (
          <li class="flex items-center">
            <button class="btn" onClick={() => window.dispatchEvent(new CustomEvent("refresh:" + refresh.refreshName))}>Refresh</button>
            <p class="h-fit ml-4">{refresh.name}</p>
          </li>
        )}
      </For>
    </ul>
  )
}
