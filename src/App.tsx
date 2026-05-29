import { createSignal, For, onMount } from "solid-js";
import { commands, GoogleEvent, GoogleEventList } from "./bindings";
import "./App.css";
import { convertFileSrc } from "@tauri-apps/api/core";

function App() {
  const [path, setPath] = createSignal("");

  const [events, setEvents] = createSignal<GoogleEventList>();

  onMount(async () => {
    setPath(await getRandomWallpaper())

    const vents = await commands.getEvents('primary')
    
    setEvents(vents.status == "ok" ? vents.data : undefined)
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
    let path = await commands.getRandPhoto('/home/henryw/wallpapers/');


    let imgpath = convertFileSrc(path.status == "ok" ? path.data : "");

    return imgpath
  }
  
  return (
    <main class="w-screen flex-col h-screen bg-base-100" data-theme="synthwave">
      <div class="flex h-1/4 w-full">
        <For each={getCurrentWeekDates()}>
          {(item, _) => (
            <div class="flex-col border h-full grow p-2">
              <p class="justify-start">{item.getDate()}</p>
              <For each={events()?.items.filter((event: GoogleEvent) => new Date(event.start.date).getDate() == item.getDate())}>
                {(event, _) => (
                  <a href={event.htmlLink}>{event.summary}</a>
                )}
              </For>
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
