import { commands } from "../bindings";
import { convertFileSrc } from "@tauri-apps/api/core";
import { createSignal, onCleanup, onMount } from "solid-js";

export default function Photo() {
  const [path, setPath] = createSignal("");

  async function refreshPhoto() {
    let path = await commands.getRandPhoto('/home/henryw/wallpapers/');

    if (path.status === 'error') {
      console.error(path.error)
      return
    }

    setPath(convertFileSrc(path.data))
  }


  onMount(async () => {
    await refreshPhoto()

    window.addEventListener("refresh:photo", refreshPhoto)
  })

  onCleanup(() => window.removeEventListener("refresh:photo", refreshPhoto))

  return (
    <div class="flex h-2/3 w-full mx-auto relative group">
      <img class="h-full w-full" src={path()} />
      <div class="flex absolute pointer-events-none inset-0 justify-end items-end">
         <button 
          class="btn btn-info pointer-events-auto m-2 transition duration-300 opacity-0 group-hover:opacity-100" 
          onClick={() => refreshPhoto()}>
            New
          </button>
      </div>
    </div> 
  )
}
