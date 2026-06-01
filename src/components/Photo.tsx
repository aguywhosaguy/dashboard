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
    <div class="flex h-2/3 aspect-video mx-auto">
      <img class="h-full w-full" src={path()} />
    </div> 
  )
}
