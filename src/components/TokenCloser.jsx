"use client";

import { useState, useCallback, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createCloseAccountInstruction,
  createBurnInstruction,
  createBurnCheckedInstruction,
} from "@solana/spl-token";

const LAMPORTS_PER_SOL = 1_000_000_000;
const BATCH_SIZE = 12;

const TokenCleaner = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  // Main state
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [closingAll, setClosingAll] = useState(false);
  const [status, setStatus] = useState("");
  const [estimatedSol, setEstimatedSol] = useState(0);
  const [search, setSearch] = useState("");

  // Alerts stack
  const [alerts, setAlerts] = useState([]);

  // =========================
  // 🔔 ALERT HELPERS
  // =========================
  const removeAlert = (id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const showAlert = (message, type = "success", signature = null) => {
    const id = Date.now() + Math.random();
    const newAlert = { id, message, type, signature };

    setAlerts((prev) => [...prev, newAlert]);

    if (type !== "loading") {
      setTimeout(() => removeAlert(id), 5000);
    }
    return id;
  };

  // Always: remove loading toast first, then show next toast (avoid “double toast” feel)
  const replaceLoadingWith = (loadingId, next) => {
    if (loadingId) removeAlert(loadingId);
    setTimeout(() => {
      if (next) showAlert(next.message, next.type, next.signature ?? null);
    }, 0);
  };

  const getExplorerLink = (sig) => {
    const isDevnet = connection.rpcEndpoint.includes("devnet");
    return `https://solscan.io/tx/${sig}${isDevnet ? "?cluster=devnet" : ""}`;
  };

  const isUserReject = (err) => {
    const code = err?.code;
    const msg = (err?.message || "").toLowerCase();
    return (
      code === 4001 ||
      msg.includes("user rejected") ||
      msg.includes("user denied") ||
      msg.includes("user canceled") ||
      msg.includes("user cancelled") ||
      msg.includes("rejected the request") ||
      msg.includes("0x0")
    );
  };

  // =========================
  // 🔍 SCAN TOKEN ACCOUNTS
  // =========================
  const scanAccounts = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    setStatus("🔍 Scanning token accounts...");

    try {
      const scan = async (programId) => {
        const res = await connection.getParsedTokenAccountsByOwner(
          publicKey,
          { programId },
          "confirmed"
        );

        return res.value.map((a) => {
          const info = a.account.data.parsed.info;
          return {
            pubkey: a.pubkey,
            mint: new PublicKey(info.mint),
            amount: info.tokenAmount.amount, // string
            uiAmount: info.tokenAmount.uiAmount || 0,
            decimals: info.tokenAmount.decimals,
            programId,
          };
        });
      };

      const spl = await scan(TOKEN_PROGRAM_ID);
      const t22 = await scan(TOKEN_2022_PROGRAM_ID);
      const all = [...spl, ...t22];

      setAccounts(all);

      const rent = await connection.getMinimumBalanceForRentExemption(165);
      const emptyCount = all.filter((a) => a.amount === "0").length;
      setEstimatedSol((rent * emptyCount) / LAMPORTS_PER_SOL);

      setStatus(`✅ Found ${all.length} token accounts`);
    } catch (e) {
      console.error(e);
      setStatus("❌ Scan failed");
      showAlert("Scan failed, check console", "error");
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    if (publicKey) scanAccounts();
  }, [publicKey, scanAccounts]);

  // =========================
  // 🔥 BURN TOKEN
  // =========================
  const burnToken = async (acc, uiAmountToBurn) => {
    if (!publicKey || uiAmountToBurn <= 0) return;
    if (uiAmountToBurn > acc.uiAmount) return;

    let loadingId = null;

    try {
      setStatus("🔥 Burning token...");
      loadingId = showAlert("Burning token...", "loading");

      const rawAmount = Math.floor(uiAmountToBurn * Math.pow(10, acc.decimals));
      const tx = new Transaction();

      if (acc.programId.equals(TOKEN_2022_PROGRAM_ID)) {
        tx.add(
          createBurnCheckedInstruction(
            acc.pubkey,
            acc.mint,
            publicKey,
            rawAmount,
            acc.decimals,
            [],
            TOKEN_2022_PROGRAM_ID
          )
        );
      } else {
        tx.add(createBurnInstruction(acc.pubkey, acc.mint, publicKey, rawAmount));
      }

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      replaceLoadingWith(loadingId, {
        type: "success",
        message: "Burn successful!",
        signature: sig,
      });

      setStatus("✅ Burn success");
      scanAccounts();
    } catch (e) {
      console.error(e);

      if (isUserReject(e)) {
        setStatus("⚠️ Transaction cancelled");
        replaceLoadingWith(loadingId, { type: "error", message: "Transaction cancelled" });
        return;
      }

      setStatus("❌ Burn failed");
      replaceLoadingWith(loadingId, { type: "error", message: "Burn failed!" });
    }
  };

  // =========================
  // ❌ CLOSE SINGLE ACCOUNT
  // =========================
  const closeSingleAccount = async (acc) => {
    if (!publicKey) return;

    let loadingId = null;

    try {
      setStatus("Closing account...");
      loadingId = showAlert("Closing account...", "loading");

      const tx = new Transaction().add(
        createCloseAccountInstruction(
          acc.pubkey,
          publicKey,
          publicKey,
          [],
          acc.programId
        )
      );

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      replaceLoadingWith(loadingId, {
        type: "success",
        message: "Account closed successfully!",
        signature: sig,
      });

      setStatus("✅ Account closed");
      scanAccounts();
    } catch (e) {
      console.error(e);

      if (isUserReject(e)) {
        setStatus("⚠️ Transaction cancelled");
        replaceLoadingWith(loadingId, { type: "error", message: "Transaction cancelled" });
        return;
      }

      setStatus("❌ Close failed");
      replaceLoadingWith(loadingId, { type: "error", message: "Failed to close account" });
    }
  };

  // =========================
  // 🔥 CLOSE ALL EMPTY (BATCH)
  // =========================
  const closeAllEmptyAccounts = async () => {
    const empty = accounts.filter((a) => a.amount === "0");
    if (!empty.length) return;

    let lastSignature = null;
    let loadingId = null;

    try {
      setClosingAll(true);
      loadingId = showAlert(`Closing ${empty.length} accounts...`, "loading");

      for (let i = 0; i < empty.length; i += BATCH_SIZE) {
        const batch = empty.slice(i, i + BATCH_SIZE);
        const tx = new Transaction();

        batch.forEach((acc) => {
          tx.add(
            createCloseAccountInstruction(
              acc.pubkey,
              publicKey,
              publicKey,
              [],
              acc.programId
            )
          );
        });

        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");
        lastSignature = sig;

        const closedCount = Math.min(i + BATCH_SIZE, empty.length);
        setStatus(`🔥 Closed ${closedCount} / ${empty.length}`);

        // per-batch toast (stacking)
        showAlert(`Batch closed (${closedCount}/${empty.length})`, "success", sig);
      }

      replaceLoadingWith(loadingId, {
        type: "success",
        message: "All empty accounts closed!",
        signature: lastSignature,
      });

      scanAccounts();
    } catch (e) {
      console.error(e);

      if (isUserReject(e)) {
        setStatus("⚠️ Transaction cancelled");
        replaceLoadingWith(loadingId, { type: "error", message: "Transaction cancelled" });
        return;
      }

      setStatus("❌ Close failed");
      replaceLoadingWith(loadingId, { type: "error", message: "Failed to close all accounts" });
    } finally {
      setClosingAll(false);
    }
  };

  // =========================
  // 🔍 FILTER
  // =========================
  const filteredAccounts = accounts.filter((acc) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      acc.mint.toString().toLowerCase().includes(q) ||
      acc.pubkey.toString().toLowerCase().includes(q)
    );
  });

  if (!publicKey) {
    return <div className="py-10 text-center text-gray-400">🔐 Connect wallet to start</div>;
  }

  return (
    <div className="space-y-6 text-black relative">
      {/* ALERTS (STACKING) */}
      <div className="fixed bottom-0 right-5 z-50 flex flex-col gap-2 pointer-events-none pb-5">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`
              pointer-events-auto
              px-4 py-3 rounded-lg shadow-xl text-sm font-medium
              flex items-center justify-between gap-4 min-w-[300px]
              animate-fade-in-up transition-all duration-300
              ${alert.type === "success" && "bg-green-600 text-white"}
              ${alert.type === "error" && "bg-red-600 text-white"}
              ${alert.type === "warning" && "bg-orange-500 text-white"}
              ${alert.type === "loading" && "bg-black text-white"}
            `}
          >
            <div className="flex items-center gap-2">
              {alert.type === "loading" }
              {alert.type === "success" }
              {alert.type === "error" }
               {alert.type === "warning"}
              <span>{alert.message}</span>
            </div>

            <div className="flex items-center gap-2">
              {alert.signature && (
                <a
                  href={getExplorerLink(alert.signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-xs font-bold uppercase whitespace-nowrap transition"
                >
                  ↗
                </a>
              )}
              <button
                onClick={() => removeAlert(alert.id)}
                className="w-6 h-6 flex items-center justify-center rounded-full text-white/80 hover:bg-white/20 transition"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-xl font-bold">SPL Token Cleaner</h2>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative w-[280px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search token / mint..."
              className="w-full px-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-gray-500 hover:text-black hover:bg-gray-200 transition"
              >
                ✕
              </button>
            )}
          </div>

          {/* Scan */}
          <button
            onClick={scanAccounts}
            disabled={loading}
            className={`
              min-w-[100px] px-4 py-2 h-[40px] rounded-xl text-white font-medium
              flex items-center justify-center gap-2 transition-all
              ${loading ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl"}
            `}
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              "Refresh"
            )}
          </button>

          {/* Close Empty */}
          <button
            onClick={closeAllEmptyAccounts}
            disabled={closingAll}
            className="px-4 py-2 h-[40px] rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition"
          >
            Close Empty
          </button>
        </div>
      </div>

      {estimatedSol > 0 && (
        <div className="bg-green-50 border border-green-200 px-4 py-2 rounded text-sm text-green-800">
          💰 Estimated reclaim: <b>{estimatedSol.toFixed(6)} SOL</b>
        </div>
      )}

      {status && <div className="text-sm text-gray-600">{status}</div>}

      {/* TABLE */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-black/5">
        <table className="min-w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-[40%] px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Mint Address
              </th>
              <th className="w-[20%] px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Balance
              </th>
              <th className="w-[40%] px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>

                   <tbody className="divide-y divide-gray-100 bg-white">
            {loading ? (
              // 🔄 SINGLE CENTERED SPINNER
              <tr>
                <td colSpan="3" className="px-6 py-16">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <svg 
                      className="animate-spin h-10 w-10 text-indigo-600" 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24"
                    >
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4"
                      ></circle>
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <p className="text-sm text-gray-500 font-medium">Loading tokens...</p>
                  </div>
                </td>
              </tr>
            ) : (

              filteredAccounts.map((acc) => (
                <tr key={acc.pubkey.toString()} className="group transition-colors duration-200 hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm text-gray-700 font-medium truncate " title={acc.mint.toString()}>
                        {acc.mint.toString()}
                      </span>
                      <CopyButton text={acc.mint.toString()} />
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`
                        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${acc.uiAmount > 0 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
                      `}
                    >
                      {acc.uiAmount}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end items-center gap-3 w-full">
                      {acc.uiAmount > 0 && (
                        <div className="scale-95 origin-right">
                          <BurnInput acc={acc} onBurn={burnToken} />
                        </div>
                      )}

                      <button
                        onClick={() => closeSingleAccount(acc)}
                        disabled={acc.uiAmount > 0}
                        className={`
                          px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm border transition-all
                          ${acc.uiAmount > 0
                            ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                            : "bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 active:scale-95"}
                        `}
                      >
                        Close
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!filteredAccounts.length && !loading && (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto h-12 w-12 text-gray-300 mb-3 text-4xl">🍃</div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No tokens found</h3>
            <p className="mt-1 text-sm text-gray-500">Your wallet is clean or no matching results.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenCleaner;

// =========================
// 🔥 BurnInput
// =========================
const BurnInput = ({ acc, onBurn }) => {
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState(null);

  const setPercent = (p) => {
    const amount =
      p === 100 ? acc.uiAmount : Number(((acc.uiAmount * p) / 100).toFixed(acc.decimals));
    setValue(amount.toString());
    setSelected(p);
  };

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <input
        type="number"
        min="0"
        max={acc.uiAmount}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSelected(null);
        }}
        placeholder="Amount"
        className="w-[90px] px-2 py-1.5 border rounded text-left focus:outline-none focus:border-black"
      />

      <div className="flex gap-1">
        {[25, 50, 75, 100].map((p) => (
          <button
            key={p}
            onClick={() => setPercent(p)}
            type="button"
            className={`px-1.5 h-[28px] min-w-[34px] rounded border transition ${
              selected === p ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
            }`}
          >
            {p === 100 ? "Max" : `${p}%`}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!value || Number(value) <= 0}
        onClick={() => {
          onBurn(acc, Number(value));
          setValue("");
          setSelected(null);
        }}
        className="px-3 h-[28px] rounded bg-black text-white disabled:bg-gray-400 hover:bg-gray-800 transition"
      >
        Burn
      </button>
    </div>
  );
};

// =========================
// 📋 CopyButton
// =========================
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy Mint Address"
      className={`
        p-1 rounded-md transition-all duration-200 flex-shrink-0 cursor-pointer
        ${copied ? "bg-green-100 text-green-600" : "text-gray-400 hover:bg-gray-100 hover:text-gray-800"}
      `}
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
};
