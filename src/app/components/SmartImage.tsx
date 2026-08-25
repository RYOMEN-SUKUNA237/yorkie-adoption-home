import { useState, type ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";

/**
 * An image that handles its own loading and failure states.
 *
 * Plain <img> on a slow connection shows an empty grey box and then snaps
 * to the photograph — on a page that is mostly photographs of puppies, that
 * reads as broken. This holds a quiet shimmer until the file decodes, then
 * fades it in, and shows an honest placeholder if it never arrives rather
 * than leaving a hole in the layout.
 */
export function SmartImage({
  src,
  alt,
  className = "",
  wrapperClassName = "",
  ...rest
}: {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "className">) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  return (
    <span className={`relative block overflow-hidden bg-secondary ${wrapperClassName}`}>
      {state === "loading" && (
        <span className="absolute inset-0 shimmer" aria-hidden="true" />
      )}

      {state === "failed" ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
          <ImageOff size={20} />
          <span className="text-[10px] tracking-wide">Photo unavailable</span>
        </span>
      ) : (
        <img
          {...rest}
          src={src}
          alt={alt}
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
          className={`${className} transition-opacity duration-700 ${
            state === "ready" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </span>
  );
}
