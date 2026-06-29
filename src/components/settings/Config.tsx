import { For, onMount } from "solid-js";
import { useSettings } from "../../context/SettingsContext";
import { commands, PublicConfig } from "../../bindings";
import { createStore } from "solid-js/store";

export default function Config() {
  const { config } = useSettings()

  const [values, setValues] = createStore<Record<string, string>>({})

  const set = async (key: keyof PublicConfig, value: string) => {
    config.set(key, value)
    await commands.updateConfig(config.get)
  }
  
  return (
    <fieldset class="flex flex-col p-1 mt-1 space-y-4">
      <For each={Object.entries(config.get)}>
        {([key, value]) => (
          <div>
            <div>
              <legend class="fieldset-legend">
                {
                  key.split('_')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')
                }
              </legend>
            </div>
            <div class="join">
              <input type="text" class="input" placeholder=
                {
                  key.split('_')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')
                } 
                value={value}
                onInput={e => setValues(key, e.target.value)}
              />
              <button 
                class="btn btn-neutral join-item" 
                onClick={async () => await set(key as keyof PublicConfig, values[key]!)}>
                  Save
              </button>
            </div>
          </div>
        )}
      </For> 
    </fieldset>
  )
}
