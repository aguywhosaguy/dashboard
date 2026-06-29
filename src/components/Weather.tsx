import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from "solid-js"
import weatherImages from "../weatherimages.json"
import { commands, LocationWeather } from "../bindings"
import { useSettings } from "../context/SettingsContext"

export default function WeatherModule() {
  const { config } = useSettings()

  const [weather, setWeather] = createSignal<LocationWeather>()

  const [time, setTime] = createSignal<Date>(new Date())
  
  onMount(() => {
    const interval = setInterval(() => setTime(new Date()), 100)
    
    onCleanup(() => clearInterval(interval))
  })

  createEffect(on(() => (config.get.location), async() => {
    const newWeather = await commands.getWeather(config.get.location)

    if (newWeather.status === 'error') {
      console.error(newWeather.error)
      return
    }

    setWeather(newWeather.data)
  }))

  const weatherInfo = () => {
    const code = weather()?.current.weather_code

    if (code === undefined || code === null) return undefined;

    const key = String(code) as keyof typeof weatherImages;

    return weatherImages[key]
  }

  const DAYS = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat"
  ]
  
  return (
      <div class="flex h-1/3 w-full border items-center">
        <Show when={weather()} keyed>
          {(weather: LocationWeather) => (
            <>
              <img class="w-1/4 aspect-square" src={weather.current.is_day ? weatherInfo()?.day.image : weatherInfo()?.night.image} />
              <div class="flex flex-col w-1/4">
                <h1 class="text-3xl">{weather.location}</h1>
                <h1 class="text-7xl">{Math.round(weather.current.temperature_2m)}°</h1>
              </div>
              <div class="flex flex-col w-1/4">
                <p>Feels like {Math.round(weather.current.apparent_temperature)}°</p>
                <p>Low: {Math.round(weather.daily.temperature_2m_min[0])}° | High: {Math.round(weather.daily.temperature_2m_max[0])}°</p>
                <p>Humidity: {Math.round(weather.current.relative_humidity_2m)}%</p>
                <p class="mb-8">Precipitation: {Math.round(weather.current.precipitation)}in</p>
                <For each={weather.daily.time}>
                  {(time, index) => (
                    <div class="flex justify-between">
                      <p class="w-fit">{DAYS[new Date(time * 1000).getDay()]}</p>
                      <p class="w-fit self-end mr-4">
                        {Math.round(weather.daily.temperature_2m_min[index()])}° 
                        {Math.round(weather.daily.temperature_2m_max[index()])}°
                      </p>
                    </div>
                  )}
                </For>
              </div>
              <div class="flex flex-col w-1/4">
                <h1 class="text-5xl text-center">
                  {time().getHours() % 12 || 12}
                  :
                  {time().getMinutes().toString().padStart(2, '0')}
                  {time().getHours() >= 12 ? 'p' : 'a'}
                </h1>
              </div>
            </>
          )}
        </Show>
    </div>
  )
}
