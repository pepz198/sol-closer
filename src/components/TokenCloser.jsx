"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createCloseAccountInstruction,
} from "@solana/spl-token";

const LAMPORTS_PER_SOL = 1_000_000_000;
const BATCH_SIZE = 12;

const TokenCloser = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [closingAll, setClosingAll] = useState(false);
  const [status, setStatus] = useState("");

  const [estimatedSol, setEstimatedSol] = useState(0);
  const [balanceBefore, setBalanceBefore] = useState(0);
  const [balanceAfter, setBalanceAfter] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const toSol = (lamports) => lamports / LAMPORTS_PER_SOL;

  // 🔍 SCAN
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

        return res.value
          .filter(
            (a) =>
              a.account.data.parsed?.info?.tokenAmount?.amount === "0"
          )
          .map((a) => ({
            pubkey: a.pubkey,
            mint: a.account.data.parsed.info.mint,
            programId,
          }));
      };

      const spl = await scan(TOKEN_PROGRAM_ID);
      const t22 = await scan(TOKEN_2022_PROGRAM_ID);
      const empty = [...spl, ...t22];

      setAccounts(empty);

      const rent = await connection.getMinimumBalanceForRentExemption(165);
      setEstimatedSol((rent * empty.length) / LAMPORTS_PER_SOL);

      setStatus(`✅ Found ${empty.length} empty token accounts`);
    } catch (e) {
      console.error(e);
      setStatus("❌ Failed to scan accounts");
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  // 🔥 CLOSE ALL (BATCH)
  const closeAllAccounts = async () => {
    if (!publicKey || accounts.length === 0) return;

    try {
      setClosingAll(true);
      const before = await connection.getBalance(publicKey);
      setBalanceBefore(before);

      for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
        const batch = accounts.slice(i, i + BATCH_SIZE);
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
          `🔥 Closed ${Math.min(i + BATCH_SIZE, accounts.length)} / ${accounts.length}`
        );
      }

      const after = await connection.getBalance(publicKey);
      setBalanceAfter(after);

      setAccounts([]);
      setShowModal(true);
      setStatus("🎉 All empty token accounts closed");
    } catch (e) {
      console.error(e);
      setStatus("❌ Failed while closing accounts");
    } finally {
      setClosingAll(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="text-center text-gray-400 py-10">
        🔐 Connect wallet to scan token accounts
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
            onClick={closeAllAccounts}
            disabled={!accounts.length || closingAll}
            className="px-4 py-2 rounded-xl bg-red-600 text-white"
          >
            {closingAll ? "Closing..." : "Close All"}
          </button>
        </div>
      </div>

      {/* STATUS */}
      {status && (
        <div className="bg-gray-100 px-4 py-2 rounded-lg text-sm">
          {status}
        </div>
      )}

      {/* ESTIMASI */}
      {accounts.length > 0 && (
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
              <th className="px-4 py-3 text-center">Program</th>
            </tr>
          </thead>

          <tbody>
            {accounts.map((acc) => (
              <tr
                key={acc.pubkey.toString()}
                className="border-t hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-mono truncate max-w-[260px]">
                  {acc.pubkey.toString()}
                </td>
                <td className="px-4 py-3 font-mono truncate max-w-[260px]">
                  {acc.mint}
                </td>
                <td className="px-4 py-3 text-center">
                  {acc.programId.equals(TOKEN_2022_PROGRAM_ID)
                    ? "Token-2022"
                    : "SPL"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!accounts.length && !loading && (
          <div className="p-6 text-center text-gray-400">
            No empty token accounts found
          </div>
        )}
      </div>

      {/* MODAL RESULT */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md">
            <h3 className="text-lg font-bold text-center">
              🎉 SOL Reclaimed
            </h3>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Before</span>
                <span className="font-mono">
                  {toSol(balanceBefore).toFixed(6)} SOL
                </span>
              </div>
              <div className="flex justify-between">
                <span>After</span>
                <span className="font-mono">
                  {toSol(balanceAfter).toFixed(6)} SOL
                </span>
              </div>
              <div className="flex justify-between font-semibold text-green-600 border-t pt-2">
                <span>Gained</span>
                <span className="font-mono">
                  +{toSol(balanceAfter - balanceBefore).toFixed(6)} SOL
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="mt-5 w-full py-2 rounded-xl bg-indigo-600 text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        ⚠️ Accounts are closed in batches (12 / transaction) for safety.
      </p>
    </div>
  );
};

export default TokenCloser;
