import React, { createContext, useContext, useState, useRef } from 'react';

const ActNowContext = createContext();

export function ActNowProvider({ children }) {
  const [suggestions, setSuggestions] = useState(null);
  const timeoutRef = useRef(null);

  const updateSuggestions = (newSuggestions) => {
    setSuggestions(newSuggestions);
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout to clear suggestions after 1 minute
    timeoutRef.current = setTimeout(() => {
      setSuggestions(null);
    }, 60000); // 1 minute
  };

  return (
    <ActNowContext.Provider value={{ suggestions, setSuggestions: updateSuggestions }}>
      {children}
    </ActNowContext.Provider>
  );
}

export const useActNow = () => useContext(ActNowContext);