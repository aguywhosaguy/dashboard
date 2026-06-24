import { createSignal, For, Index, onCleanup, onMount, Show } from "solid-js";
import { commands, Habit, HabitFrequency, HabitLogs } from "../bindings";
import { createStore } from "solid-js/store";
import { listen } from "@tauri-apps/api/event";

export default function Habits() {
  const [frequency, setFrequency] = createSignal<HabitFrequency>("daily")
  const [habits, setHabits] = createStore<Record<string, Habit>>()
  const [logs, setLogs] = createStore<HabitLogs>({
    daily: {},
    weekly: {}
  });

  async function refreshHabits() {
    const newHabits = await commands.getHabits();

    if (newHabits.status === 'error') {
      console.error(newHabits.error)
      return
    }

    setHabits(newHabits.data)
  }

  async function refreshLogs() {
    const newLogs = await commands.getHabitHistory();

    if (newLogs.status === 'error') {
      console.error(newLogs.error)
      return
    }

    setLogs(newLogs.data);
  }

  const completeHabit = (habit: [string, Habit]) => {
    commands.completeHabit(habit[0])

    setHabits(
      habit[0],
      "amount",
      habit[1].amount + 1
    )
    
    if (habit[1].amount >= habit[1].max) {refreshHabits(); refreshLogs()}
  }

  function epochDays(): number[] {
    const MS_IN_DAY = 86400000;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    
    const todayEpochDays = Math.floor(today.getTime() / MS_IN_DAY);
    const currentDayOfWeek = today.getDay(); 
    
    const weekEpochDays: number[] = [];
    
    for (let i = 0; i < 7; i++) {
      const offset = i - currentDayOfWeek;
      weekEpochDays.push(todayEpochDays + offset);
    }
    
    console.log(weekEpochDays)

    return weekEpochDays;
  }

  onMount(async () => {
    refreshHabits()
    refreshLogs()

    const habitHandler = await listen<Record<string, Habit>>("habits-updated", (e) => {
      setHabits(e.payload)
    })

    const updateBoth = () => {refreshHabits(); refreshLogs();}

    window.addEventListener("refresh:habits", updateBoth)

    onCleanup(() => habitHandler())

    onCleanup(() => window.removeEventListener("refresh:habits", updateBoth))
  })

  return (
    <div class="flex flex-col h-full w-1/4 p-2 border">
      <h1 class="text-6xl text-center underline mt-4 mb-2">Habit Tracker</h1>
      <div class="tabs tabs-box mb-8">
        <input 
          type='radio' 
          name="habit-tabs" 
          class="tab w-1/2" 
          aria-label="Daily" 
          value="daily" 
          onChange={(e) => setFrequency(e.currentTarget.value as HabitFrequency)}
          checked 
        />
        <input 
          type='radio' 
          name="habit-tabs" 
          class="tab w-1/2" 
          aria-label="Weekly" 
          value="weekly" 
          onChange={(e) => setFrequency(e.currentTarget.value as HabitFrequency)}
        />
      </div>
      <ul class="flex flex-col ml-4 space-y-3 overflow-scroll">
        <For each={Object.entries(habits).filter(([key, habit]) => habit.frequency === frequency())}>
          {(habit: [string, Habit]) => (
            <li class="flex flex-col">
              <div class="flex mb-1 items-center py-1">
                <button 
                  class="mr-4 btn btn-neutral" 
                  disabled={habit[1].amount >= habit[1].max} 
                  onClick={() => completeHabit(habit)}>
                    Complete
                </button>
                <h1 class="text-xl">{habit[1].name}</h1>
              </div>
              <div class="flex mb-1">
                <Index each={Array.from({length: habit[1].max})}> 
                  {(_, index) => (
                    <svg viewBox="0 0 100 100" class="w-4 h-4">
                      <circle cx={50} cy={50} r={40} class={habit[1].amount >= index + 1 ? "fill-primary" : "fill-base-200"} />
                    </svg>
                  )}
                </Index>
              </div>
              <Show when={habit[1].frequency === "daily"}>
                <div class="flex">
                  <For each={epochDays()}>
                    {(e: number) => (
                      <svg viewBox="0 0 100 100" class="w-4 h-4">
                        <circle cx={50} cy={50} r={40} class={
                          logs.daily?.[e]?.[habit[0]]?.count >= logs.daily?.[e]?.[habit[0]]?.max
                          ? "fill-base-content"
                          : "fill-base-200"
                        } />
                      </svg>
                    )}
                  </For>
                </div>
              </Show>
            </li>
            )}
        </For>
      </ul>
    </div> 
  )
}

