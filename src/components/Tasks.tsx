import { createEffect, createResource, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { commands, GoogleTask, GoogleTasklist } from "../bindings";
import { createStore } from "solid-js/store";
import clsx from "clsx";

export default function Tasks() {
  const [tasklists, setTasklists] = createSignal<GoogleTasklist[]>([])

  const [tasklist, setTasklist] = createSignal<GoogleTasklist>()

  const [tasks, setTasks] = createStore<GoogleTask[]>([])

  const [rawTasks] = createResource(tasklist, async (list) => {
    const task = await commands.getTasks(list)

    return task.status === 'ok' ? setTasks(task.data) : setTasks([]) 
  })

  createEffect(() => {rawTasks() && setTasks(rawTasks()!)})


 async function refreshTasklists() {
    const tlists = await commands.getTasklists();

    if (tlists.status === 'error') {
      console.error(tlists.error)
      return
    }

    setTasklists(tlists.data)

    setTasklist(tlists.data[0])
  }

  const toggleComplete = (task: GoogleTask) => {
    const status = task.status === 'completed' ? task.status = 'needsAction' : task.status = 'completed'

    setTasks(
      t => t.id === task.id,
      'status',
      status
    )

    commands.setTask({...task, status: status})
  }

  onMount(async () => {
    await refreshTasklists()
    const tasklist = await commands.getTasklists()

    tasklist.status === 'ok' && setTasklists(tasklist.data)
    
    window.addEventListener('refresh:tasks', refreshTasklists)

    onCleanup(() => window.removeEventListener('refresh:tasks', refreshTasklists))
  })

  return (
    <div class="h-full w-1/4 p-2 flex flex-col border">
      <button class="text-6xl underline dropdown mb-8 mt-4" popovertarget="tasklists" style={{"anchor-name": '--tasklist-anchor'}}>
        {tasklist() ? tasklist()?.title : "Tasks"}
      </button>
      <ul class="dropdown menu bg-base-200 rounded-box shadow-sm"
      popover
      id="tasklists"
      style={{"position-anchor": '--tasklist-anchor'}}
      >
        <Show when={tasklists()}>
          <For each={tasklists()}>
            {(task: GoogleTasklist) => <li><a onClick={() => setTasklist(task)}>{task.title}</a></li>}
          </For>
        </Show>
      </ul>
      <ul class="flex flex-col space-y-3 overflow-scroll">
        <Show when={tasks}>
          <For each={tasks}>
            {(task: GoogleTask) => 
            (
              <li class="flex ml-4 items-center py-1">
                <input 
                  type="checkbox" 
                  class="mr-4 checkbox checkbox-primary"
                  checked={task.status === 'completed'} 
                  onChange={() => toggleComplete(task)}
                />
                <p class={clsx('text-xl text-primary strikethrough', task.status === 'completed' ? 'struck' : '')} >{task.title}</p>
              </li>
            )}
          </For>
        </Show>
              </ul>
        </div> 
      )
}
