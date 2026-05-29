import { createSignal, For, onMount } from "solid-js";
import clsx from "clsx";
import { commands, GoogleEvent } from "./bindings";
import "./App.css";
import { convertFileSrc } from "@tauri-apps/api/core";

function App() {
  const CALENDAR = "primary"

  const [path, setPath] = createSignal("");

  const [events, setEvents] = createSignal<GoogleEvent[]>([]);

  onMount(async () => {
    setPath(await getRandomWallpaper())

    refreshEvents()
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

 async function refreshEvents() {
    const vents = await commands.getEvents(CALENDAR);

    if (vents.status == 'error') {
      console.error(vents.error)
      return
    }

    setEvents(vents.data.items)
  }

  async function getRandomWallpaper(): Promise<string> {
    let path = await commands.getRandPhoto('/home/henryw/wallpapers/');


    let imgpath = convertFileSrc(path.status == "ok" ? path.data : "");

    return imgpath
  }

  const dayEvents = (date: Date) => 
    events()
    .filter(
      (event: GoogleEvent) => 
        new Date(
          event.start.dateTime 
            ?? event.start.date 
            ?? 2000
        ).toLocaleDateString() 
        === date.toLocaleDateString())
  
  return (
    <main class="flex flex-col w-screen h-screen bg-base-100" data-theme="synthwave">
      <div class="flex h-1/4 w-full">
        <For each={getCurrentWeekDates()}>
          {(item, _) => (
            <div class={clsx( 
              "flex flex-col align-middle border h-full grow p-2 w-0",
              item.getDate() === new Date().getDate() ? "border-primary border-2" : ""
            )}>
              <p class={clsx("text-2xl h-1/5 justify-start", item.getDate() === new Date().getDate() ? "text-3xl text-primary" : "")}>{item.getDate()}</p>
              <For each={dayEvents(item)}>
                {(event, _) => (
                  <div class="flex items-center p-2 h-8 w-full bg-base-content rounded-md">
                    <p class="text-base-100 h-fit w-fit">{event.summary}</p>
                  </div>
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

