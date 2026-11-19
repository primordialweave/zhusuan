import '@/styles/scene-greeter.css'

export interface SceneGreeterProps {
  /** Which crop of the still the figure has to follow. */
  crop: 'cover' | 'page'
  /** Waves hello now and then; otherwise she simply stands on the bridge. */
  waving: boolean
}

/** The girl on the bridge, redrawn as three poses laid exactly over her place in the still. */
export default function SceneGreeter({ crop, waving }: SceneGreeterProps) {
  return (
    <div className="scene-greeter" data-crop={crop} data-waving={waving || undefined}>
      <span className="scene-greeter__pose" data-pose="rest" />
      <span className="scene-greeter__pose" data-pose="wave-a" />
      <span className="scene-greeter__pose" data-pose="wave-b" />
    </div>
  )
}
