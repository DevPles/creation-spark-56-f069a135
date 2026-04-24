import prsLogo from "@/assets/prs-logo.png";

const PrsCredit = () => {
  return (
    <div className="fixed bottom-3 left-3 z-[9998] flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm border border-border/50 pointer-events-none">
      <span>Desenvolvido por</span>
      <img src={prsLogo} alt="PRS" className="h-4 w-auto object-contain" />
    </div>
  );
};

export default PrsCredit;