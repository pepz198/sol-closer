"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createCloseAccountInstruction,
  createBurnInstruction,
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

  const toSol = (lamports) => lamports / LAMPORTS_PER_SOL;

  // 🔍 SCAN TOKEN ACCOUNTS (NON-ZERO + ZERO)
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
            mint: info.mint,
            amount: info.tokenAmount.amount, // raw
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

      // estimasi SOL reclaim (hanya akun kosong)
      const rent = await connection.getMinimumBalanceForRentExemption(165);
      const emptyCount = all.filter((a) => a.amount === "0").length;
      setEstimatedSol((rent * emptyCount) / LAMPORTS_PER_SOL);

      setStatus(`✅ Found ${all.length} token accounts`);
    } catch (e) {
      console.error(e);
      setStatus("❌ Failed to scan accounts");
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  // 🔥 BURN TOKEN (CUSTOM AMOUNT)
  const burnToken = async (acc, uiAmountToBurn) => {
    if (!publicKey || uiAmountToBurn <= 0) return;

    try {
      const rawAmount = BigInt(
        Math.floor(uiAmountToBurn * 10 ** acc.decimals)
      );

      const tx = new Transaction().add(
        createBurnInstruction(
          acc.pubkey,     // token account
          acc.mint,       // mint
          publicKey,      // owner
          rawAmount,
          [],
          acc.programId
        )
      );

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      setStatus(`🔥 Burned ${uiAmountToBurn} tokens`);
      scanAccounts();
    } catch (e) {
      console.error(e);
      setStatus("❌ Burn failed");
    }
  };

  // 🔥 CLOSE ALL EMPTY ACCOUNTS (BATCH)
  const closeAllEmptyAccounts = async () => {
    const emptyAccounts = accounts.filter((a) => a.amount === "0");
    if (!emptyAccounts.length) return;

    try {
      setClosingAll(true);

      for (let i = 0; i < emptyAccounts.length; i += BATCH_SIZE) {
        const batch = emptyAccounts.slice(i, i + BATCH_SIZE);
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
          `🔥 Closed ${Math.min(i + BATCH_SIZE, emptyAccounts.length)} / ${emptyAccounts.length}`
        );
      }

      scanAccounts();
    } catch (e) {
      console.error(e);
      setStatus("❌ Failed closing accounts");
    } finally {
      setClosingAll(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="text-center text-gray-400 py-10">
        🔐 Connect wallet
      </div>
    );
  }

  return (
    <div className="space-y-6 text-black">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">SPL Token Cleaner</h2>

        <div className="flex gap-3">
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

      {/* ESTIMASI */}
      {estimatedSol > 0 && (
        <div className="bg-green-50 border border-green-200 px-4 py-3 rounded-lg text-sm">
          💰 Estimated SOL reclaim:{" "}
          <strong>{estimatedSol.toFixed(6)} SOL</strong>
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-hidden border rounded-2xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">Token Account</th>
              <th className="px-4 py-3 text-left">Mint</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3 text-center">Burn</th>
            </tr>
          </thead>

          <tbody>
            {accounts.map((acc) => (
              <tr
                key={acc.pubkey.toString()}
                className="border-t hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-mono truncate max-w-[220px]">
                  {acc.pubkey.toString()}
                </td>

                <td className="px-4 py-3 font-mono truncate max-w-[220px]">
                  {acc.mint}
                </td>

                <td className="px-4 py-3 text-right">
                  {acc.uiAmount}
                </td>

                <td className="px-4 py-3 text-center">
                  {acc.uiAmount > 0 && (
                    <BurnInput acc={acc} onBurn={burnToken} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!accounts.length && !loading && (
          <div className="p-6 text-center text-gray-400">
            No token accounts found
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        ⚠️ Burn reduces supply. This action is irreversible.
      </p>
    </div>
  );
};

export default TokenCleaner;

/* 🔥 BURN INPUT COMPONENT */
const BurnInput = ({ acc, onBurn }) => {
  const [value, setValue] = useState("");

  return (
    <div className="flex items-center gap-1 justify-center">
      {/* INPUT */}
      <input
        type="number"
        min="0"
        step="any"
        max={acc.uiAmount}
        placeholder="Amount"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 px-2 py-2 border rounded text-xs text-right"
      />

      {/* MAX BUTTON */}
      <button
        type="button"
        onClick={() => setValue(acc.uiAmount)}
        className="px-2 py-1 rounded bg-orange-500 text-white text-xs hover:bg-orange-600 disabled:bg-orange-300"
      >
        100%
      </button>

      {/* BURN BUTTON */}
      <button
        type="button"
        disabled={!value || Number(value) <= 0}
        onClick={() => {
          onBurn(acc, Number(value));
          setValue("");
        }}
        className="px-2 py-1 rounded bg-orange-500 text-white text-xs hover:bg-orange-600 disabled:bg-orange-300"
      >
        Burn
      </button>
    </div>
  );
};
