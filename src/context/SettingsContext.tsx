import { createContext, ParentProps, useContext } from "solid-js";
import { createStore, SetStoreFunction } from "solid-js/store";
import { PublicConfig } from "../bindings";

type FilterSignal = {
  set: SetStoreFunction<Record<string, boolean>>,
  get: Record<string, boolean>
}

type ConfigSignal = {
  set: SetStoreFunction<PublicConfig>,
  get: PublicConfig
}

type SettingsType = {
  filters: FilterSignal,
  config: ConfigSignal
}

const SettingsContext = createContext<SettingsType>()

export function SettingProvider(props: ParentProps<{initConfig: PublicConfig}>) {
  const [filters, setFilters] = createStore<Record<string, boolean>>({})

  const [config, setConfig] = createStore<PublicConfig>(props.initConfig)

  return (
    <SettingsContext.Provider value={{
      filters: {
        set: setFilters,
        get: filters
      },
      config: {
        set: setConfig,
        get: config
      }
    }}>
      {props.children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)!
