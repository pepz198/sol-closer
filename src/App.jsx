import { useMemo } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

import Navbar from "./components/Navbar";
import SubNav from "./components/SubNav";  // 👈 IMPORT BARU
import TokenCloser from "./components/TokenCloser";
import History from "./pages/History";

import "@solana/wallet-adapter-react-ui/styles.css";

function App() {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint =
    "https://mainnet.helius-rpc.com/?api-key=aed56c65-f40e-43af-9c66-c12ceb93f601";

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <BrowserRouter>
            <div className="min-h-screen min-w-screen bg-amber-50">
              {/* Navbar Utama */}
              <div className="px-6 pt-6">
                <Navbar />
              </div>

              {/* Sub Navigation */}
              <div className="px-6 text-center mt-4">
                <SubNav />
              </div>

              {/* Content */}
              <main className="mx-auto px-6 py-6">
                <Routes>
                  <Route path="/" element={<TokenCloser />} />
                  <Route path="/history" element={<History />} />
                </Routes>
              </main>
            </div>
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
