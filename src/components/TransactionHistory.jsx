import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { clearHistory, loadHistory } from "../lib/txHistory";

export default function TransactionHistory() {
  const { publicKey } = useWallet();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  
  // State untuk mengontrol visibilitas Modal Konfirmasi
  const [showClearModal, setShowClearModal] = useState(false);

  useEffect(() => {
    if (!publicKey) return setItems([]);
    setItems(loadHistory(publicKey.toString()));
  }, [publicKey]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((x) => x.type === filter);
  }, [items, filter]);

  const burnCount = items.filter((x) => x.type === "burn").length;
  const closeCount = items.filter((x) => x.type === "close").length;

  // Fungsi Handler untuk menghapus history
  const handleClearHistory = () => {
    clearHistory(publicKey.toString());
    setItems([]);
    setShowClearModal(false); // Tutup modal setelah hapus
  };

  if (!publicKey) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Wallet Not Connected
          </h2>
          <p className="text-gray-500">
            Please connect your wallet to view transaction history
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 relative">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Transaction History
              <span className="ml-1 text-gray-500 text-sm font-normal">({filtered.length})</span>
            </h2>
            {/* <p> yang lama dihapus saja jika ingin terlihat lebih ringkas */}
          </div>


          <button
            disabled={!items.length}
            // Ubah onClick untuk membuka modal kustom
            onClick={() => setShowClearModal(true)}
            className="px-4 py-2 rounded-xl text-xs   text-red-600 hover:bg-red-50 hover:border-red-300 border disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            // className="px-4 py-2 rounded-xl text-xs bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition"          
          >
            Clear History
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1.5 inline-flex gap-1">
          {/* ... (Tombol Filter Sama Seperti Sebelumnya) ... */}
           {["all", "burn", "close"].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap capitalize ${
                filter === type
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
              }`}
            >
              {type} ({type === 'all' ? items.length : type === 'burn' ? burnCount : closeCount})
            </button>
          ))}
        </div>

        {/* History List */}
        <div className="space-y-3">
          {!filtered.length ? (
            <div className="py-20 text-center">
              <div className="text-6xl mb-4">📜</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                No transactions yet
              </h3>
              <p className="text-sm text-gray-500">
                Your transaction history will appear here
              </p>
            </div>
          ) : (
            filtered.map((tx) => (
              <div
                key={tx.id}
                className="bg-white border-2 border-gray-200 rounded-2xl p-5 hover:border-gray-300 hover:shadow-md transition-all"
              >
               {/* ... (Isi List Item Sama Seperti Sebelumnya) ... */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                       {/* Badge Logic */}
                      {tx.type === "burn" && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
                          🔥 Burn
                        </span>
                      )}
                      {tx.type === "close" && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                          ✕ Close
                        </span>
                      )}
                      <span className="text-xs text-gray-500 font-medium">
                        {new Date(tx.timestamp).toLocaleString("en-US", {
                          month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Transaction Details */}
                    {tx.mint && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 font-semibold pt-0.5 whitespace-nowrap">Mint:</span>
                        <span className="text-xs font-mono text-gray-700 break-all">
                          {tx.mint.slice(0, 12)}...{tx.mint.slice(-12)}
                        </span>
                      </div>
                    )}
                    {tx.amount != null && (
                      <div className="text-sm text-gray-700">
                        <span className="font-semibold">Amount:</span> <span className="font-mono">{tx.amount}</span>
                      </div>
                    )}
                    {tx.count != null && (
                      <div className="text-sm text-gray-700">
                        <span className="font-semibold">Closed:</span> <span className="font-mono">{tx.count} accounts</span>
                      </div>
                    )}

                    {/* Status Indicators */}
                    <div className="flex items-center gap-1.5">
                       {/* ... (Status badges sama seperti sebelumnya) ... */}
                        {tx.status === "success" && (
                          <><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="text-xs font-semibold text-green-700">Success</span></>
                        )}
                         {tx.status === "cancelled" && (
                          <><div className="w-2 h-2 rounded-full bg-orange-500"></div><span className="text-xs font-semibold text-orange-700">Cancelled</span></>
                        )}
                         {tx.status === "error" && (
                          <><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-xs font-semibold text-red-700">Failed</span></>
                        )}
                    </div>
                  </div>

                  {/* Explorer Link */}
                  {tx.signature && (
                    <div className="flex-shrink-0">
                      <a
                        href={`https://solscan.io/tx/${tx.signature}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 border-2 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-all whitespace-nowrap"
                      >
                        View on Solscan
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- MODERN MODAL IMPLEMENTATION --- */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 transform transition-all scale-100 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Icon */}
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>

            {/* Modal Text */}
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-900">Clear Transaction History?</h3>
              <p className="mt-2 text-sm text-gray-500">
                Are you sure you want to delete all transaction history? This action cannot be undone.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="w-full inline-flex justify-center items-center px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                className="w-full inline-flex justify-center items-center px-4 py-2.5 rounded-xl border border-transparent bg-red-600 text-sm font-semibold text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors cursor-pointer"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
