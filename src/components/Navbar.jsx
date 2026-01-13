import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const Navbar = () => {
  return (
    <nav className="flex items-center justify-between rounded-3xl bg-yellow-300 px-8 py-5 shadow-md">
      <div className="flex items-center gap-3">
        {/* <span className="text-3xl">🧹</span> */}
        <span className="text-2xl font-extrabold text-gray-800">
          Sol Closer
        </span>
      </div>

      <WalletMultiButton className="!rounded-2xl !bg-white !text-gray-800 !font-semibold hover:!bg-gray-100" />
    </nav>
  );
};

export default Navbar;
