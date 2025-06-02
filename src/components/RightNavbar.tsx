import { useRef, useState } from "react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import {useNavigate} from "react-router-dom";
import HamburgerMenu from "./hamburgerMenu";

export default function Navbar({ onStateChange }: { onStateChange?: (isOpen: boolean) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    setIsOpen(true);
    onStateChange?.(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    onStateChange?.(false);
  };


  return (
    <div className="relative text-right">
      {isOpen ? (
        <div className="flex flex-col h-full z-50 py-10">
          <div
            className="top-0 left-0 flex flex-col items-end w-full"
            onMouseLeave={() => handleClose()}
          >
            <div className="absolute top-0 right-0">
              <HamburgerMenu item={true} />
            </div>
            <SlideTabs />
          </div>
        </div>
      ) : (
        <div onClick={handleOpen}>
          <HamburgerMenu item={false} />
        </div>
      )}
    </div>
  );
}

type PositionType = {
  top: number;
  height: number;
  opacity: number;
};

const SlideTabs = () => {
  const [position, setPosition] = useState<PositionType>({
    top: 0,
    height: 0,
    opacity: 0,
  });

  const [isHovered, setIsHovered] = useState(false); // Track if any Tab is hovered

  return (
    <ul
      onMouseLeave={() => {
        setPosition((pv) => ({
          ...pv,
          opacity: 0, // Reset opacity when mouse leaves the area
        }));
        setIsHovered(false); // Reset hover state when mouse leaves
      }}
      className="relative flex flex-col w-full text-right p-1"
    >
      <Tab setPosition={setPosition} setIsHovered={setIsHovered} r={"/"}>Home</Tab>
      <Tab setPosition={setPosition} setIsHovered={setIsHovered} r={"/"}>Chats</Tab>
      <Tab setPosition={setPosition} setIsHovered={setIsHovered} r={"/"}>Your Data</Tab>
      <Tab setPosition={setPosition} setIsHovered={setIsHovered} r={"/"}>Account</Tab>
      <Tab setPosition={setPosition} setIsHovered={setIsHovered} r={"/"}>Settings</Tab>

      {/* Render Cursor only when a Tab is hovered */}
      {isHovered && <Cursor position={position} />}
    </ul>
  );
};

interface TabProps {
  children: ReactNode;
  setPosition: (pos: PositionType | ((prev: PositionType) => PositionType)) => void;
  setIsHovered: (state: boolean) => void; // New prop to track hover state
  r: string
};

const Tab = ({ children, setPosition, setIsHovered, r }: TabProps) => {
  const ref = useRef<HTMLLIElement | null>(null);

  let navigate = useNavigate(); 
  const routeChange = (route: string) =>{ 
    let path = route; 
    navigate(path);
  }

  return (
    <li
      ref={ref}
      onMouseEnter={() => {
        if (!ref.current) return;

        const { height } = ref.current.getBoundingClientRect();
        
        // Immediately set hovered state before updating position
        setIsHovered(true);
        
        // Update position without delay
        setPosition({
          top: ref.current.offsetTop,
          height,
          opacity: 1,
        });
      }}
      onMouseLeave={() => {
        // First immediately set hover state to false
        setIsHovered(false);
        
        // Then update position without delay
        setPosition((pv) => ({
          ...pv,
          opacity: 0,
        }));
      }}
      className="relative z-10 block cursor-pointer px-3 py-1.5 text-xs uppercase text-[var(--text-primary)] hover:text-[var(--theme-color)] transition-colors md:px-5 md:py-3 md:text-base"
      onClick={() => routeChange(r)}
    >
      {children}
    </li>
  );
};

type CursorProps = {
  position: PositionType;
};

const Cursor = ({ position }: CursorProps) => {
  return (
    <motion.li
      animate={position}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 30,
        mass: 0.5
      }}
      className="absolute z-0 w-full h-7 rounded-lg bg-[var(--theme-color-dark)] bg-opacity-20 md:h-12"
    />
  );
};
