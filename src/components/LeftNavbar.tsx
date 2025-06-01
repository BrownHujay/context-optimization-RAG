// src/components/Navbar.tsx
import { useNavigate } from "react-router-dom";

const dummyChats = [
  { id: "1", title: "🌟 Tailwind Setup Help" },
  { id: "2", title: "🧪 I Set My Dog on Fire Help" },
  { id: "3", title: "📚 Embedding Experiments" },
];

interface NavbarProps {
  darkMode: boolean;
}

export default function Navbar({ darkMode }: NavbarProps) {
  const navigate = useNavigate();

  return (
    <aside className={`w-64 p-4 border-r ${darkMode ? 'border-gray-700' : 'border-gray-300'} ${!darkMode ? 'bg-gray-200/50' : ''}`}>
      <div className="mb-4">
        <h2 className="text-lg font-bold tracking-wider mb-2 animate-slide-in">
          Conversations
        </h2>
        <ul className="space-y-2">
          {dummyChats.map((chat) => (
            <li
              key={chat.id}
              onClick={() => navigate(`/chat/${chat.id}`)}
              className="bg-purple-800/20 dark:bg-purple-200/20 p-2 rounded-md hover:bg-purple-700/30 cursor-pointer transition-all"
            >
              {chat.title}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
