import { PlayCircle, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

interface GuidedTourProps {
  onClose: () => void;
}

// Shown exactly once, right after a farmer's very first sign-in (see
// tour-utils.ts). A single video walkthrough of the app, rather than the
// multi-step interactive tour this used to be — swap VIDEO_URL in once a
// real recording exists; until then this shows a friendly placeholder
// instead of a broken player.
const VIDEO_URL: string | null = null;

export function GuidedTour({ onClose }: GuidedTourProps) {
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-primary/10 via-background to-background flex flex-col">
      <div className="flex items-center justify-between px-5 pt-5">
        <BrandLogo className="h-8 w-8" />
        <button onClick={onClose} aria-label="Close" className="text-gray-400 p-2 -mr-2">
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <h2 className="text-2xl font-bold text-gray-800 leading-snug">Welcome to Chiguru!</h2>
        <p className="text-base text-gray-600 mt-2 leading-relaxed max-w-xs">
          Here's a quick look at how the app works.
        </p>

        <div className="w-full max-w-sm mt-6 aspect-video rounded-2xl overflow-hidden shadow-sm">
          {VIDEO_URL ? (
            <video src={VIDEO_URL} controls autoPlay className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary/10 flex flex-col items-center justify-center gap-2 text-primary/60">
              <PlayCircle className="h-12 w-12" />
              <p className="text-sm font-medium">Video coming soon</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-8 pt-1">
        <button
          onClick={onClose}
          className="w-full rounded-2xl h-14 bg-primary text-primary-foreground text-lg font-semibold active:bg-primary/90"
        >
          Get started →
        </button>
      </div>
    </div>
  );
}
