"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createCloseAccountInstruction,
  createBurnInstruction,
  createBurnCheckedInstruction,
} from "@solana/spl-token";

/* ================= CONSTANT ================= */
const LAMPORTS_PER_SOL = 1_000_000_000;
const BATCH_SIZE = 12;

/* ================= MAIN ================= */
export default function TokenCleaner() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [accounts, setAccounts] = useState([]);
  const [tokenMap, setTokenMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [closingAll, setClosingAll] = useState(false);
  const [estimatedSol, setEstimatedSol] = useState(0);
  const [search, setSearch] = useState("");
  const [alert, setAlert] = useState(null);

  /* ================= ALERT ================= */
  const showAlert = (type, message, duration = 3000) => {
    setAlert({ type, message });
    if (type !== "loading") {
      setTimeout(() => setAlert(null), duration);
    }
  };

  /* ================= LOAD TOKEN METADATA ================= */
  useEffect(() => {
    fetch(
      "https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json"
    )
      .then((r) => r.json())
      .then((json) => {
        const map = {};
        json.tokens.forEach((t) => {
          map[t.address] = t;
        });
        setTokenMap(map);
      })
      .catch(() => {});
  }, []);

  /* ================= SCAN ================= */
  const scanAccounts = useCallback(async () => {
    if (!publicKey) return;

    try {
      setLoading(true);
      showAlert("loading", "🔍 Scanning token accounts...");

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
      const empty = all.filter((a) => a.amount === "0").length;
      setEstimatedSol((rent * empty) / LAMPORTS_PER_SOL);

      showAlert("success", `✅ Found ${all.length} token accounts`);
    } catch {
      showAlert("error", "❌ Scan failed");
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  /* ================= BURN ================= */
  const burnToken = async (acc, uiAmount) => {
    try {
      showAlert("loading", "🔥 Burning token...");

      const raw = Math.floor(uiAmount * 10 ** acc.decimals);
      const tx = new Transaction();

      if (acc.programId.equals(TOKEN_2022_PROGRAM_ID)) {
        tx.add(
          createBurnCheckedInstruction(
            acc.pubkey,
            acc.mint,
            publicKey,
            raw,
            acc.decimals,
            [],
            TOKEN_2022_PROGRAM_ID
          )
        );
      } else {
        tx.add(createBurnInstruction(acc.pubkey, acc.mint, publicKey, raw));
      }

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      showAlert("success", "🔥 Burn success");
      scanAccounts();
    } catch {
      showAlert("error", "❌ Burn failed");
    }
  };

  /* ================= CLOSE ================= */
  const closeSingleAccount = async (acc) => {
    try {
      showAlert("loading", "Closing account...");
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

      showAlert("success", "✅ Account closed");
      scanAccounts();
    } catch {
      showAlert("error", "❌ Close failed");
    }
  };

  /* ================= CLOSE ALL ================= */
  const closeAllEmptyAccounts = async () => {
    const empty = accounts.filter((a) => a.amount === "0");
    if (!empty.length) return;

    try {
      setClosingAll(true);
      for (let i = 0; i < empty.length; i += BATCH_SIZE) {
        const batch = empty.slice(i, i + BATCH_SIZE);
        const tx = new Transaction();
        batch.forEach((a) =>
          tx.add(
            createCloseAccountInstruction(
              a.pubkey,
              publicKey,
              publicKey,
              [],
              a.programId
            )
          )
        );
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");
      }
      showAlert("success", "🔥 All empty accounts closed");
      scanAccounts();
    } catch {
      showAlert("error", "❌ Close all failed");
    } finally {
      setClosingAll(false);
    }
  };

  /* ================= FILTER ================= */
  const filteredAccounts = useMemo(() => {
    if (!search) return accounts;
    const q = search.toLowerCase();
    return accounts.filter((a) => {
      const meta = tokenMap[a.mint.toString()];
      return (
        a.mint.toString().toLowerCase().includes(q) ||
        a.pubkey.toString().toLowerCase().includes(q) ||
        meta?.symbol?.toLowerCase().includes(q)
      );
    });
  }, [accounts, search, tokenMap]);

  if (!publicKey) {
    return <div className="py-10 text-center text-gray-400">🔐 Connect wallet</div>;
  }

  /* ================= UI ================= */
  return (
    <div className="space-y-6 text-black">

      {/* ALERT */}
      {alert && (
        <div className="fixed top-5 right-5 z-50">
          <div
            className={`px-4 py-3 rounded-lg text-sm shadow text-white
              ${alert.type === "success" && "bg-green-600"}
              ${alert.type === "error" && "bg-red-600"}
              ${alert.type === "loading" && "bg-black"}
            `}
          >
            {alert.message}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">SPL Token Cleaner</h2>

        <div className="flex gap-3 items-center">
          {/* SEARCH */}
          <div className="relative w-[260px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search token / mint"
              className="w-full px-3 pr-8 py-2 border rounded-lg text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={scanAccounts}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl"
          >
            Scan
          </button>

          <button
            onClick={closeAllEmptyAccounts}
            disabled={closingAll}
            className="px-4 py-2 bg-red-600 text-white rounded-xl"
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

      {/* TABLE */}
      <div className="border rounded-2xl overflow-hidden bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Token</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map((acc) => {
              const meta = tokenMap[acc.mint.toString()];
              return (
                <tr key={acc.pubkey.toString()} className="border-t">
                  <td className="px-4 py-3 flex items-center gap-2">
                    {meta?.logoURI && (
                      <img src={meta.logoURI} className="w-5 h-5 rounded-full" />
                    )}
                    <span className="font-semibold">
                      {meta?.symbol || acc.mint.toString().slice(0, 6)}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">{acc.uiAmount}</td>

                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {acc.uiAmount > 0 && (
                        <BurnInput acc={acc} onBurn={burnToken} />
                      )}
                      <button
                        onClick={() => closeSingleAccount(acc)}
                        disabled={acc.uiAmount > 0}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs disabled:bg-gray-300"
                      >
                        Close
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= BURN INPUT ================= */
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
    <div className="flex items-center gap-1 text-[10px]">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSelected(null);
        }}
        className="w-20 px-2 py-1 border rounded text-right"
        placeholder="0"
      />

      {[25, 50, 75, 100].map((p) => (
        <button
          key={p}
          onClick={() => setPercent(p)}
          className={`px-2 py-1 rounded-full border
            ${
              selected === p
                ? "bg-black text-white"
                : "bg-white text-black"
            }`}
        >
          {p === 100 ? "MAX" : `${p}%`}
        </button>
      ))}

      <button
        onClick={() => {
          onBurn(acc, Number(value));
          setValue("");
          setSelected(null);
        }}
        disabled={!value}
        className="px-3 py-1 bg-black text-white rounded"
      >
        Burn
      </button>
    </div>
  );
};
