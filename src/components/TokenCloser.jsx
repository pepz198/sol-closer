"use client";

import { useState, useCallback, useEffect } from "react"; // 1. Pastikan useEffect diimpor
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

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [closingAll, setClosingAll] = useState(false);
  const [status, setStatus] = useState("");
  const [estimatedSol, setEstimatedSol] = useState(0);
  const [search, setSearch] = useState("");
  
  // State Alert
  const [alert, setAlert] = useState(null);

  // ✅ HELPER: Fungsi Alert
  const showAlert = (message, type = "success", signature = null) => {
    setAlert({ message, type, signature });
    if (type !== "loading") {
      setTimeout(() => {
        setAlert(null);
      }, 10000);
    }
  };

  // ✅ HELPER: Link Solscan
  const getExplorerLink = (sig) => {
    const isDevnet = connection.rpcEndpoint.includes("devnet");
    return `https://solscan.io/tx/${sig}${isDevnet ? "?cluster=devnet" : ""}`;
  };

  // =========================
  // 🔍 SCAN TOKEN ACCOUNTS
  // =========================
  const scanAccounts = useCallback(async () => {
    if (!publicKey) return; // Jika tidak ada wallet, stop

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
            amount: info.tokenAmount.amount,
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

  // ============================================
  // ✅ NEW: AUTO SCAN SAAT WALLET CONNECT
  // ============================================
  useEffect(() => {
    if (publicKey) {
      scanAccounts();
    }
  }, [publicKey, scanAccounts]); 
  // Effect ini akan jalan setiap kali 'publicKey' berubah (misal: user baru connect wallet)

  // =========================
  // 🔥 BURN TOKEN
  // =========================
  const burnToken = async (acc, uiAmountToBurn) => {
    if (!publicKey || uiAmountToBurn <= 0) return;
    if (uiAmountToBurn > acc.uiAmount) return;

    try {
      setStatus("🔥 Burning token...");
      showAlert("Burning token...", "loading");

      const rawAmount = Math.floor(
        uiAmountToBurn * Math.pow(10, acc.decimals)
      );

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
        tx.add(
          createBurnInstruction(
            acc.pubkey,
            acc.mint,
            publicKey,
            rawAmount
          )
        );
      }

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      setStatus("🔥 Burn success");
      showAlert("🔥 Burn successful!", "success", sig);
      scanAccounts();
    } catch (e) {
      console.error(e);
      setStatus("❌ Burn failed");
      showAlert("Burn failed!", "error");
    }
  };

  // =========================
  // ❌ CLOSE SINGLE ACCOUNT
  // =========================
  const closeSingleAccount = async (acc) => {
    if (!publicKey) return;

    try {
      setStatus("Closing account...");
      showAlert("Closing account...", "loading");

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

      setStatus("✅ Account closed");
      showAlert("✅ Account closed successfully!", "success", sig);
      scanAccounts();
    } catch (e) {
      console.error(e);
      setStatus("❌ Close failed");
      showAlert("Failed to close account", "error");
    }
  };

  // =========================
  // 🔥 CLOSE ALL EMPTY (UPDATED)
  // =========================
  const closeAllEmptyAccounts = async () => {
    const empty = accounts.filter((a) => a.amount === "0");
    if (!empty.length) return;

    let lastSignature = null; // 1. Variabel untuk menyimpan signature terakhir

    try {
      setClosingAll(true);
      showAlert(`Closing ${empty.length} accounts...`, "loading");

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

        lastSignature = sig; // 2. Simpan signature

        const closedCount = Math.min(i + BATCH_SIZE, empty.length);
        
        // Update status teks
        setStatus(`🔥 Closed ${closedCount} / ${empty.length}`);

        // 3. Tampilkan alert per batch DENGAN signature (agar muncul link)
        showAlert(`✅ Batch closed (${closedCount}/${empty.length})`, "success", sig);
      }

      // 4. Pesan sukses terakhir juga menggunakan signature terakhir
      showAlert("All empty accounts closed!", "success", lastSignature);
      scanAccounts();
    } catch (e) {
      console.error(e);
      setStatus("❌ Close failed");
      showAlert("Failed to close all accounts", "error");
    } finally {
      setClosingAll(false);
    }
  };

  // =========================
  // 🔍 SEARCH FILTER
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
    return (
      <div className="py-10 text-center text-gray-400">
        🔐 Connect wallet
      </div>
    );
  }

  return (
    <div className="space-y-6 text-black">
      
      {/* ALERT TOAST */}
      {alert && (
        <div className="fixed bottom-0 left-5 z-50 animate-fade-in-up">
          <div
            className={`
              px-4 py-3 rounded-lg shadow-xl text-sm font-medium
              flex items-center gap-3
              transition-all duration-300 transform translate-y-0
              ${alert.type === "success" && "bg-green-600 text-white"}
              ${alert.type === "error" && "bg-red-600 text-white"}
              ${alert.type === "loading" && "bg-black text-white"}
            `}
          >
            <div className="flex items-center gap-2">
              {alert.type === "loading" && "⏳"}
              {alert.type === "success" && "✅"}
              {alert.type === "error" && "❌"}
              <span>{alert.message}</span>
            </div>

            {alert.signature && (
              <a
                href={getExplorerLink(alert.signature)}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  bg-white/20 hover:bg-white/30
                  px-2 py-1 rounded text-xs font-bold
                  uppercase tracking-wider transition
                "
              >
                View TX ↗
              </a>
            )}

            <button
              onClick={() => setAlert(null)}
              className="ml-1 w-6 h-6 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/20 transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-xl font-bold">SPL Token Cleaner</h2>

        <div className="flex items-center gap-2">
          <div className="relative w-[280px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search token / mint / account"
              className="
                w-full
                px-3 pr-8 py-2
                border border-gray-300 rounded-lg
                text-sm
                focus:outline-none focus:ring-2 focus:ring-black
              "
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

          <button
            onClick={scanAccounts}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white cursor-pointer hover:bg-indigo-700 transition"
          >
            {loading ? "Scanning..." : "Scan"}
          </button>

          <button
            onClick={closeAllEmptyAccounts}
            disabled={closingAll}
            className="px-4 py-2 rounded-xl bg-red-600 text-white cursor-pointer hover:bg-red-700 transition"
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
      <div className="border rounded-2xl overflow-hidden bg-white shadow">
        <table className="w-full text-[13px]">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">Token Account</th>
              <th className="px-4 py-3 text-left">Mint</th>
              <th className="px-4 py-3 text-center">Balance</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map((acc) => (
              <tr key={acc.pubkey.toString()} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-mono truncate min-w-[180px] max-w-[200px]" title={acc.pubkey.toString()}>
                  {acc.pubkey.toString().slice(0, 8)}...{acc.pubkey.toString().slice(-8)}
                </td>
                <td className="px-4 py-3 font-mono truncate min-w-[180px] max-w-[200px]" title={acc.mint.toString()}>
                  {acc.mint.toString().slice(0, 8)}...{acc.mint.toString().slice(-8)}
                </td>
                <td className="px-4 py-3 text-center min-w-[120px]">
                  {acc.uiAmount}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2 w-full">
                    {acc.uiAmount > 0 && (
                      <BurnInput acc={acc} onBurn={burnToken} />
                    )}

                    <button
                      onClick={() => closeSingleAccount(acc)}
                      disabled={acc.uiAmount > 0}
                      className="px-2 py-1 cursor-pointer text-[10px] rounded-md bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400 transition"
                    >
                      Close
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!filteredAccounts.length && !loading && (
          <div className="p-6 text-center text-gray-400">
            No matching token
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenCleaner;

// BurnInput component remains the same...
const BurnInput = ({ acc, onBurn }) => {
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState(null);

  const setPercent = (p) => {
    const amount =
      p === 100
        ? acc.uiAmount
        : Number(((acc.uiAmount * p) / 100).toFixed(acc.decimals));

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
        className="w-[80px] px-2 py-1 border rounded text-left focus:outline-none focus:border-black"
      />

      <div className="flex gap-1">
        {[25, 50, 75, 100].map((p) => (
          <button
            key={p}
            onClick={() => setPercent(p)}
            className={`px-2 h-[26px] rounded-full border transition ${
              selected === p
                ? "bg-black text-white"
                : "bg-white text-black hover:bg-gray-100"
            }`}
          >
            {p === 100 ? "MAX" : `${p}%`}
          </button>
        ))}
      </div>

      <button
        disabled={!value || Number(value) <= 0}
        onClick={() => {
          onBurn(acc, Number(value));
          setValue("");
          setSelected(null);
        }}
        className="px-3 h-[28px] rounded-md bg-black text-white disabled:bg-gray-400 cursor-pointer hover:bg-gray-800 transition"
      >
        Burn
      </button>
    </div>
  );
};
