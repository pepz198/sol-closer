import { useMemo, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

import Navbar from "./components/Navbar";
import SubNav from "./components/SubNav";
import TokenCloser from "./components/TokenCloser";
import History from "./pages/History";

import "@solana/wallet-adapter-react-ui/styles.css";

// --- Komponen Internal untuk Konten ---
const MainContent = () => {
  const { publicKey } = useWallet();
  // State untuk mengatur tab yang aktif ("cleaner" atau "history")
  const [activeTab, setActiveTab] = useState("cleaner");

  return (
    <div className="min-h-screen min-w-screen bg-amber-50">
      {/* 1. Navbar Utama */}
      <div className="px-6 pt-6">
        <Navbar />
      </div>

      {/* 2. Sub Navigation */}
      {/* Kita kirim props activeTab dan function setActiveTab */}
      <div className="px-6 text-center mt-4">
        <SubNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* 3. Main Content Area */}
      <main className="mx-auto px-6 py-6">
        {/* LOGIC:
            - Jika BELUM connect: Tampilkan pesan "Connect wallet"
            - Jika SUDAH connect: Cek activeTab, tampilkan TokenCloser atau History
        */}
        {!publicKey ? (
          <div className="py-20 text-center">
             <div className="text-4xl mb-3">🔐</div>
             <h3 className="text-gray-500 font-medium">Connect wallet to start</h3>
          </div>
        ) : (
          <>
            {activeTab === "cleaner" && <TokenCloser />}
            {activeTab === "history" && <History />}
          </>
        )}
      </main>
    </div>
  );
};

// --- Komponen Utama App ---
function App() {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = "https://mainnet.helius-rpc.com/?api-key=aed56c65-f40e-43af-9c66-c12ceb93f601";

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {/* BrowserRouter tetap ada untuk membungkus jika Navbar butuh Link */}
          <BrowserRouter>
           <MainContent />
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;