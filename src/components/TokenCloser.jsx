"use client";

import { useState, useCallback } from "react";
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
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  // =========================
  // 🔥 BURN TOKEN
  // =========================
  const burnToken = async (acc, uiAmountToBurn) => {
    if (!publicKey || uiAmountToBurn <= 0) return;
    if (uiAmountToBurn > acc.uiAmount) return;

    try {
      setStatus("🔥 Burning token...");

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
      scanAccounts();
    } catch (e) {
      console.error(e);
      setStatus("❌ Burn failed");
    }
  };

  // =========================
  // ❌ CLOSE SINGLE ACCOUNT
  // =========================
  const closeSingleAccount = async (acc) => {
    if (!publicKey) return;

    try {
      setStatus("Closing account...");

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
      scanAccounts();
    } catch (e) {
      console.error(e);
      setStatus("❌ Close failed");
    }
  };

  // =========================
  // 🔥 CLOSE ALL EMPTY
  // =========================
  const closeAllEmptyAccounts = async () => {
    const empty = accounts.filter((a) => a.amount === "0");
    if (!empty.length) return;

    try {
      setClosingAll(true);

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

        setStatus(
          `🔥 Closed ${Math.min(i + BATCH_SIZE, empty.length)} / ${empty.length}`
        );
      }

      scanAccounts();
    } catch (e) {
      console.error(e);
      setStatus("❌ Close failed");
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

  {/* ❌ CLEAR BUTTON */}
  {search && (
    <button
      type="button"
      onClick={() => setSearch("")}
      className="
        absolute right-2 top-1/2 -translate-y-1/2
        w-5 h-5
        rounded-full
        flex items-center justify-center
        text-gray-500
        hover:text-black
        hover:bg-gray-200
        transition
      "
    >
      ✕
    </button>
  )}
</div>


          <button
            onClick={scanAccounts}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white"
          >
            {loading ? "Scanning..." : "Scan"}
          </button>

          <button
            onClick={closeAllEmptyAccounts}
            disabled={closingAll}
            className="px-4 py-2 rounded-xl bg-red-600 text-white"
          >
            Close Empty
          </button>
        </div>
      </div>

      {estimatedSol > 0 && (
        <div className="bg-green-50 border px-4 py-2 rounded text-sm">
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
              <tr key={acc.pubkey.toString()} className="border-t ">
                <td className="px-4 py-3 font-mono truncate min-w-[180px] ">
                  {acc.pubkey.toString()}
                </td>
                <td className="px-4 py-3 font-mono truncate min-w-[180px]">
                  {acc.mint.toString()}
                </td>
                <td className="px-4 py-3 text-center min-w-[120px]">
                  {acc.uiAmount}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-ends gap-2 w-full">
                    {acc.uiAmount > 0 && (
                      <BurnInput acc={acc} onBurn={burnToken} />
                    )}

                    <button
                      onClick={() => closeSingleAccount(acc)}
                      disabled={acc.uiAmount > 0}
                      className="
                       px-2 py-1
                        text-[10px] rounded-md
                        bg-red-600 text-white
                        disabled:bg-gray-400 
                      "
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

// =================================
// 🔥 BURN INPUT
// =================================
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
        className="w-[120px] px-2 py-1 border rounded text-left"
      />

      <div className="flex gap-1">
        {[25, 50, 75, 100].map((p) => (
          <button
            key={p}
            onClick={() => setPercent(p)}
            className={`px-2 h-[26px] rounded-full border ${
              selected === p
                ? "bg-black text-white"
                : "bg-white text-black"
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
        className="px-3 h-[28px] rounded-md bg-black text-white disabled:bg-gray-400"
      >
        Burn
      </button>
    </div>
  );
};
