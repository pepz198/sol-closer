import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Twitter from "../assets/icons/twitter.svg"

const Navbar = () => {
  return (
    <nav className="flex items-center justify-between rounded-3xl bg-yellow-300 px-8 py-5 shadow-md">
      {/* Left: Brand */}
      <div className="flex items-center gap-3">
        <span className="text-2xl font-extrabold text-gray-800">
          Sol Closer
        </span>
      </div>

      {/* Right: Twitter + Wallet */}
      <div className="flex items-center gap-3">
        <a
          href="https://x.com/pepz198"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 hover:bg-indigo-700 rounded bg-indigo-600 p-2 text-gray-800 font-semibold shadow hover:bg-gray-100 transition"
        >
          <img
            src={Twitter}
            alt="Twitter"
            className="h-6 w-6 brightness-0 invert"
          />
        </a>

        <WalletMultiButton className="!rounded-2xl !bg-white !text-gray-800 !font-semibold hover:!bg-gray-100" />
      </div>
    </nav>
  );
};

export default Navbar;
