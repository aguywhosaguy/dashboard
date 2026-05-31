import { createEffect, createResource, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import clsx from "clsx";
import { commands, GoogleColorList, GoogleDate, GoogleEvent, GoogleTask, GoogleTasklist, Habit } from "./bindings";
import "./App.css";
import { convertFileSrc } from "@tauri-apps/api/core";
import { createStore } from "solid-js/store";
import { listen } from "@tauri-apps/api/event";

type GoogleEventHelper = GoogleEvent & {startDate: Date, endDate: Date}

function App() {
  const [path, setPath] = createSignal("");

  const [colors, setColors] = createSignal<GoogleColorList>();

  const [events, setEvents] = createSignal<GoogleEventHelper[]>([]);

  const [tasklists, setTasklists] = createSignal<GoogleTasklist[]>([])

  const [tasklist, setTasklist] = createSignal<GoogleTasklist>()

  const [tasks, setTasks] = createStore<GoogleTask[]>([])

  const [habits, setHabits] = createStore<Record<string, Habit>>()

  const handles: Record<string, () => Promise<void>> = {
    'p': refreshWallpaper,
    'e': refreshEvents,
    'h': refreshHabits
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

    refreshHabits()

    const habitHandler = await listen<Record<string, Habit>>("habits-updated", (e) => {
      setHabits(e.payload)
    })

    window.addEventListener("keydown", handler)

    onCleanup(() => habitHandler())

    onCleanup(() => window.removeEventListener("keydown", handler))
  })


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
    const getDate = (date: GoogleDate) => new Date(date.dateTime ?? date.date ?? 2000) 

    if (vents.status === 'error') {
      console.error(vents.error)
      return
    }

    const newEvents: GoogleEventHelper[] = vents.data.map(vent => ({
      ...vent,
      startDate: getDate(vent.start),
      endDate: getDate(vent.end)
    }))

    setEvents(newEvents)
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

 async function refreshHabits() {
    const newHabits = await commands.getHabits();

    console.log(newHabits)

    if (newHabits.status === 'error') {
      console.error(newHabits.error)
      return
    }

    setHabits(newHabits.data)
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
      (event: GoogleEventHelper) => 
        event.startDate.toLocaleDateString() 
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

  const completeHabit = (habit: [string, Habit]) => {
    commands.completeHabit(habit[0])

    setHabits(
      habit[0],
      "amount",
      habit[1].amount + 1
    )
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
              <For each={dayEvents(item).sort((e1, e2) => e1.startDate.getTime() - e2.startDate.getTime())}>
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
                    <p class="text-base-100 h-fit w-3/4 overflow-x-clip">{event.summary}</p>
                    <p class="text-base-300 h-fit w-1/4 text-right">
                      {event.startDate.getHours() % 12 || 12}
                      :
                      {String(event.startDate.getMinutes()).padStart(2, '0')}
                      {event.startDate.getHours() >= 12 ? 'p' : 'a'}
                    </p>
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
        <div class="flex flex-col h-full w-1/4 p-2 border">
          <h1 class="text-6xl text-center mb-8">Habit Tracker</h1>
          <ul class="flex flex-col space-y-3 overflow-scroll">
            <For each={Object.entries(habits)}>
              {(habit: [string, Habit]) => (
                <Show when={habit[1].amount < habit[1].max}>
                  <li class="flex ml-4 items-center py-1">
                    <button class="mr-4 btn btn-neutral" onClick={(e) => completeHabit(habit)}>Complete</button>
                    <h1 class="text-xl">{habit[1].name}</h1>
                  </li>
                </Show>
              )}
            </For>
          </ul>
        </div> 
      </div>
    </main>
  );
}

export default App;

