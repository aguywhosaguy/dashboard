import { For } from "solid-js";
import { useSettings } from "../../context/SettingsContext";

export default function Filters() {
  const { filters } = useSettings()
  
  return (
    <ul class="flex flex-col p-1 mt-1 space-y-4">
      <For each={Object.entries(filters.get)}>
        {([calendar, filtered]) => (
          <li class="flex items-center">
            <input type="checkbox" class="checkbox checkbox-xl" checked={filtered} onClick={() => filters.set(calendar, !filtered)} />
            <p class="h-fit ml-4">{calendar}</p>
          </li>
        )}
      </For> 
    </ul>
  )
}
