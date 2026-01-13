import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createCloseAccountInstruction,
} from "@solana/spl-token";





const TokenCloser = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [closingAll, setClosingAll] = useState(false);

const [showModal, setShowModal] = useState(false);
const [balanceBefore, setBalanceBefore] = useState(0);
const [balanceAfter, setBalanceAfter] = useState(0);
const toSol = (lamports) => lamports / 1_000_000_000;

  const scanAccounts = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    setStatus("Scanning token accounts...");

    try {
      const res = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });

      const empty = res.value
        .filter(
          (a) => a.account.data.parsed.info.tokenAmount.uiAmount === 0
        )
        .map((a) => ({
          pubkey: a.pubkey,
          mint: a.account.data.parsed.info.mint,
        }));

      setAccounts(empty);
      setStatus(`Found ${empty.length} empty token accounts`);
    } catch (e) {
      console.error(e);
      setStatus("Failed to scan accounts");
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  const closeAccount = async (pubkey) => {
    try {
      setStatus("Sending transaction...");

      const tx = new Transaction().add(
        createCloseAccountInstruction(pubkey, publicKey, publicKey)
      );

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "processed");

      setStatus("Account closed successfully");
      scanAccounts();
    } catch (e) {
      console.error(e);
      setStatus("Transaction cancelled or failed");
    }
  };

  if (!publicKey) {
    return (
      <div className="text-center text-gray-500 py-10">
        🔐 Connect wallet to view token accounts
      </div>
    );
  }

const closeAllAccounts = async () => {
  if (!publicKey || accounts.length === 0) return;

  try {
    setClosingAll(true);
    setStatus("Closing all empty token accounts...");

    // 🔹 Balance sebelum
    const before = await connection.getBalance(publicKey);
    setBalanceBefore(before);

    const tx = new Transaction();

    accounts.forEach((acc) => {
      tx.add(
        createCloseAccountInstruction(
          acc.pubkey,
          publicKey,
          publicKey
        )
      );
    });

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "processed");

    // 🔹 Balance sesudah
    const after = await connection.getBalance(publicKey);
    setBalanceAfter(after);

    setAccounts([]);
    setStatus("✅ All empty accounts closed");

    // 🔥 TAMPILKAN MODAL
    setShowModal(true);
  } catch (e) {
    console.error(e);
    setStatus("❌ Failed to close all accounts");
  } finally {
    setClosingAll(false);
  }
};


  return (
    <div className="space-y-6">
      {/* Header */}
     <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
  <h2 className="text-xl font-bold text-gray-800">
    SPL Token Accounts
  </h2>

  <div className="flex gap-3">
    <button
      onClick={scanAccounts}
      disabled={loading}
      className="rounded-xl bg-indigo-600 px-5 py-2 text-white font-semibold hover:bg-indigo-700 disabled:bg-gray-400"
    >
      {loading ? "Scanning..." : "Refresh"}
    </button>

    <button
      onClick={closeAllAccounts}
      disabled={accounts.length === 0 || closingAll}
      className="rounded-xl bg-red-600 px-5 py-2 text-white font-semibold hover:bg-red-700 disabled:bg-red-300"
    >
      {closingAll ? "Closing..." : "Close All"}
    </button>
  </div>
</div>


      {/* Status */}
      {status && (
        <div className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700">
          {status}
        </div>
      )}

      {/* TABLE – DESKTOP */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">Token Account</th>
              <th className="px-4 py-3 text-left">Mint</th>
              <th className="px-4 py-3 text-center">Balance</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc) => (
              <tr
                key={acc.pubkey.toString()}
                className="border-t hover:bg-gray-50 text-black"
              >
                <td className="px-4 py-3 font-mono truncate max-w-[200px]">
                  {acc.pubkey.toString()}
                </td>
                <td className="px-4 py-3 font-mono truncate max-w-[200px]">
                  {acc.mint}
                </td>
                <td className="px-4 py-3 text-center text-green-600 font-semibold">
                  0
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => closeAccount(acc.pubkey)}
                    className="rounded-lg bg-red-500 px-4 py-1.5 text-white hover:bg-red-600"
                  >
                    Close
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {accounts.length === 0 && !loading && (
          <div className="p-6 text-center text-gray-400">
            No empty token accounts
          </div>
        )}
      </div>

      {/* MOBILE – CARD */}
      <div className="space-y-4 md:hidden">
        {accounts.map((acc) => (
          <div
            key={acc.pubkey.toString()}
            className="rounded-2xl border bg-white p-4 shadow"
          >
            <div className="text-xs text-gray-500">Token Account</div>
            <div className="font-mono text-sm truncate">
              {acc.pubkey.toString()}
            </div>

            <div className="mt-2 text-xs text-gray-500">Mint</div>
            <div className="font-mono text-sm truncate">{acc.mint}</div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-green-600 font-semibold">Balance: 0</span>
              <button
                onClick={() => closeAccount(acc.pubkey)}
                className="rounded-lg bg-red-500 px-4 py-2 text-white"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>

{showModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-fade-in">
      
      <h3 className="text-lg font-bold text-gray-800 text-center">
        🎉 Balance Updated
      </h3>

      <div className="mt-6 space-y-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Balance Before</span>
          <span className="font-mono">
            {toSol(balanceBefore).toFixed(6)} SOL
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-500">Balance After</span>
          <span className="font-mono">
            {toSol(balanceAfter).toFixed(6)} SOL
          </span>
        </div>

        <div className="flex justify-between border-t pt-3">
          <span className="font-semibold text-green-600">
            SOL Gained
          </span>
          <span className="font-mono font-semibold text-green-600">
            +{toSol(balanceAfter - balanceBefore).toFixed(6)} SOL
          </span>
        </div>
      </div>

      <button
         onClick={() => {
    setShowModal(false);
    setBalanceBefore(0);
    setBalanceAfter(0);
    setStatus("");
  }}
        className="mt-6 w-full rounded-xl bg-indigo-600 py-2 text-white font-semibold hover:bg-indigo-700"
      >
        Close
      </button>
    </div>
  </div>
)}


      {/* Footer info */}
      <p className="text-center text-xs text-gray-400">
        ⚠️ Only empty token accounts (balance = 0) can be closed.  
        No tokens, NFTs, or SOL transfers.
      </p>
    </div>
  );
};

export default TokenCloser;
