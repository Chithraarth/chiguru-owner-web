import { Home, Users, Loader2 } from "lucide-react";
import { useEstate, type MyEstate } from "@/lib/use-estate";

// Shown once, right after sign-in, whenever this person has more than one
// estate relationship to pick from — their own farm(s), and/or one or more
// farms they've been invited to help manage. Picking one sets activeEstateId,
// which every API call already sends as X-Estate-Id; the backend resolves
// who that makes this person (owner or invitee) from that header alone, so
// nothing else needs to happen here.
export default function ChooseEstate() {
  const { myEstates, myEstatesLoading, setActiveEstate } = useEstate();

  if (myEstatesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const own = myEstates.filter((e) => e.relationship === "own");
  const invited = myEstates.filter((e) => e.relationship === "invited");

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-16">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Choose a farm</h1>
          <p className="text-sm text-gray-500 mt-1">
            You have access to more than one farm. Pick which one to work on.
          </p>
        </div>

        {own.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">My farms</p>
            <div className="space-y-2">
              {own.map((estate) => (
                <EstateRow key={estate.id} estate={estate} icon={Home} onPick={() => setActiveEstate(estate.id)} />
              ))}
            </div>
          </div>
        )}

        {invited.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Invited to</p>
            <div className="space-y-2">
              {invited.map((estate) => (
                <EstateRow key={estate.id} estate={estate} icon={Users} onPick={() => setActiveEstate(estate.id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EstateRow({
  estate,
  icon: Icon,
  onPick,
}: {
  estate: MyEstate;
  icon: typeof Home;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      className="w-full flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:border-primary/40 transition-colors"
    >
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <span className="font-semibold text-gray-900">{estate.farmName}</span>
    </button>
  );
}
