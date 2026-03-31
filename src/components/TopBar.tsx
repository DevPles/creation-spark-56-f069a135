import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";

const TopBar = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const initials = profile?.name
    ? profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || "??";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="topbar sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-3">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-xs">La</span>
            </div>
            <span className="font-display font-semibold text-foreground text-sm hidden sm:block">Larilu</span>
          </button>

          <div className="flex-1 flex justify-center gap-2">
            <Button size="sm" onClick={() => navigate("/dashboard")} className="rounded-full px-4">Menu</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/lancamento")} className="rounded-full px-4">Lançar metas</Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors shrink-0">
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-2 border-b border-border">
                <p className="text-sm font-medium text-foreground">{profile?.name || user?.email}</p>
                <p className="text-xs text-muted-foreground">{profile?.facility_unit}</p>
              </div>
              <DropdownMenuItem onClick={() => navigate("/admin")}>Meu perfil</DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
