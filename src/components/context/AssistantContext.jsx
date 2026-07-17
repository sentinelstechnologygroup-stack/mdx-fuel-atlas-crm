import React, { createContext, useContext, useState } from 'react';
import SalesAssistantDialog from '@/components/ai/SalesAssistantDialog';

const AssistantContext = createContext();

export function AssistantProvider({ children }) {
    const [isOpen, setIsOpen] = useState(false);

    const openAssistant = () => setIsOpen(true);
    const closeAssistant = () => setIsOpen(false);
    const toggleAssistant = () => setIsOpen(prev => !prev);

    return (
        <AssistantContext.Provider value={{ isOpen, openAssistant, closeAssistant, toggleAssistant }}>
            {children}
            <SalesAssistantDialog open={isOpen} onOpenChange={setIsOpen} />
        </AssistantContext.Provider>
    );
}

export const useAssistant = () => useContext(AssistantContext);