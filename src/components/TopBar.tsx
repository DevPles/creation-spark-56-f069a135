import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TopBar = () => {
  const navigate = useNavigate();

  return (
    <header className="topbar sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-3">
          {/* Logo */}
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-xs">SL</span>
            </div>
            <span className="font-display font-semibold text-foreground text-sm hidden sm:block">
              SisLu
            </span>
          </button>

          <div className="flex items-center gap-2">
            {/* Menu button */}
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="gap-1.5">
              <Menu className="w-4 h-4" />
              Menu
            </Button>

            {/* Profile avatar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors shrink-0">
                  AS
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-2 border-b border-border">
                  <p className="text-sm font-medium text-foreground">Ana Silva</p>
                  <p className="text-xs text-muted-foreground">ana.silva@hospital.gov.br</p>
                </div>
                <DropdownMenuItem onClick={() => navigate("/admin")}>Meu perfil</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/")}>Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
