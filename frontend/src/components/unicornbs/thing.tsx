import UnicornScene from "unicornstudio-react"

type UnicornTitleProps = {
  width?: string
  height?: string
  scale?: number
  dpi?: number
  className?: string
}

export default function UnicornTitle({
  width = "100%",
  height = "100%",
  scale = 1,
  dpi = 0.5,
  className,
}: UnicornTitleProps) {
  return (
    <div className={`h-full w-full ${className ?? ""}`.trim()}>
      <UnicornScene
        projectId="KTNdk58HcLkA61N0Smdy"
        width={width}
        height={height}
        scale={scale}
        dpi={dpi}
        sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@2.1.4/dist/unicornStudio.umd.js"
      />
    </div>
  )
}

