import { convertFileSrc } from "@tauri-apps/api/core";
import { BaseDirectory, join, pictureDir } from "@tauri-apps/api/path";
import { readDir } from "@tauri-apps/plugin-fs";
import { createSignal, onCleanup, onMount } from "solid-js";

export default function Photo() {
  const [path, setPath] = createSignal("");

  async function refreshPhoto() {
    console.log(BaseDirectory.Picture)
    const dir = await pictureDir();
    console.log(dir)
    const entries = await readDir('.', { baseDir: BaseDirectory.Picture });

    const images = entries.filter(e =>
      e.isFile && /\.(png|jpe?g|gif|webp)$/i.test(e.name ?? '')
    );
    if (!images.length) return;

    const pick = images[Math.floor(Math.random() * images.length)];
    const fullPath = await join(dir, pick.name!);

    setPath(convertFileSrc(fullPath)); // ← that's it
  }
  onMount(async () => {
    await refreshPhoto()

    window.addEventListener("refresh:photo", refreshPhoto)
  })

  onCleanup(() => window.removeEventListener("refresh:photo", refreshPhoto))

  return (
    <div class="flex h-2/3 w-full mx-auto relative group">
      <img class="h-full aspect-video object-cover" src={path()} />
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
