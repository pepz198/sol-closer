import { useWallet } from "@solana/wallet-adapter-react";

const SubNav = ({ activeTab, setActiveTab }) => {
  const { publicKey } = useWallet(); // Cek status wallet

  // Logic untuk mencegah klik jika belum connect
  const handleClick = (tabName) => {
    if (publicKey) {
      setActiveTab(tabName);
    }
  };

  // Base class untuk tombol (style default)
  const baseButtonClass = "px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer";
  
  // Style jika wallet DISCONNECT (Disabled)
  const disabledClass = "opacity-50 cursor-not-allowed text-gray-500";

  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-slate-800 p-1 shadow-lg border border-slate-700">
      
      {/* Tombol Cleaner */}
      <button
        onClick={() => handleClick("cleaner")}
        disabled={!publicKey}
        className={`${baseButtonClass} ${
          !publicKey 
            ? disabledClass 
            : activeTab === "cleaner"
              ? "bg-yellow-300 text-gray-900 shadow-md"
              : "text-gray-400 hover:text-gray-200"
        }`}
      >
        Cleaner
      </button>

      {/* Tombol History */}
      <button
        onClick={() => handleClick("history")}
        disabled={!publicKey}
        className={`${baseButtonClass} ${
          !publicKey 
            ? disabledClass 
            : activeTab === "history"
              ? "bg-yellow-300 text-gray-900 shadow-md"
              : "text-gray-400 hover:text-gray-200"
        }`}
      >
        History
      </button>

    </div>
  );
};

export default SubNav;
