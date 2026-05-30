import { createEffect, createResource, createSignal, For, onCleanup, onMount } from "solid-js";
import clsx from "clsx";
import { commands, GoogleColorList, GoogleEvent, GoogleTask, GoogleTasklist } from "./bindings";
import "./App.css";
import { convertFileSrc } from "@tauri-apps/api/core";
import { createStore } from "solid-js/store";

function App() {
  const [path, setPath] = createSignal("");

  const [colors, setColors] = createSignal<GoogleColorList>();

  const [events, setEvents] = createSignal<GoogleEvent[]>([]);

  const [tasklists, setTasklists] = createSignal<GoogleTasklist[]>([])

  const [tasklist, setTasklist] = createSignal<GoogleTasklist>()

  const [tasks, setTasks] = createStore<GoogleTask[]>([])

  const handles: Record<string, () => Promise<void>> = {
    'p': refreshWallpaper,
    'r': refreshEvents,
  }

  const handler = (e: KeyboardEvent) => {
    if (handles[e.key]) {
      handles[e.key]()
    }
  }

  onMount(async () => {
    refreshWallpaper()

    refreshEvents()

    refreshTasklists()

    const color = await commands.getColors()

    color.status === 'ok' && setColors(color.data)

    const tasklist = await commands.getTasklists()

    tasklist.status === 'ok' && setTasklists(tasklist.data)

    window.addEventListener("keydown", handler)

  })

  onCleanup(() => window.removeEventListener("keydown", handler))

  const [rawTasks] = createResource(tasklist, async (list) => {
    const task = await commands.getTasks(list)

    return task.status === 'ok' ? setTasks(task.data) : setTasks([]) 
  })

  createEffect(() => {rawTasks() && setTasks(rawTasks()!)})

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
    const vents = await commands.getAllEvents();

    if (vents.status === 'error') {
      console.error(vents.error)
      return
    }

    setEvents(vents.data)
  }

 async function refreshTasklists() {
    const tlists = await commands.getTasklists();

    if (tlists.status === 'error') {
      console.error(tlists.error)
      return
    }

    setTasklists(tlists.data)

    setTasklist(tlists.data[0])
  }

  async function refreshWallpaper() {
    let path = await commands.getRandPhoto('/home/henryw/wallpapers/');

    if (path.status === 'error') {
      console.error(path.error)
      return
    }

    setPath(convertFileSrc(path.data))

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

  const toggleComplete = (task: GoogleTask) => {
    const status = task.status === 'completed' ? task.status = 'needsAction' : task.status = 'completed'


    setTasks(
      t => t.id === task.id,
      'status',
      status
    )

    commands.setTask({...task, status: status})
  }
  
  return (
    <main class="flex flex-col w-screen h-screen bg-base-100" data-theme="synthwave">
      <div class="flex h-1/4 w-full">
        <For each={getCurrentWeekDates()}>
          {(item, _) => (
            <div class={clsx( 
              "flex flex-col overflow-y-auto align-middle border h-full grow p-2 w-0",
              item.getDate() === new Date().getDate() ? "border-primary border-2" : ""
            )}>
              <h1 class={clsx(
                "flex items-center text-2xl h-1/5 justify-start shrink-0", 
                item.getDate() === new Date().getDate() ? "text-3xl text-primary" : "")}>{item.getDate()}

              </h1>
              <For each={dayEvents(item)}>
                {(event, _) => (
                  <div 
                    class={clsx(
                      "flex items-center p-2 mb-1 h-8 w-full bg-base-content rounded-md",
                      event.colorId ? '' : 'bg-base-content'
                    )}
                    style={{
                      "background-color": event.colorId
                        ? colors()?.event[event.colorId]?.background
                        : undefined
                    }}
                  >
                    <p class="text-base-100 h-fit w-fit">{event.summary}</p>
                  </div>
                )}
              </For>
            </div>  
          )}
        </For>
      </div>
      <div class="flex h-3/4 full">
        <div class="h-full w-1/4 p-2 flex flex-col border">
          <button class="text-6xl underline dropdown mb-8" popovertarget="tasklists" style={{"anchor-name": '--tasklist-anchor'}}>
            {tasklist()?.title}
          </button>
          <ul class="dropdown menu bg-base-200 rounded-box shadow-sm"
          popover
          id="tasklists"
          style={{"position-anchor": '--tasklist-anchor'}}
          >
            <For each={tasklists()}>
              {(task: GoogleTasklist) => <li><a onClick={() => setTasklist(task)}>{task.title}</a></li>}
            </For>
          </ul>
          <ul class="flex flex-col space-y-3 overflow-scroll">
            <For each={tasks}>
              {(task: GoogleTask) => 
              (
                <li class="flex ml-4 items-center py-1">
                  <input 
                    type="checkbox" 
                    class="mr-4 checkbox checkbox-primary"
                    checked={task.status === 'completed'} 
                    onChange={(e) => toggleComplete(task)}
                  />
                  <p class={clsx('text-xl text-primary strikethrough', task.status === 'completed' ? 'struck' : '')} >{task.title}</p>
                </li>
              )}
            </For>
          </ul>
        </div> 
        <div class="flex-col h-full w-2/4 border">
          <div class="flex h-2/3 aspect-video mx-auto">
            <img class="h-full w-full" src={path()} />
          </div> 
          <div class="flex h-1/3 w-full border">
            Waether
          </div>
        </div> 
        <div class="h-full w-1/4 border">
          HABITS 
        </div> 
      </div>
    </main>
  );
}

export default App;

