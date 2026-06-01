import { For, onCleanup, onMount, Show } from "solid-js";
import { commands, Habit } from "../bindings";
import { createStore } from "solid-js/store";
import { listen } from "@tauri-apps/api/event";

export default function Habits() {
  const [habits, setHabits] = createStore<Record<string, Habit>>()

  async function refreshHabits() {
    const newHabits = await commands.getHabits();

    if (newHabits.status === 'error') {
      console.error(newHabits.error)
      return
    }

    setHabits(newHabits.data)
  }

  const completeHabit = (habit: [string, Habit]) => {
    commands.completeHabit(habit[0])

    setHabits(
      habit[0],
      "amount",
      habit[1].amount + 1
    )
  }


  onMount(async () => {
    refreshHabits()

    const habitHandler = await listen<Record<string, Habit>>("habits-updated", (e) => {
      setHabits(e.payload)
    })

    window.addEventListener("refresh:habits", refreshHabits)

    onCleanup(() => habitHandler())

    onCleanup(() => window.removeEventListener("refresh:habits", refreshHabits))
  })

  return (
    <div class="flex flex-col h-full w-1/4 p-2 border">
      <h1 class="text-6xl text-center mb-8">Habit Tracker</h1>
      <ul class="flex flex-col space-y-3 overflow-scroll">
        <For each={Object.entries(habits)}>
          {(habit: [string, Habit]) => (
            <Show when={habit[1].amount < habit[1].max}>
              <li class="flex ml-4 items-center py-1">
                <button class="mr-4 btn btn-neutral" onClick={() => completeHabit(habit)}>Complete</button>
                <h1 class="text-xl">{habit[1].name}</h1>
              </li>
            </Show>
          )}
        </For>
      </ul>
    </div> 
  )
}

