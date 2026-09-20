import * as React from "react"
import { cn } from "@/lib/utils"

const Image = React.forwardRef(({ src, alt, className, ...props }, ref) => {
  return (
    <img
      ref={ref}
      src={src}
      alt={alt || "Imagem do Sistema"}
      className={cn("object-cover", className)}
      {...props}
    />
  )
})

Image.displayName = "Image"

export { Image }