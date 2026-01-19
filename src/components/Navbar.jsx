import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Twitter from "../assets/icons/twitter.svg";
import closerLogo from "../assets/icons/CLOSER.png";

const Navbar = () => {
  return (
    <nav className="flex items-center justify-between rounded-3xl bg-yellow-300 px-8 py-5 shadow-md">
      {/* Left: Brand */}
     <div className="flex items-center gap-3">
        <img
          src={closerLogo}
          alt="Sol Closer Logo"
          className="w-8 h-8"
        />
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
          className="flex items-center gap-2 hover:bg-indigo-700 rounded-lg bg-indigo-600 p-2 text-white font-semibold shadow transition"
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
