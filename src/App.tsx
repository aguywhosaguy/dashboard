import { createSignal, onCleanup, onMount, Show } from "solid-js";
import "./App.css";
import Settings from "./components/Settings";
import Calendar from "./components/Calendar";
import Tasks from "./components/Tasks";
import Habits from "./components/Habits";
import Photo from "./components/Photo";
import Weather from "./components/Weather";
import { SettingProvider } from "./context/SettingsContext";
import { commands, PublicConfig } from "./bindings";

function App() {
  const [initConfig, setInitConfig] = createSignal<PublicConfig>()
  let settingsRef: HTMLDialogElement;

  onMount(async () => {
    const newConfig = await commands.getConfig()
    
    if (newConfig.status === 'ok') { setInitConfig(newConfig.data) }

    const handler = (e: KeyboardEvent) => {
      if (e.key == 's') {
        settingsRef!.showModal();
      }
    }

    window.addEventListener("keydown", handler)

    onCleanup(() => window.removeEventListener("keydown", handler))
  })

  return (
    <Show when={initConfig()}>
      <SettingProvider initConfig={initConfig()!}>
        <main class="flex flex-col w-screen h-screen bg-base-100 cursor-none!" data-theme="synthwave">
          <Settings 
            ref={settingsRef}
            refreshProps={{
              refreshers: [
                {
                  refreshName: 'events',
                  name: 'Calendar'
                },
                {
                  refreshName: 'tasks',
                  name: 'Tasks'
                },
                {
                  refreshName: 'habits',
                  name: 'Habits'
                }
              ]
            }}
          />
          <Calendar />
          <div class="flex h-3/4 full">
            <Tasks />
            <div class="flex-col h-full w-2/4 border">
              <Photo />
              <Weather />
            </div> 
            <Habits />
          </div>
        </main>
      </SettingProvider>
    </Show>
  );
}



export default App;

