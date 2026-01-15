import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { clearHistory, loadHistory } from "../lib/txHistory";

export default function TransactionHistory() {
  const { publicKey } = useWallet();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        <button
          disabled={!items.length}
          onClick={() => {
            if (!confirm("Clear all transaction history?")) return;
            clearHistory(publicKey.toString());
            setItems([]);
          }}
          className="px-4 py-2 rounded-xl text-sm font-semibold border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Clear History
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1.5 inline-flex gap-1">
        <button
          onClick={() => setFilter("all")}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            filter === "all"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
          }`}
        >
          All ({items.length})
        </button>

        <button
          onClick={() => setFilter("burn")}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            filter === "burn"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
          }`}
        >
          Burn ({burnCount})
        </button>

        <button
          onClick={() => setFilter("close")}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            filter === "close"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
          }`}
        >
          Close ({closeCount})
        </button>
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
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                {/* Left: Type & Details */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Type Badge + Timestamp */}
                  <div className="flex flex-wrap items-center gap-2">
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
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Mint Address */}
                  {tx.mint && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gray-500 font-semibold pt-0.5 whitespace-nowrap">
                        Mint:
                      </span>
                      <span className="text-xs font-mono text-gray-700 break-all">
                        {tx.mint.slice(0, 12)}...{tx.mint.slice(-12)}
                      </span>
                    </div>
                  )}

                  {/* Amount / Count */}
                  {tx.amount != null && (
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold">Amount:</span>{" "}
                      <span className="font-mono">{tx.amount}</span>
                    </div>
                  )}

                  {tx.count != null && (
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold">Closed:</span>{" "}
                      <span className="font-mono">{tx.count} accounts</span>
                    </div>
                  )}

                  {/* Status */}
                  <div className="flex items-center gap-1.5">
                    {tx.status === "success" && (
                      <>
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-xs font-semibold text-green-700">
                          Success
                        </span>
                      </>
                    )}
                    {tx.status === "cancelled" && (
                      <>
                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                        <span className="text-xs font-semibold text-orange-700">
                          Cancelled
                        </span>
                      </>
                    )}
                    {tx.status === "error" && (
                      <>
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-xs font-semibold text-red-700">
                          Failed
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Explorer Link */}
                {tx.signature && (
                  <div className="flex-shrink-0">
                    <a
                      href={`https://solscan.io/tx/${tx.signature}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 border-2 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-all whitespace-nowrap"
                    >
                      View on Solscan
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
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
  );
}
