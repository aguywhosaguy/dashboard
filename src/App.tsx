import { createSignal, For, onMount } from "solid-js";
import "./App.css";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

function App() {
  const [path, setPath] = createSignal("");

  onMount(async () => {
    setPath(await getRandomWallpaper())
  })


  function getCurrentWeekDates(): Date[] {
    const now = new Date();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    sunday.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + i);
      return day;
    });
  }

  async function getRandomWallpaper(): Promise<string> {
    let path: string = await invoke('get_rand_photo', {folder: '/home/henryw/wallpapers/'})

    path = convertFileSrc(path);

    return path
  }
  
  return (
    <main class="w-screen flex-col h-screen bg-base-100" data-theme="synthwave">
      <div class="flex h-1/4 w-full">
        <For each={getCurrentWeekDates()}>
          {(item, _) => (
            <div class="flex-col border h-full grow p-2">
              <p class="justify-start">{item.getDate()}</p>
            </div>  
          )}
        </For>
      </div>
      <div class="flex h-3/4 full">
        <div class="h-full grow min-w-1/4 border">
          Taskas 
        </div> 
        <div class="flex-col h-full border">
          <div class="flex h-2/3 aspect-video border">
            <img class="h-full w-full" src={path()} />
          </div> 
          <div class="flex h-1/3 w-full border">
            Waether
          </div>
        </div> 
        <div class="h-full grow min-w-1/4 border">
          HABITS 
        </div> 
      </div>
    </main>
  );
}

export default App;
