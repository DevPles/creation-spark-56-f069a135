import TopBar from "@/components/TopBar";
import OpmeApp from "./OpmeApp";

export default function OpmePage() {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <OpmeApp embedded />
      </main>
    </div>
  );
}
