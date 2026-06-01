import { createContext, useContext } from "solid-js";
import { createStore, SetStoreFunction } from "solid-js/store";

type FilterSignal = {
  set: SetStoreFunction<Record<string, boolean>>,
  get: Record<string, boolean>
}

type SettingsType = {
  filters: FilterSignal
}

const SettingsContext = createContext<SettingsType>()

export function SettingProvider(props) {
  const [filters, setFilters] = createStore<Record<string, boolean>>({})

  return (
    <SettingsContext.Provider value={{
      filters: {
        set: setFilters,
        get: filters
      }
    }}>
      {props.children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)!
