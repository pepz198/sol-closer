import { NavLink } from "react-router-dom";

const SubNav = () => {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-slate-800 p-1 shadow-lg border border-slate-700">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
            isActive
              ? "bg-yellow-300 text-gray-900 shadow-md"
              : "text-gray-400 hover:text-gray-200"
          }`
        }
      >
        Cleaner
      </NavLink>

      <NavLink
        to="/history"
        className={({ isActive }) =>
          `px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
            isActive
              ? "bg-yellow-300 text-gray-900 shadow-md"
              : "text-gray-400 hover:text-gray-200"
          }`
        }
      >
        History
      </NavLink>
    </div>
  );
};

export default SubNav;
