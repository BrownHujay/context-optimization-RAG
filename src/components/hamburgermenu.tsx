import { useState } from 'react';

interface HamburgerMenuProps {
  item: boolean;
}

const HamburgerMenu = ({ item }: HamburgerMenuProps) => {
  const [isOpen, setIsOpen] = useState(item);

  return (
    <button 
      onClick={() => setIsOpen(true)}
      className="relative w-10 h-10 flex items-center justify-center focus:outline-none"
    >
      <div className="relative w-8 h-8">
        {/* Top bar */}
        <span
          className={`absolute left-1/2 -translate-x-1/2 block h-0.5 w-6 bg-white transform transition duration-300 ease-in-out 
            ${isOpen ? "rotate-45 top-3" : "top-1"}`}
        ></span>
        {/* Middle bar */}
        <span
          className={`absolute left-1/2 -translate-x-1/2 block h-0.5 w-6 bg-white top-3 transition-opacity duration-150 ease-in-out 
            ${isOpen ? "opacity-0" : "opacity-100"}`}
        ></span>
        {/* Bottom bar */}
        <span
          className={`absolute left-1/2 -translate-x-1/2 block h-0.5 w-6 bg-white transform transition duration-300 ease-in-out 
            ${isOpen ? "-rotate-45 top-3" : "top-5"}`}
        ></span>
      </div>
    </button>
  );
};

export default HamburgerMenu;
