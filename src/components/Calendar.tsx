import clsx from "clsx"
import { createSignal, For, onCleanup, onMount } from "solid-js"
import { commands, GoogleColorList, GoogleDate, GoogleEvent } from "../bindings"
import { useSettings } from "../context/SettingsContext";

type GoogleEventHelper = GoogleEvent & {startDate: Date, endDate: Date}

export default function Calendar() {
  const [colors, setColors] = createSignal<GoogleColorList>();

  const [rawEvents, setRawEvents] = createSignal<Record<string, GoogleEventHelper[]>>({});

  const { filters } = useSettings()

  const events = () => {
    return Object.entries(rawEvents())
      .filter(([calendar, _]) => filters.get[calendar] === true)
      .map(([_, events]) => events)
      .flat()
  }

  async function refreshEvents() {
    const vents = await commands.getAllEvents();

    if (vents.status === 'error') {
      console.error(vents.error)
      return
    }

    const getDate = (date: GoogleDate) => new Date(date.dateTime ?? date.date ?? 2000) 

    setRawEvents(
      Object.fromEntries(
        Object.entries(vents.data)
          .map(([calendar, eventList]) => [
            calendar,
            eventList.map((event: GoogleEvent) => ({
              ...event,
              startDate: getDate(event.start),
              endDate: getDate(event.end)
            }))
          ]
        )
      )
    )
  }

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

  const dayEvents = (date: Date) => 
    events()
    .filter(
      (event: GoogleEventHelper) => 
        event.startDate.toLocaleDateString() 
        === date.toLocaleDateString())

  onMount(async () => {
    const col = await commands.getColors()

    col.status === 'ok' && setColors(col.data)

    await refreshEvents()

    filters.set(
      Object.fromEntries(
        Object.keys(rawEvents())
          .map(calendar => [calendar, true])
      )
    )

    window.addEventListener("refresh:events", refreshEvents)

    onCleanup(() => window.removeEventListener("refresh:events", refreshEvents))
  })


  return (
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
  )
}

