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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 bg-white/80 rounded-full p-1.5"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="md:w-1/2 aspect-video md:aspect-auto bg-gradient-to-br from-primary via-primary to-[#6E56CF] flex flex-col items-center justify-center gap-3 p-8 relative overflow-hidden">
          {VIDEO_URL ? (
            <video src={VIDEO_URL} controls autoPlay className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <>
              <BrandLogo className="h-16 w-16 opacity-90" />
              <div className="h-14 w-14 rounded-full bg-white/15 flex items-center justify-center">
                <PlayCircle className="h-8 w-8 text-white" />
              </div>
              <p className="text-sm font-medium text-white/80">Product walkthrough — coming soon</p>
            </>
          )}
        </div>

        <div className="md:w-1/2 flex flex-col justify-between p-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 leading-snug">Welcome to Chiguru</h2>
            <p className="text-base text-gray-600 mt-3 leading-relaxed">
              Manage{" "}
              <span className="inline-block rounded-md px-1.5 py-0.5 bg-[#6E56CF]/10 text-[#6E56CF] font-medium">
                Attendance
              </span>
              ,{" "}
              <span className="inline-block rounded-md px-1.5 py-0.5 bg-[#C9A227]/10 text-[#A8801E] font-medium">
                Farm Accounts
              </span>
              ,{" "}
              <span className="inline-block rounded-md px-1.5 py-0.5 bg-[#22C55E]/10 text-[#1B9950] font-medium">
                AI Advisor
              </span>{" "}
              and the{" "}
              <span className="inline-block rounded-md px-1.5 py-0.5 bg-primary/10 text-primary font-medium">
                Marketplace
              </span>{" "}
              — all in one app.
            </p>
          </div>

          <div className="flex justify-end mt-8 md:mt-0">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full h-12 px-6 bg-primary text-primary-foreground text-base font-semibold hover:bg-primary/90"
            >
              Get Started →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
