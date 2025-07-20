// src/components/ThinkingDropdown.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Brain } from 'lucide-react';

interface ThinkingDropdownProps {
  thinkingContent: string;
  className?: string;
}

const ThinkingDropdown: React.FC<ThinkingDropdownProps> = ({ 
  thinkingContent, 
  className = '' 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Animation variants
  const containerVariants = {
    collapsed: {
      height: 'auto',
      transition: {
        duration: 0.3,
        ease: [0.04, 0.62, 0.23, 0.98]
      }
    },
    expanded: {
      height: 'auto',
      transition: {
        duration: 0.3,
        ease: [0.04, 0.62, 0.23, 0.98]
      }
    }
  };

  const contentVariants = {
    collapsed: {
      opacity: 0,
      height: 0,
      y: -10,
      transition: {
        duration: 0.2,
        ease: 'easeInOut'
      }
    },
    expanded: {
      opacity: 1,
      height: 'auto',
      y: 0,
      transition: {
        duration: 0.3,
        delay: 0.1,
        ease: 'easeOut'
      }
    }
  };

  const iconVariants = {
    collapsed: {
      rotate: 0,
      transition: {
        duration: 0.2,
        ease: 'easeInOut'
      }
    },
    expanded: {
      rotate: 90,
      transition: {
        duration: 0.2,
        ease: 'easeInOut'
      }
    }
  };

  const brainVariants = {
    initial: {
      scale: 1,
      rotate: 0
    },
    animate: {
      scale: [1, 1.1, 1],
      rotate: [0, 5, -5, 0],
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: 'loop' as const,
        ease: 'easeInOut'
      }
    }
  };

  return (
    <motion.div 
      className={`thinking-dropdown border border-[var(--border-color)] rounded-lg bg-[var(--thinking-bg)] mb-3 overflow-hidden ${className}`}
      variants={containerVariants}
      initial="collapsed"
      animate={isExpanded ? "expanded" : "collapsed"}
    >
      {/* Header */}
      <motion.button
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--thinking-hover)] transition-colors duration-200 cursor-pointer text-left"
        onClick={toggleExpanded}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
      >
        <motion.div
          variants={brainVariants}
          initial="initial"
          animate="animate"
        >
          <Brain 
            size={18} 
            className="text-[var(--thinking-icon-color)] flex-shrink-0" 
          />
        </motion.div>
        
        <span className="text-sm font-medium text-[var(--thinking-text-color)] flex-grow">
          AI Thinking Process
        </span>
        
        <motion.div
          variants={iconVariants}
          initial="collapsed"
          animate={isExpanded ? "expanded" : "collapsed"}
        >
          <ChevronRight 
            size={16} 
            className="text-[var(--thinking-icon-color)] flex-shrink-0" 
          />
        </motion.div>
      </motion.button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            variants={contentVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-[var(--border-color)]">
              <div className="bg-[var(--thinking-content-bg)] rounded-md p-3 font-mono text-xs">
                <pre className="whitespace-pre-wrap text-[var(--thinking-content-text)] leading-relaxed">
                  {thinkingContent}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ThinkingDropdown;
